// plugins/plugin-classement.js — Classer une carte terminée (29/09/2026 ; mode local le 30/09/2026)
// Bouton « Classer » sur chaque carte du Storyboard : image, vidéo et fiche texte (prompts, notes : réplique, carton de
// fin, description, hashtags). Deux rangements au choix :
//   - LOCAL (par défaut) : via le pont local (prod-fruits, classement_pont.py), dans le dossier Production, par THÉMATIQUE
//       Serie/<Série>/EpNN/            Images, Video, Fiches (Final : vidéo montée)
//       Marketing/<Personnage>/<AAAAMMJJ - sujet>/   Images, Video, Fiches
//       <Autre thématique>/<Titre>/    Images, Video, Fiches   (Film, Court_metrage… ou une thématique créée ici)
//     fichiers nommés « Carte NN - titre.ext ». Aucun sélecteur de dossier : Claude ou un agent peut aussi classer.
//   - DOSSIER CHOISI : <dossier racine choisi dans le navigateur>/<Projet>/Saison NN/Episode NN/Carte NN - titre/
//     (sans sélecteur de dossier, les fichiers sont téléchargés avec le même nom complet).
// Extension indépendante : elle ne lit que le projet et ses cartes (p.publish.serie / ep s'ils existent), jamais une
// autre extension. Elle publie AgnesApp.classementLocal(carte) : le dossier local de la carte (utilisé par le moteur
// Flow manuel pour ranger la vidéo téléchargée), null si aucune thématique n'est réglée.
AgnesPlugins.register("classement", {
  name: "Classement des cartes",
  version: "1.1",
  KEY: "classement:racine",
  PONT: "http://127.0.0.1:8177",

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.cfg = core.pluginSettings ? core.pluginSettings("classement", { pont: this.PONT }) : { pont: this.PONT };
    this.themes = null;
    this.panel = core.ui.panel("classement", "Classer la carte");
    core.ui.addShotAction("Classer", function (shot) { self.open(shot); });
    if (this.A) this.A.classementLocal = function (shot) { return self.localOf(shot); };
    this.panel.body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cl]"); if (!b) return;
      var act = b.getAttribute("data-cl");
      if (act === "root") self.pickRoot().then(function () { self.render(); }, function (err) { if (err && err.name !== "AbortError") core.toast("Dossier non choisi : " + (err.message || err), "err"); });
      if (act === "go") self.run(b);
    });
  },

  // ---------- pont local (classement_pont.py) ----------
  pont: function () { return String((this.cfg && this.cfg.pont) || this.PONT).replace(/\/+$/, ""); },
  loadThemes: function () {
    var self = this;
    return fetch(this.pont() + "/classement/thematiques").then(function (r) { return r.json(); })
      .then(function (j) { self.themes = j.thematiques || []; self.racine = j.racine || ""; return self.themes; },
        function () { self.themes = null; return null; });
  },
  newTheme: function () {
    var self = this, nom = (window.prompt("Nom de la nouvelle thématique (dossier créé dans Production) :") || "").trim();
    if (!nom) return Promise.resolve();
    return fetch(this.pont() + "/classement/thematique", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: nom }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error);
        self.themes = j.thematiques || []; self.values.thematique = nom;
      }).catch(function (e) { self.core.toast("Thématique non créée : " + (e.message || e), "err"); });
  },
  today: function () { var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()); },
  kindOf: function (theme) { return /^s[eé]rie/i.test(theme || "") ? "serie" : /^marketing/i.test(theme || "") ? "marketing" : "autre"; },
  // Dossier de l'épisode / de la journée / du titre, sous Production
  localBase: function (v) {
    var th = this.clean(v.thematique), nom = this.clean(v.nom), k = this.kindOf(v.thematique);
    var date = /^\d{8}$/.test(String(v.date || "")) ? String(v.date) : this.today();
    if (k === "serie") return [th, nom, "Ep" + this.pad(v.episode)];
    if (k === "marketing") return [th, nom, v.sujet ? date + " - " + this.clean(v.sujet, 40) : date];
    return [th, nom];
  },
  localOf: function (shot) {
    var v = this.defaults(shot);
    if (!v.thematique) return null;
    var base = this.localBase(v).join("/");
    return { base: base, images: base + "/Images", video: base + "/Video", fiches: base + "/Fiches", nom: this.clean(v.carte, 70) };
  },

  supported: function () { return typeof window.showDirectoryPicker === "function"; },
  root: function () { var self = this; return this.core.store.getKV(this.KEY).then(function (h) { self.handle = h || null; return self.handle; }, function () { return null; }); },
  pickRoot: function () {
    var self = this;
    return window.showDirectoryPicker({ id: "agnes-classement", mode: "readwrite" }).then(function (h) {
      self.handle = h; return self.core.store.setKV(self.KEY, h).then(function () { return h; }, function () { return h; });
    });
  },
  permission: function (h) {
    var opt = { mode: "readwrite" };
    if (!h.queryPermission) return Promise.resolve(true);
    return h.queryPermission(opt).then(function (s) { return s === "granted" || h.requestPermission(opt).then(function (r) { return r === "granted"; }); });
  },

  // ---------- noms ----------
  clean: function (t, max) {
    var s = String(t || "").replace(/[<>:"\/\\|?*\x00-\x1f]+/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/, "").trim();
    return (s.length > (max || 60) ? s.slice(0, max || 60).trim() : s) || "Sans titre";
  },
  pad: function (n) { n = parseInt(n, 10) || 1; return n < 10 ? "0" + n : String(n); },
  // Par identifiant : pendant une génération, la carte reçue peut être une copie de celle du projet (30/09/2026)
  number: function (shot) {
    var list = this.A.sortedShots(this.core.getProject()), i = list.indexOf(shot);
    if (i === -1 && shot) i = list.findIndex(function (s) { return s.id === shot.id; });
    return i + 1;
  },
  titleOf: function (shot) {
    // titre de publication de la vidéo (notes d'un livrable marketing), sinon 1re ligne des notes, sinon début du prompt
    var notes = String(shot.notes || ""), m = /titre = ([^·\n]+)/.exec(notes);
    var n = m ? m[1] : notes.split("\n")[0].split(" · ")[0].replace(/^Carte\s+\d+\s*[—–-]\s*/i, "");
    var t = n || shot.media || String(shot.imagePrompt || shot.prompt || "").split(/[.,;]/)[0];
    return this.clean(t, 40);
  },
  defaults: function (shot) {
    var p = this.core.getProject(), d = p.classement || {}, pub = p.publish || {};
    return { projet: d.projet || pub.serie || p.name || "Projet", saison: d.saison || 1, episode: d.episode || pub.ep || 1,
      carte: "Carte " + this.pad(this.number(shot)) + " - " + this.titleOf(shot),
      mode: d.mode || "local", thematique: d.thematique || "", nom: d.nom || pub.serie || p.name || "Projet",
      date: d.date || this.today(), sujet: d.sujet || "" };
  },
  pathOf: function (v) {
    return [this.clean(v.projet), "Saison " + this.pad(v.saison), "Episode " + this.pad(v.episode), this.clean(v.carte, 70)];
  },

  // ---------- fenêtre ----------
  open: function (shot) {
    this.shot = shot; this.values = this.defaults(shot); var self = this;
    Promise.all([this.root(), this.loadThemes()]).then(function () { self.render(); self.panel.open(); });
  },
  render: function () {
    var esc = this.A.esc, v = this.values, s = this.shot, media = this.media(s), self = this;
    var mode = '<div class="field"><label>Rangement</label><select data-cv="mode">' +
      '<option value="local"' + (v.mode === "local" ? " selected" : "") + '>Local : dossier Production, par thématique (via le pont)</option>' +
      '<option value="dossier"' + (v.mode === "dossier" ? " selected" : "") + '>Dossier choisi dans le navigateur</option></select></div>';
    var contenu = '<p class="hint">Contenu : ' + [media.image ? "image" : null, media.video ? "vidéo" : null, "fiche (prompts" + (s.notes ? ", notes : réplique, carton, description, hashtags" : "") + ")"].filter(Boolean).join(" · ") +
      (s.classement ? '<br>Déjà classée le ' + esc(s.classement.date) + ' dans ' + esc(s.classement.dossier) + ' (les fichiers seront remplacés).' : '') + '</p>';
    if (v.mode === "local") {
      var k = this.kindOf(v.thematique), themes = this.themes;
      var opts = (themes || []).map(function (t) { return '<option' + (t === v.thematique ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("");
      this.panel.body.innerHTML =
        '<p class="hint">Copie la carte dans le dossier Production, rangé par thématique. Rien n\'est supprimé d\'Agnes.</p>' + mode +
        (themes ? "" : '<p class="hint" style="color:var(--danger)">Pont local injoignable (lancer_pont.bat) : relancez-le, ou choisissez « Dossier choisi dans le navigateur ».</p>') +
        '<div class="grid3"><div class="field"><label>Thématique</label><select data-cv="thematique"><option value="">Choisir…</option>' + opts +
        '<option value="__new">Nouvelle thématique…</option></select></div>' +
        '<div class="field"><label>' + (k === "serie" ? "Série" : k === "marketing" ? "Personnage / campagne" : "Titre") + '</label><input type="text" data-cv="nom" value="' + esc(v.nom) + '"></div>' +
        (k === "serie" ? '<div class="field"><label>Épisode</label><input type="number" min="1" data-cv="episode" value="' + esc(v.episode) + '"></div>' : "") +
        (k === "marketing" ? '<div class="field"><label>Date (AAAAMMJJ)</label><input type="text" maxlength="8" data-cv="date" value="' + esc(v.date) + '"></div>' : "") +
        '</div>' +
        (k === "marketing" ? '<div class="field"><label>Sujet du jour (facultatif)</label><input type="text" data-cv="sujet" value="' + esc(v.sujet) + '"></div>' : "") +
        '<div class="field"><label>Nom des fichiers de la carte</label><input type="text" data-cv="carte" value="' + esc(v.carte) + '"></div>' +
        (v.thematique ? '<p class="hint">Dans Production\\' + esc(this.localBase(v).join("\\")) + '\\ : Images, Video et Fiches, fichiers « ' + esc(this.clean(v.carte, 70)) + ' ».</p>' : "") +
        contenu + '<div class="row-inline"><button class="primary-btn" data-cl="go">Classer</button></div>';
      this.bindFields();
      return;
    }
    var root = this.supported()
      ? (this.handle ? "<b>" + esc(this.handle.name) + "</b> <button class=\"small-btn\" data-cl=\"root\">Changer…</button>" : "<button class=\"primary-btn\" data-cl=\"root\">Choisir le dossier racine…</button> <span class=\"hint\">(une seule fois, ex. D:\\Productions)</span>")
      : "<span class=\"hint\">Ce navigateur ne permet pas de choisir un dossier : les fichiers seront téléchargés (dossier Téléchargements), avec le chemin dans leur nom.</span>";
    this.panel.body.innerHTML =
      '<p class="hint">Copie la carte terminée dans un dossier rangé par projet, saison et épisode. Rien n\'est supprimé d\'Agnes.</p>' + mode +
      '<div class="field"><label>Dossier racine</label><div>' + root + '</div></div>' +
      '<div class="grid3">' +
      '<div class="field"><label>Projet</label><input type="text" data-cv="projet" value="' + esc(v.projet) + '"></div>' +
      '<div class="field"><label>Saison</label><input type="number" min="1" data-cv="saison" value="' + esc(v.saison) + '"></div>' +
      '<div class="field"><label>Épisode</label><input type="number" min="1" data-cv="episode" value="' + esc(v.episode) + '"></div></div>' +
      '<div class="field"><label>Dossier de la carte</label><input type="text" data-cv="carte" value="' + esc(v.carte) + '"></div>' +
      contenu + '<div class="row-inline"><button class="primary-btn" data-cl="go">Classer</button></div>';
    this.bindFields();
  },
  bindFields: function () {
    var self = this;
    Array.prototype.forEach.call(this.panel.body.querySelectorAll("[data-cv]"), function (el) {
      var key = el.getAttribute("data-cv");
      if (el.tagName === "SELECT") {
        el.addEventListener("change", function () {
          if (key === "thematique" && el.value === "__new") return self.newTheme().then(function () { self.render(); });
          self.values[key] = el.value; self.render();
        });
      } else el.addEventListener("input", function () { self.values[key] = el.value; });
    });
  },

  // ---------- contenu ----------
  media: function (shot) {
    var A = this.A, sel = A.selectedTake(shot), key = A.keyTake ? A.keyTake(shot) : null;
    return { image: key || (sel && sel.kind === "image" ? sel : null), video: sel && sel.kind === "video" ? sel : null };
  },
  ext: function (blob, kind) {
    var t = (blob && blob.type) || "", m = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
    return m[t] || (kind === "video" ? "mp4" : "png");
  },
  sheet: function (shot, v) {
    var A = this.A, p = this.core.getProject(), lib = p.library || [];
    var refs = (shot.ingredients || []).map(function (id) { var l = lib.find(function (x) { return x.id === id; }); return l ? l.name : null; }).filter(Boolean);
    var lines = ["# " + v.carte, "", "- Projet : " + v.projet + " · Saison " + this.pad(v.saison) + " · Épisode " + this.pad(v.episode),
      "- Classée le : " + new Date().toLocaleString("fr-FR"), "- Projet Agnes : " + p.name + " · carte #" + this.number(shot) + " · " + (shot.aspect || "") + " · " + (shot.duration || "") + " s"];
    if (refs.length) lines.push("- Références : " + refs.join(", "));
    if (shot.imagePrompt) lines.push("", "## Prompt image", "", shot.imagePrompt);
    lines.push("", "## " + (A.modeKind(shot.mode) === "image" ? "Prompt image" : "Prompt vidéo"), "", shot.prompt || "(vide)");
    if (shot.notes) lines.push("", "## Notes (réplique, carton de fin, publication)", "", shot.notes);
    return lines.join("\n") + "\n";
  },
  files: function (shot, v) {
    var self = this, A = this.A, m = this.media(shot), out = [{ name: "fiche.md", blob: new Blob([this.sheet(shot, v)], { type: "text/markdown" }) }];
    var get = function (t, kind, base) {
      if (!t) return Promise.resolve();
      return A.getTakeBlobOrFetch(t).then(function (b) { if (b) out.push({ name: base + "." + self.ext(b, kind), blob: b }); });
    };
    return get(m.image, "image", "image").then(function () { return get(m.video, "video", "video"); }).then(function () { return out; });
  },

  // ---------- écriture ----------
  run: function (btn) {
    var self = this, shot = this.shot, v = this.values, parts = this.pathOf(v), label = parts.join("/");
    if (btn) btn.disabled = true;
    var done = function (how) {
      var p = self.core.getProject();
      p.classement = { projet: v.projet, saison: +v.saison || 1, episode: +v.episode || 1,
        mode: v.mode, thematique: v.thematique, nom: v.nom, date: v.date, sujet: v.sujet };
      shot.classement = { date: new Date().toLocaleDateString("fr-FR"), dossier: how };
      self.core.saveProject(); if (self.A.renderShots) self.A.renderShots();
      self.panel.close(); self.core.toast("Carte classée : " + how, "ok");
    };
    var fail = function (e) { if (btn) btn.disabled = false; self.core.toast("Classement impossible : " + (e && (e.message || e)), "err"); };
    if (v.mode === "local") {
      if (!v.thematique) return fail(new Error("choisissez une thématique"));
      var base = this.localBase(v), nom = this.clean(v.carte, 70);
      return this.files(shot, v).then(function (files) {
        return files.reduce(function (pr, f) {
          var sub = f.name === "fiche.md" ? "Fiches" : /^image\./.test(f.name) ? "Images" : "Video";
          var chemin = base.concat([sub, nom + f.name.slice(f.name.lastIndexOf("."))]).join("/");
          return pr.then(function () {
            return fetch(self.pont() + "/classement/fichier", { method: "POST", headers: { "X-Chemin": encodeURIComponent(chemin) }, body: f.blob })
              .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.error || "refusé par le pont"); });
          });
        }, Promise.resolve());
      }).then(function () { done("Production/" + base.join("/")); }, function (e) {
        fail(/fetch/i.test(String(e && e.message)) ? new Error("pont local injoignable (lancer_pont.bat)") : e);
      });
    }
    this.files(shot, v).then(function (files) {
      if (!self.supported()) return self.download(files, parts).then(function () { done("Téléchargements (" + label + ")"); });
      var go = self.handle ? Promise.resolve(self.handle) : self.pickRoot();
      return go.then(function (root) {
        return self.permission(root).then(function (ok) {
          if (!ok) throw new Error("accès au dossier refusé");
          return parts.reduce(function (pr, name) { return pr.then(function (d) { return d.getDirectoryHandle(name, { create: true }); }); }, Promise.resolve(root));
        }).then(function (dir) {
          return files.reduce(function (pr, f) {
            return pr.then(function () { return dir.getFileHandle(f.name, { create: true }); })
              .then(function (fh) { return fh.createWritable(); })
              .then(function (w) { return w.write(f.blob).then(function () { return w.close(); }); });
          }, Promise.resolve());
        }).then(function () { done(root.name + "/" + label); });
      });
    }).catch(fail);
  },
  download: function (files, parts) {
    var prefix = parts.map(function (x) { return x.replace(/\s+/g, "_"); }).join("__") + "__";
    return files.reduce(function (pr, f) {
      return pr.then(function () {
        var a = document.createElement("a"), u = URL.createObjectURL(f.blob);
        a.href = u; a.download = prefix + f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        return new Promise(function (r) { setTimeout(r, 400); });
      });
    }, Promise.resolve());
  }
});
