// plugins/plugin-moteurs.js — Moteurs de génération : choisir qui fabrique les images et les vidéos du Studio.
// IMAGES
//   « Agnes » (gratuit, par défaut) : Agnes Image 2.5 Flash, comme avant.
//   « ChatGPT » (votre abonnement) : l'image est demandée au pont local de prod-fruits (lancer_pont.bat),
//     qui la fait générer par Codex avec votre compte ChatGPT, puis Agnes la range comme une prise normale.
//     Les références du plan (bibliothèque) partent en fichiers : pas besoin d'imgbb.
// VIDÉOS
//   « Agnes » (gratuit, par défaut) : Agnes Video 2.5, comme avant.
//   « Grok » (votre abonnement) : seulement quand Agnes est ouverte DEPUIS Lumina (onglet Agnes). La page pilote
//     l'onglet grok.com/imagine comme le panneau Lumina : image de départ et références envoyées en fichiers
//     (pas d'imgbb), durée arrondie à 6, 10 ou 15 s, résolution et qualité réglables dans ⚙.
// Tout le reste (file d'attente, prises, image validée → animation, montage) ne change pas.
AgnesPlugins.register("moteurs", {
  name: "Moteurs de génération",
  version: "1.1",
  GROK_RATIOS: ["9:16", "16:9", "1:1"],

  init: function (core) {
    var self = this, A = window.AgnesApp;
    this.core = core; this.A = A;
    this.cfg = core.pluginSettings("moteurs", { image: "agnes", video: "agnes", pont: "http://127.0.0.1:8177", grokRes: "720p", grokQuality: "quality" });
    this.grokQueue = Promise.resolve();   // un seul onglet Grok : une vidéo à la fois
    // Références envoyées à Agnes allégées (1024 px, JPEG) : suffisant pour un visage et une tenue, et les requêtes
    // lourdes expirent souvent côté serveur (HTTP 504) en offre gratuite.
    A.libItemToApiUrl = function (item, proj) {
      if (item.publicUrl) return Promise.resolve(item.publicUrl);
      return AgnesStore.getBlob("lib:" + item.id).then(function (b) {
        if (!b) throw { display: "L'image « " + item.name + " » n'est plus disponible — réimportez-la dans la Bibliothèque." };
        return A.shrinkBlob(b, 1024).then(function (s) {
          if (s === b && b.size > 400000) {   // déjà petite en pixels mais lourde (PNG) : ré-encodée en JPEG
            return A.loadImage(URL.createObjectURL(b)).then(function (img) {
              var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext("2d").drawImage(img, 0, 0); return A.canvasToBlob(c, "image/jpeg", 0.88);
            });
          }
          return s;
        }).then(A.blobToApiUrl).then(function (url) {
          if (/^https?:/i.test(url)) { item.publicUrl = url; A.touch(proj); }
          return url;
        });
      });
    };
    // Prompt final de tous les moteurs : règles fixes + (Agnes Image) légende des images de référence
    core.addPromptFilter(function (prompt, shot, proj, kind) { return self.quality(prompt, shot, proj, kind); });

    // Chaque prise garde le nom du moteur qui l'a fabriquée (affiché sur les cartes)
    var tag = function (takes) { (takes || []).forEach(function (t) { if (t && !t.source) t.source = "agnes"; }); return takes; };
    var agnesImage = A.generateImage, agnesVideo = A.generateVideo;
    A.generateImage = function (job, shot, proj) {
      return self.cfg.image === "chatgpt" ? self.chatgptImage(job, shot, proj) : agnesImage(job, shot, proj).then(tag);
    };
    A.generateVideo = function (job, shot, proj) {
      // Une reprise (vidéo Agnes interrompue par un rechargement) reste chez Agnes : jamais renvoyée à Grok
      if (job && job.resume) return agnesVideo(job, shot, proj).then(tag);
      return self.cfg.video === "grok" ? self.grokVideo(job, shot, proj) : agnesVideo(job, shot, proj).then(tag);
    };
    // Badges en tête des cartes : moteur de la prochaine image / vidéo, clic = changer (pour tous les plans)
    A.cardEngineBadge = function (shot) {
      var out = "";
      if (A.isTwoStep(shot) || A.modeKind(shot.mode) === "image") {
        var gpt = self.cfg.image === "chatgpt";
        out += '<button type="button" class="mode-badge engine-badge" data-engine="image" style="cursor:pointer;' + (gpt ? "border-color:#10a37f;color:#10a37f;" : "") +
          '" title="Prochaine image générée par ' + self.label("image") + ' — cliquer pour changer (tous les plans)">🖼 ' + (gpt ? "ChatGPT" : "Agnes") + "</button>";
      }
      if (A.modeKind(shot.mode) === "video") {
        var grok = self.cfg.video === "grok";
        out += '<button type="button" class="mode-badge engine-badge" data-engine="video" style="cursor:pointer;' + (grok ? "border-color:#c9a227;color:#c9a227;" : "") +
          '" title="Prochaine vidéo générée par ' + self.label("video") + ' — cliquer pour changer (tous les plans)">🎬 ' + (grok ? "Grok" : "Agnes") + "</button>";
      }
      return out;
    };
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".engine-badge"); if (!b) return;
      e.preventDefault(); e.stopPropagation(); self.toggle(b.getAttribute("data-engine") || "image");
    }, true);
    // Clé Agnes nécessaire seulement si une étape du travail passe par Agnes
    A.needsAgnesKey = function (shot, stage) {
      var steps = self.steps(shot, stage);
      return (steps.image && self.cfg.image !== "chatgpt") || (steps.video && self.cfg.video !== "grok");
    };

    this.renderSettings();
    this.badge = core.ui.addToolbarButton("storyboard", "", function () { self.toggle("image"); });
    this.vbadge = core.ui.addToolbarButton("storyboard", "", function () { self.toggle("video"); });
    this.refresh();
  },

  toggle: function (what) {
    if (what === "video") {
      if (this.cfg.video !== "grok" && !this.canGrok()) return this.core.toast("Grok n'est disponible que dans Agnes ouverte depuis Lumina (onglet Agnes du panneau Lumina).", "err");
      this.cfg.video = this.cfg.video === "grok" ? "agnes" : "grok";
    } else this.cfg.image = this.cfg.image === "chatgpt" ? "agnes" : "chatgpt";
    this.cfg.save(); this.refresh();
    this.core.toast((what === "video" ? "Vidéos générées par " : "Images générées par ") + this.label(what) + ".", "ok");
  },

  label: function (what) {
    if (what === "video") return this.cfg.video === "grok" ? "Grok (abonnement)" : "Agnes Video (gratuit)";
    return this.cfg.image === "chatgpt" ? "ChatGPT (abonnement)" : "Agnes (gratuit)";
  },

  canGrok: function () { return typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage); },

  refresh: function () {
    if (this.badge) { this.badge.textContent = "🖼 Images : " + (this.cfg.image === "chatgpt" ? "ChatGPT" : "Agnes"); this.badge.title = "Cliquer pour changer de moteur d'image"; }
    if (this.vbadge) { this.vbadge.textContent = "🎬 Vidéos : " + (this.cfg.video === "grok" ? "Grok" : "Agnes"); this.vbadge.title = "Cliquer pour changer de moteur vidéo"; }
    var sel = document.getElementById("motImage"); if (sel) sel.value = this.cfg.image;
    var vsel = document.getElementById("motVideo"); if (vsel) vsel.value = this.cfg.video;
    var gopt = document.getElementById("motGrokOpts"); if (gopt) gopt.style.display = this.cfg.video === "grok" ? "" : "none";
    var gb = document.getElementById("motGrokBloc"), self = this;
    if (gb) {
      gb.style.display = this.cfg.grokBloque ? "" : "none";
      gb.innerHTML = this.cfg.grokBloque ? "⛔ " + this.A.esc(this.cfg.grokBloque) + ' <button class="small-btn" type="button" id="motGrokDebloc">Réactiver Grok</button>' : "";
      var bt = document.getElementById("motGrokDebloc");
      if (bt) bt.onclick = function () { delete self.cfg.grokBloque; self.cfg.save(); self.refresh(); self.core.toast("Grok réactivé.", "ok"); };
    }
    if (this.A.ready) this.A.renderShots();
  },

  // Carte dans ⚙ Réglages, au-dessus des extensions
  renderSettings: function () {
    var self = this, host = document.getElementById("extensionsList");
    host = host && host.closest(".card");
    if (!host || document.getElementById("motCard")) return;
    var card = document.createElement("div");
    card.className = "card"; card.id = "motCard";
    card.innerHTML = '<h3>Moteurs de génération</h3>' +
      '<div class="field"><label for="motImage">Images (plans, images de départ, planches)</label><select id="motImage">' +
      '<option value="agnes">Agnes Image 2.5 Flash — gratuit</option><option value="chatgpt">ChatGPT (Codex, votre abonnement) — via le pont local</option></select>' +
      '<p class="hint">ChatGPT : lancez <code>lancer_pont.bat</code> (prod-fruits) et laissez-le ouvert. Une image à la fois, 1 à 3 minutes chacune. Les références du plan sont jointes sans imgbb.</p></div>' +
      '<div class="field"><label for="motPont">Adresse du pont local</label>' +
      '<div class="row-inline"><input type="text" id="motPont" list="motPontList" autocomplete="off" style="flex:1">' +
      '<button class="small-btn" id="motPontDel" type="button" title="Retirer cette adresse de la liste">✕</button></div>' +
      '<datalist id="motPontList"></datalist>' +
      '<p class="hint">Choisissez une adresse dans la liste, ou tapez-en une nouvelle : elle y est ajoutée.</p></div>' +
      '<button class="small-btn" id="motTest" type="button">Tester le pont</button> <span class="hint" id="motTestOut"></span>' +
      '<div class="field" style="margin-top:14px"><label for="motVideo">Vidéos (animation des plans)</label><select id="motVideo">' +
      '<option value="agnes">Agnes Video 2.5 — gratuit</option><option value="grok">Grok Imagine (votre abonnement) — Agnes ouverte depuis Lumina</option></select>' +
      '<p class="hint">Grok : gardez un onglet <b>grok.com/imagine</b> ouvert et connecté ; il passe au premier plan pendant chaque génération. Une vidéo à la fois. Durée arrondie à 6, 10 ou 15 s ; formats 9:16, 16:9 ou 1:1. Image de départ et références envoyées sans imgbb.' +
      (this.canGrok() ? '' : ' <b>Indisponible ici</b> : ouvrez Agnes depuis l\'onglet Agnes de Lumina.') + '</p></div>' +
      '<div class="hint" id="motGrokBloc" style="display:none;color:var(--danger)"></div>' +
      '<div class="row-inline" id="motGrokOpts"><label class="inline">Résolution <select id="motGrokRes"><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>' +
      '<label class="inline">Qualité <select id="motGrokQ"><option value="speed">Rapide</option><option value="quality">Qualité</option></select></label></div>';
    host.parentNode.insertBefore(card, host);
    var sel = card.querySelector("#motImage"), pont = card.querySelector("#motPont"), list = card.querySelector("#motPontList");
    var DEFAUT = "http://127.0.0.1:8177";
    if (!Array.isArray(this.cfg.ponts)) { this.cfg.ponts = [DEFAUT]; if (this.cfg.pont !== DEFAUT) this.cfg.ponts.push(this.cfg.pont); this.cfg.save(); }
    function fill() {
      list.innerHTML = self.cfg.ponts.map(function (u) { return '<option value="' + self.A.esc(u) + '">'; }).join("");
      pont.value = self.cfg.pont;
    }
    fill();
    sel.value = this.cfg.image;
    sel.addEventListener("change", function () { self.cfg.image = sel.value; self.cfg.save(); self.refresh(); });
    var vsel = card.querySelector("#motVideo"), res = card.querySelector("#motGrokRes"), q = card.querySelector("#motGrokQ");
    vsel.value = this.cfg.video; res.value = this.cfg.grokRes || "720p"; q.value = this.cfg.grokQuality || "quality";
    vsel.addEventListener("change", function () {
      if (vsel.value === "grok" && !self.canGrok()) { vsel.value = "agnes"; return self.core.toast("Grok n'est disponible que dans Agnes ouverte depuis Lumina.", "err"); }
      self.cfg.video = vsel.value; self.cfg.save(); self.refresh();
    });
    res.addEventListener("change", function () { self.cfg.grokRes = res.value; self.cfg.save(); });
    q.addEventListener("change", function () { self.cfg.grokQuality = q.value; self.cfg.save(); });
    // Champ vidé à l'ouverture pour que la liste montre toutes les adresses (l'adresse actuelle reste en grisé)
    pont.addEventListener("focus", function () { pont.placeholder = self.cfg.pont; pont.value = ""; });
    pont.addEventListener("blur", function () { if (!pont.value.trim()) pont.value = self.cfg.pont; });
    pont.addEventListener("change", function () {
      var u = pont.value.trim().replace(/\/+$/, "");
      if (!u) return;
      if (!/^https?:\/\//i.test(u)) u = "http://" + u;
      self.cfg.pont = u;
      if (self.cfg.ponts.indexOf(u) === -1) self.cfg.ponts.push(u);
      self.cfg.save(); fill();
    });
    card.querySelector("#motPontDel").addEventListener("click", function () {
      var u = self.cfg.pont;
      self.cfg.ponts = self.cfg.ponts.filter(function (x) { return x !== u; });
      if (!self.cfg.ponts.length) self.cfg.ponts = [DEFAUT];
      self.cfg.pont = self.cfg.ponts[0]; self.cfg.save(); fill();
      self.core.toast("Adresse retirée : " + u + " — pont actuel : " + self.cfg.pont, "ok");
    });
    card.querySelector("#motTest").addEventListener("click", function () {
      var out = card.querySelector("#motTestOut"); out.textContent = "…";
      fetch(self.cfg.pont + "/health").then(function (r) { return r.json(); })
        .then(function (j) { out.textContent = j.ok ? "✔ Pont joignable." : "Réponse inattendue."; })
        .catch(function () { out.textContent = "✗ Pont injoignable : lancez lancer_pont.bat."; });
    });
  },

  // Étapes réellement faites par ce travail : { image, video }
  steps: function (shot, stage) {
    var A = this.A;
    if (!shot) return { image: true, video: true };
    if (A.isTwoStep(shot)) {
      if (stage === "image") return { image: true, video: false };
      if (stage === "video" || A.keyTake(shot)) return { image: false, video: true };
      return { image: true, video: !!shot.autoAnimate };
    }
    var v = A.modeKind(shot.mode) === "video";
    return { image: !v, video: v };
  },
  imageOnly: function (shot, stage) { var s = this.steps(shot, stage); return s.image && !s.video; },

  // Planche personnage (skill « Fiche personnage » ou prompt qui en demande une) : mise en page et bandeau nom autorisés
  isSheet: function (shot, prompt) {
    return (shot.skills || []).indexOf("b-sheet") !== -1 || /character (reference )?sheet|model sheet|planche|fiche perso/i.test(prompt || shot.prompt || "");
  },

  // Qualité en mode gratuit (et règles communes à tous les moteurs), d'après la fiche « structure des prompts Agnes 2.5 » :
  // - images Agnes avec références : « <Picture n> = Nom (rôle) » dans l'ordre exact des images envoyées, sinon le modèle
  //   ne sait pas quelle photo correspond à quel personnage ;
  // - règles fixes de l'utilisatrice (jeu subtil, regard vers l'interlocuteur, net sans grain, sans texte, sans musique),
  //   ajoutées seulement si le prompt ne les contient pas déjà (ChatGPT, Grok et Lumina les reconnaissent : pas de doublon).
  quality: function (prompt, shot, proj, kind) {
    var A = this.A, out = String(prompt || "");
    if (kind === "image") {
      if (!shot._export && this.cfg.image !== "chatgpt") {
        var KIND = { personnage: "character", decor: "place", objet: "object", costume: "outfit", style: "style reference" }, list = [], styleOnly = true;
        if (shot.mode === "i2i" && shot.sourceRef) list.push("is the image to edit: keep its composition unless asked otherwise");
        if (A.usesRefs(shot.mode, shot)) (shot.ingredients || []).slice(0, A.settings.maxRefs || 5).forEach(function (id) {
          var it = proj.library.find(function (l) { return l.id === id; });
          if (!it || it.kind !== "style") styleOnly = false;
          // Référence de style : le rendu seulement, jamais le visage ni le personnage (sinon il remplace le personnage demandé)
          list.push("= " + (it ? it.name + (it.kind === "style" ? " (style reference only: copy its rendering and materials, NOT its characters, faces or outfits)" : " (" + (KIND[it.kind] || "reference") + ")") : "reference"));
        });
        // Verrou d'identité actif : la consigne « même visage, même tenue » est déjà dans le prompt
        if (list.length) out += ". Reference images: " + list.map(function (x, i) { return "<Picture " + (i + 1) + "> " + x; }).join(", ") +
          (shot.lock !== false || styleOnly ? "" : ". Keep the exact face, hairstyle, skin, outfit and proportions of each character and the exact look of each place as shown in its reference") +
          "; show them in this new scene, never reproduce the reference sheets themselves";
      }
      if (!/subtle/i.test(out)) out += ". Human, natural body language, subtle restrained expression";
      if (!/no film grain/i.test(out)) out += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!this.isSheet(shot, out) && !/no (on-screen )?text/i.test(out)) out += ". No text, no letters, no subtitles, no watermark";
    } else if (kind === "video") {
      // Répliques françaises : ponctuation et caractères spéciaux qui coupent la parole (tous moteurs).
      // Le français reste intact (accents compris) : la phonétique de prod-fruits était prévue pour Google Flow.
      if (window.AgnesDialogue) out = window.AgnesDialogue.nettoie(out, { phonetique: this.cfg.phonetique === true });
      if (!/subtle/i.test(out)) out += ". Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to";
      if (!/no film grain/i.test(out)) out += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!/no music/i.test(out)) out += ". No music. No song. Ambient sound only";
    }
    return out;
  },

  // Blob d'un élément de bibliothèque, réduit, en data URL
  libData: function (proj, id, max) {
    var A = this.A, item = proj.library.find(function (l) { return l.id === id; });
    if (!item) return Promise.resolve(null);
    return A.getLibBlob(item).then(function (b) { return b ? A.shrinkBlob(b, max || 1536) : null; })
      .then(function (b) { return b ? A.blobToDataUrl(b) : null; })
      .then(function (data) { return data ? { nom: item.name, data: data } : null; });
  },

  // Références du plan en fichiers : image source (Image → Image) puis ingrédients, avec leur nom.
  refs: function (shot, proj) {
    var self = this, A = this.A, list = [];
    if (shot.mode === "i2i" && shot.sourceRef) list.push({ id: shot.sourceRef, nom: "source image to edit" });
    if (A.usesRefs(shot.mode, shot)) (shot.ingredients || []).forEach(function (id) { list.push({ id: id }); });
    return Promise.all(list.slice(0, 8).map(function (r) {
      return self.libData(proj, r.id).then(function (x) { if (x && r.nom) x.nom = r.nom; return x; });
    })).then(function (x) { return x.filter(Boolean); });
  },

  // =========================================================
  // IMAGES PAR CHATGPT (pont local → Codex)
  // =========================================================
  chatgptImage: function (job, shot, proj) {
    var self = this, A = this.A, pont = this.cfg.pont, wanted = A.clamp(shot.outputs || 1, 1, 4), takes = [];
    var ratio = A.nearestRatio(shot.aspect || proj.aspect || "9:16", ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2"]);
    job.info = "ChatGPT : préparation des références…"; A.emitJob(job);
    return this.refs(shot, proj).then(function (refs) {
      // Règles de tous les projets : image nette sans grain, aucun texte incrusté (sauf le bandeau nom d'une planche).
      var prompt = A.buildPrompt(shot, proj), planche = self.isSheet(shot, prompt);
      if (!/no film grain/i.test(prompt)) prompt += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!planche && !/no (on-screen )?text/i.test(prompt)) prompt += ". No text, no letters, no subtitles, no watermark";
      function one(n) {
        var tag = wanted > 1 ? " (" + n + "/" + wanted + ")" : "";
        return fetch(pont + "/codex/image", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt, ratio: ratio, refs: refs, planche: planche }), signal: job.signal })
          .catch(function (e) {
            if (e && e.name === "AbortError") throw { display: "Annulé.", cancelled: true };
            throw { display: "Pont local injoignable (" + pont + ") : lancez lancer_pont.bat dans prod-fruits, ou repassez les images sur Agnes (⚙ → Moteurs)." };
          })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j.id) throw { display: "Pont : " + (j.error || "demande refusée") };
            return self.wait(job, j.id, tag);
          })
          .then(function (blob) { return self.storeTake(blob, "image", "chatgpt"); })
          .then(function (take) { takes.push(take); if (n < wanted) return one(n + 1); });
      }
      return one(1);
    }).then(function () { return takes; });
  },

  wait: function (job, id, tag) {
    var A = this.A, pont = this.cfg.pont, end = Date.now() + 20 * 60000;
    function poll() {
      if (Date.now() > end) return Promise.reject({ display: "ChatGPT n'a pas rendu l'image en 20 minutes." });
      return A.sleep(4000, job.signal).then(function () {
        return fetch(pont + "/codex/etat?id=" + encodeURIComponent(id)).then(function (r) { return r.json(); })
          .catch(function () { return { statut: "injoignable" }; });
      }).then(function (e) {
        if (e.statut === "fini") return fetch(pont + "/codex/resultat?id=" + encodeURIComponent(id)).then(function (r) {
          if (!r.ok) throw { display: "Pont : image introuvable." };
          return r.blob();
        });
        if (e.statut === "erreur" || e.statut === "inconnu") throw { display: "ChatGPT : " + (e.erreur || "échec") };
        job.info = e.statut === "en_cours" ? "ChatGPT dessine l'image" + tag + "…"
          : e.statut === "injoignable" ? "Pont injoignable, nouvel essai…"
            : "En attente chez ChatGPT" + tag + (e.position ? " — position " + e.position : "") + "…";
        A.emitJob(job);
        return poll();
      });
    }
    return poll();
  },

  // =========================================================
  // VIDÉOS PAR GROK (onglet grok.com/imagine piloté par Lumina)
  // =========================================================
  grokDuration: function (sec) { var d = Number(sec) || 6; return d <= 7 ? 6 : d <= 12 ? 10 : 15; },

  // Image d'un plan à partir d'une référence : bibliothèque, image validée du plan, ou dernière image du plan précédent
  startImage: function (refId, shot, proj) {
    var A = this.A;
    if (!refId) return Promise.resolve(null);
    var toData = function (b) { return b ? A.shrinkBlob(b, 1920).then(A.blobToDataUrl) : null; };
    if (refId === A.KEY_REF) {
      var k = A.keyTake(shot);
      if (!k) return Promise.reject({ display: "Générez d'abord l'image de départ de ce plan." });
      return A.getTakeBlobOrFetch(k).then(toData);
    }
    if (refId === A.PREV_REF) {
      var prev = A.previousShot(shot, proj), t = prev && A.selectedTake(prev);
      if (!t) return Promise.reject({ display: "Le plan précédent n'a pas encore de rendu — générez-le d'abord." });
      return A.getTakeBlobOrFetch(t).then(function (b) {
        if (!b) throw { display: "Rendu du plan précédent introuvable." };
        if (t.kind === "image") return toData(b);
        var u = URL.createObjectURL(b);
        return A.videoFrame(u, "last").then(function (fb) { URL.revokeObjectURL(u); return toData(fb); });
      });
    }
    return this.libData(proj, refId, 1920).then(function (x) { return x && x.data; });
  },

  grokVideo: function (job, shot, proj) {
    var self = this, A = this.A, run = this.grokQueue.then(function () { return self.grokVideoNow(job, shot, proj); });
    this.grokQueue = run.catch(function () { });
    job.info = "En attente de l'onglet Grok…"; A.emitJob(job);
    return run;
  },

  grokVideoNow: function (job, shot, proj) {
    var self = this, A = this.A, m = shot.mode;
    if (!this.canGrok()) return Promise.reject({ display: "Grok n'est disponible que dans Agnes ouverte depuis Lumina (onglet Agnes). Repassez les vidéos sur Agnes (⚙ → Moteurs)." });
    if (this.cfg.grokBloque) return Promise.reject({ display: "Grok est bloqué par sécurité : " + this.cfg.grokBloque + " Vérifiez l'onglet Grok, puis réactivez-le dans ⚙ → Moteurs de génération." });
    if (job.signal && job.signal.aborted) return Promise.reject({ display: "Annulé.", cancelled: true });
    var send = function (payload) {
      return new Promise(function (resolve) {
        chrome.runtime.sendMessage({ type: "SEND_TO_TAB", payload: payload }, function (res) {
          resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : res);
        });
      });
    };
    var onAbort = function () { send({ type: "CANCEL" }); };
    if (job.signal) job.signal.addEventListener("abort", onAbort);
    job.info = "Grok : préparation des images…"; A.emitJob(job);

    var starts = m === "frames" ? [shot.startRef, shot.endRef] : m === "i2v" ? [shot.sourceRef] : [];
    var withRefs = m === "t2v" || m === "ingr_v" || (m === "i2v" && shot.i2v === "refs");
    return Promise.all([
      Promise.all(starts.map(function (r) { return self.startImage(r, shot, proj); })),
      Promise.all((withRefs ? shot.ingredients || [] : []).slice(0, 7).map(function (id) { return self.libData(proj, id, 1024); }))
    ]).then(function (r) {
      var imgs = r[0].filter(Boolean), refs = r[1].filter(Boolean);
      if (starts.length && imgs.length !== starts.length) throw { display: "Image de départ introuvable pour ce plan." };
      // Scène verrouillée : début et fin sur la même image
      var pair = m === "frames" || (m === "i2v" && shot.i2v === "anchor") ? "startEnd" : imgs.length ? "startOnly" : "";
      if (pair === "startEnd" && imgs.length === 1) imgs = [imgs[0], imgs[0]];
      var grokMode = m === "ingr_v" ? "ingredients" : imgs.length ? "frame2v" : "t2v";
      var attachments = imgs.map(function (u, i) { return { url: u, role: i === 1 ? "last" : "first", name: "Scène " + (i + 1) }; })
        .concat(refs.map(function (x) { return { url: x.data, role: "reference", name: x.nom }; }));
      // Règles de tous les projets : jeu subtil, regard vers l'interlocuteur, image nette, pas de musique
      var prompt = A.buildPrompt(shot, proj);
      if (!/subtle/i.test(prompt)) prompt += ". Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to";
      if (!/no film grain/i.test(prompt)) prompt += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!/no music/i.test(prompt)) prompt += ". No music. No song. Ambient sound only";
      var res = self.cfg.grokRes || "720p", wanted = A.clamp(shot.outputs || 1, 1, 4), takes = [];
      var payload = {
        type: "SUBMIT_PROMPT", prompt: prompt, mediaKind: "video", grokMode: grokMode,
        aspectRatio: A.nearestRatio(shot.aspect || proj.aspect || "9:16", self.GROK_RATIOS), outputs: 1,
        duration: self.grokDuration(shot.duration), quality: self.cfg.grokQuality || "quality", preferSpeed: self.cfg.grokQuality === "speed",
        resolution: res, force480p: res === "480p", timeoutMs: /1080/.test(res) ? 360000 : 240000,
        images: imgs, attachments: attachments, framePair: pair
      };
      shot.lastRequest = Object.assign({}, payload, { images: imgs.length + " image(s)", attachments: attachments.map(function (a) { return a.role + (a.name ? " : " + a.name : ""); }) });
      function one(n) {
        if (job.signal && job.signal.aborted) throw { display: "Annulé.", cancelled: true };
        job.info = "Grok génère la vidéo" + (wanted > 1 ? " (" + n + "/" + wanted + ")" : "") + " — " + payload.duration + " s, " + res + "…"; A.emitJob(job);
        return send({ type: "PING" }).then(function (ping) {
          if (!ping || !ping.ok) throw { display: "Onglet grok.com/imagine introuvable : ouvrez-le (connecté), rechargez-le (F5), puis relancez. " + ((ping && ping.error) || "") };
          return send(payload);
        }).then(function (r) {
          if (job.signal && job.signal.aborted) throw { display: "Annulé.", cancelled: true };
          if (!r || !r.ok) throw { display: "Grok : " + ((r && r.error) || "échec de la génération") };
          if (r.surplus > 0) {
            // Garde-fou : Grok a lancé plus de vidéos que demandé pour un seul envoi → plus aucun envoi jusqu'à réactivation
            self.cfg.grokBloque = "Grok a généré " + r.surplus + " vidéo(s) en trop le " + new Date().toLocaleString("fr-FR") + ".";
            self.cfg.save(); self.refresh();
            self.core.toast("⚠ Grok a généré " + r.surplus + " vidéo(s) de plus que demandé : Grok est bloqué (⚙ → Moteurs pour le réactiver).", "err");
            job.warning = "Grok a généré " + r.surplus + " vidéo(s) en trop — Grok bloqué";
          }
          var url = (r.urls || [])[0];
          if (!url) throw { display: "Grok n'a renvoyé aucune vidéo." };
          job.info = "Récupération de la vidéo…"; A.emitJob(job);
          return fetch(url).then(function (x) { if (!x.ok) throw { display: "Vidéo Grok illisible (HTTP " + x.status + ")." }; return x.blob(); });
        }).then(function (blob) { return self.storeTake(blob, "video", "grok"); })
          .then(function (take) { takes.push(take); if (n < wanted) return one(n + 1); });
      }
      return one(1).then(function () { return takes; });
    }).finally(function () { if (job.signal) job.signal.removeEventListener("abort", onAbort); });
  },

  storeTake: function (blob, kind, source) {
    var A = this.A, take = { id: A.uid(), kind: kind || "image", createdAt: Date.now(), remoteUrl: "", local: true, source: source };
    return AgnesStore.putBlob("take:" + take.id, blob).then(function () {
      if (take.kind === "image") return A.makeThumb(blob, 320);
      var u = URL.createObjectURL(blob);
      return A.videoFrame(u, "first", 640).then(function (fb) { URL.revokeObjectURL(u); return A.makeThumb(fb, 320); });
    }).catch(function () { return null; }).then(function (thumb) { take.thumb = thumb; return take; });
  }
});
