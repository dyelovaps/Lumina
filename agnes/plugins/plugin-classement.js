// plugins/plugin-classement.js — Classer une carte terminée (29/09/2026)
// Bouton « 📁 Classer » sur chaque carte du Storyboard : copie l'image, la vidéo et une fiche texte (prompts, notes :
// réplique, carton de fin, description, hashtags) dans  <dossier racine>/<Projet>/Saison NN/Episode NN/Carte NN - titre/
// Le dossier racine est choisi une fois (sélecteur de dossier du navigateur) et retenu. Sans ce sélecteur (navigateur
// ancien), les fichiers sont téléchargés avec le même nom complet. Extension indépendante : elle ne lit que le projet et
// ses cartes (p.publish.serie / ep s'ils existent, remplis par Publication ou Épisodes), jamais une autre extension.
AgnesPlugins.register("classement", {
  name: "Classement des cartes",
  version: "1.0",
  KEY: "classement:racine",

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.panel = core.ui.panel("classement", "📁 Classer la carte");
    core.ui.addShotAction("📁 Classer", function (shot) { self.open(shot); });
    this.panel.body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cl]"); if (!b) return;
      var act = b.getAttribute("data-cl");
      if (act === "root") self.pickRoot().then(function () { self.render(); }, function (err) { if (err && err.name !== "AbortError") core.toast("Dossier non choisi : " + (err.message || err), "err"); });
      if (act === "go") self.run(b);
    });
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
  number: function (shot) { var A = this.A; return A.sortedShots(this.core.getProject()).indexOf(shot) + 1; },
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
      carte: "Carte " + this.pad(this.number(shot)) + " - " + this.titleOf(shot) };
  },
  pathOf: function (v) {
    return [this.clean(v.projet), "Saison " + this.pad(v.saison), "Episode " + this.pad(v.episode), this.clean(v.carte, 70)];
  },

  // ---------- fenêtre ----------
  open: function (shot) { this.shot = shot; this.values = this.defaults(shot); var self = this; this.root().then(function () { self.render(); self.panel.open(); }); },
  render: function () {
    var esc = this.A.esc, v = this.values, s = this.shot, media = this.media(s);
    var root = this.supported()
      ? (this.handle ? "📁 <b>" + esc(this.handle.name) + "</b> <button class=\"small-btn\" data-cl=\"root\">Changer…</button>" : "<button class=\"primary-btn\" data-cl=\"root\">Choisir le dossier racine…</button> <span class=\"hint\">(une seule fois, ex. D:\\Productions)</span>")
      : "<span class=\"hint\">Ce navigateur ne permet pas de choisir un dossier : les fichiers seront téléchargés (dossier Téléchargements), avec le chemin dans leur nom.</span>";
    this.panel.body.innerHTML =
      '<p class="hint">Copie la carte terminée dans un dossier rangé par projet, saison et épisode. Rien n\'est supprimé d\'Agnes.</p>' +
      '<div class="field"><label>Dossier racine</label><div>' + root + '</div></div>' +
      '<div class="grid3">' +
      '<div class="field"><label>Projet</label><input type="text" data-cv="projet" value="' + esc(v.projet) + '"></div>' +
      '<div class="field"><label>Saison</label><input type="number" min="1" data-cv="saison" value="' + esc(v.saison) + '"></div>' +
      '<div class="field"><label>Épisode</label><input type="number" min="1" data-cv="episode" value="' + esc(v.episode) + '"></div></div>' +
      '<div class="field"><label>Dossier de la carte</label><input type="text" data-cv="carte" value="' + esc(v.carte) + '"></div>' +
      '<p class="hint">Contenu : ' + [media.image ? "image" : null, media.video ? "vidéo" : null, "fiche.md (prompts" + (s.notes ? ", notes : réplique, carton, description, hashtags" : "") + ")"].filter(Boolean).join(" · ") +
      (s.classement ? '<br>Déjà classée le ' + esc(s.classement.date) + ' dans ' + esc(s.classement.dossier) + ' (les fichiers seront remplacés).' : '') + '</p>' +
      '<div class="row-inline"><button class="primary-btn" data-cl="go">Classer</button></div>';
    var self = this;
    Array.prototype.forEach.call(this.panel.body.querySelectorAll("[data-cv]"), function (el) {
      el.addEventListener("input", function () { self.values[el.getAttribute("data-cv")] = el.value; });
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
      p.classement = { projet: v.projet, saison: +v.saison || 1, episode: +v.episode || 1 };
      shot.classement = { date: new Date().toLocaleDateString("fr-FR"), dossier: how };
      self.core.saveProject(); if (self.A.renderShots) self.A.renderShots();
      self.panel.close(); self.core.toast("Carte classée : " + how, "ok");
    };
    var fail = function (e) { if (btn) btn.disabled = false; self.core.toast("Classement impossible : " + (e && (e.message || e)), "err"); };
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
