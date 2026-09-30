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
//   « Flow » (Google Flow, vos crédits Google) : seulement dans Agnes ouverte depuis Lumina, avec le service FlowKit local
//     lancé (127.0.0.1:8100) et un onglet flow.google.com connecté. Agnes envoie ses demandes à l'API HTTP de FlowKit
//     (composant externe sous licence MIT, installé à part : aucun de son code n'est repris ici). Images envoyées en
//     base64, 1 vidéo par envoi, jamais de renvoi automatique ; durée 4, 6, 8 ou 10 s (Omni Flash), formats 9:16 ou 16:9.
// Tout le reste (file d'attente, prises, image validée → animation, montage) ne change pas.
AgnesPlugins.register("moteurs", {
  name: "Moteurs de génération",
  version: "1.2",
  GROK_RATIOS: ["9:16", "16:9", "1:1"],
  VIDEOS: ["agnes", "grok", "flow"],
  FLOW_ASPECT: { "9:16": "VIDEO_ASPECT_RATIO_PORTRAIT", "16:9": "VIDEO_ASPECT_RATIO_LANDSCAPE" },
  FLOWKIT: "http://127.0.0.1:8100",

  init: function (core) {
    var self = this, A = window.AgnesApp;
    this.core = core; this.A = A;
    this.cfg = core.pluginSettings("moteurs", { image: "agnes", video: "agnes", pont: "http://127.0.0.1:8177", grokRes: "720p", grokQuality: "quality",
      flowkit: this.FLOWKIT, flowProjet: "", flowModel: "omni_flash", flowRes: "720p", flowMode: "manuel" });
    this.grokQueue = Promise.resolve();   // un seul onglet Grok : une vidéo à la fois
    this.flowQueue = Promise.resolve();   // Flow aussi : une vidéo à la fois, pour suivre les crédits pas à pas
    if (this.flowStore()) {
      this.flowProjectsLoad();
      if (chrome.storage.onChanged) chrome.storage.onChanged.addListener(function (ch, area) {
        if (area === "local" && ch[self.FLOW_PROJECTS_KEY]) self.flowProjectsLoad();
      });
      // Liste modifiée dans l'autre navigateur (par le pont) : relue toutes les 30 s
      setInterval(function () { self.flowProjectsLoad(); }, 30000);
    }
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
      // Une reprise (vidéo Agnes interrompue par un rechargement) reste chez Agnes : jamais renvoyée à Grok ni à Flow
      if (job && job.resume) return agnesVideo(job, shot, proj).then(tag);
      if (self.cfg.video === "grok") return self.grokVideo(job, shot, proj);
      if (self.cfg.video === "flow") return self.flowVideo(job, shot, proj);
      return agnesVideo(job, shot, proj).then(tag);
    };
    // Badges en tête des cartes : moteur de la prochaine image / vidéo, clic = changer (pour tous les plans)
    A.cardEngineBadge = function (shot) {
      var out = "";
      if (A.isTwoStep(shot) || A.modeKind(shot.mode) === "image") {
        var gpt = self.cfg.image === "chatgpt";
        out += '<button type="button" class="mode-badge engine-badge" data-engine="image" style="cursor:pointer;' + (gpt ? "border-color:#10a37f;color:#10a37f;" : "") +
          '" title="Prochaine image générée par ' + self.label("image") + ' — cliquer pour changer (tous les plans)">Image : ' + (gpt ? "ChatGPT" : "Agnes") + "</button>";
      }
      if (A.modeKind(shot.mode) === "video") {
        var color = { grok: "#c9a227", flow: "#4285f4" }[self.cfg.video];
        out += '<button type="button" class="mode-badge engine-badge" data-engine="video" style="cursor:pointer;' + (color ? "border-color:" + color + ";color:" + color + ";" : "") +
          '" title="Prochaine vidéo générée par ' + self.label("video") + ' — cliquer pour changer (tous les plans)">Vidéo : ' + self.shortName(self.cfg.video) + "</button>";
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
      return (steps.image && self.cfg.image !== "chatgpt") || (steps.video && self.cfg.video === "agnes");
    };

    this.renderSettings();
    this.badge = core.ui.addToolbarButton("storyboard", "", function () { self.toggle("image"); });
    this.vbadge = core.ui.addToolbarButton("storyboard", "", function () { self.toggle("video"); });
    this.refresh();
  },

  toggle: function (what) {
    if (what === "video") {
      // Tour : Agnes → Grok → Flow → Agnes. Grok et Flow demandent Agnes ouverte depuis Lumina.
      if (!this.canGrok()) {
        if (this.cfg.video === "agnes") return this.core.toast("Grok et Flow ne sont disponibles que dans Agnes ouverte depuis Lumina (onglet Agnes du panneau Lumina).", "err");
        this.cfg.video = "agnes";
      } else this.cfg.video = this.VIDEOS[(this.VIDEOS.indexOf(this.cfg.video) + 1) % this.VIDEOS.length];
    } else this.cfg.image = this.cfg.image === "chatgpt" ? "agnes" : "chatgpt";
    this.cfg.save(); this.refresh();
    this.core.toast((what === "video" ? "Vidéos générées par " : "Images générées par ") + this.label(what) + ".", "ok");
  },

  label: function (what) {
    if (what === "video") return { grok: "Grok (abonnement)", flow: "Google Flow (crédits Google)" }[this.cfg.video] || "Agnes Video (gratuit)";
    return this.cfg.image === "chatgpt" ? "ChatGPT (abonnement)" : "Agnes (gratuit)";
  },
  shortName: function (video) { return { grok: "Grok", flow: "Flow" }[video] || "Agnes"; },

  canGrok: function () { return typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage); },
  // Flow : même condition (l'onglet Flow est piloté par Lumina) ; le service FlowKit est vérifié à chaque envoi.
  canFlow: function () { return this.canGrok(); },

  refresh: function () {
    var self = this;
    if (this.badge) { this.badge.textContent = "Images : " + (this.cfg.image === "chatgpt" ? "ChatGPT" : "Agnes"); this.badge.title = "Cliquer pour changer de moteur d'image"; }
    if (this.vbadge) { this.vbadge.textContent = "Vidéos : " + this.shortName(this.cfg.video); this.vbadge.title = "Cliquer pour changer de moteur vidéo (Agnes, Grok, Flow)"; }
    var sel = document.getElementById("motImage"); if (sel) sel.value = this.cfg.image;
    var vsel = document.getElementById("motVideo"); if (vsel) vsel.value = this.cfg.video;
    var gopt = document.getElementById("motGrokOpts"); if (gopt) gopt.style.display = this.cfg.video === "grok" ? "" : "none";
    var fopt = document.getElementById("motFlowOpts"); if (fopt) fopt.style.display = this.cfg.video === "flow" ? "" : "none";
    // Garde-fous : un moteur bloqué n'envoie plus rien jusqu'à sa réactivation ici
    [["grokBloque", "motGrokBloc", "Grok"], ["flowBloque", "motFlowBloc", "Flow"]].forEach(function (x) {
      var el = document.getElementById(x[1]); if (!el) return;
      var msg = self.cfg[x[0]];
      el.style.display = msg ? "" : "none";
      el.innerHTML = msg ? x[2] + " bloqué : " + self.A.esc(msg) + ' <button class="small-btn" type="button">Réactiver ' + x[2] + "</button>" : "";
      var bt = el.querySelector("button");
      if (bt) bt.onclick = function () { delete self.cfg[x[0]]; self.cfg.save(); self.refresh(); self.core.toast(x[2] + " réactivé.", "ok"); };
    });
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
      '<button class="small-btn" id="motPontDel" type="button" title="Retirer cette adresse de la liste">Retirer</button></div>' +
      '<datalist id="motPontList"></datalist>' +
      '<p class="hint">Choisissez une adresse dans la liste, ou tapez-en une nouvelle : elle y est ajoutée.</p></div>' +
      '<button class="small-btn" id="motTest" type="button">Tester le pont</button> <span class="hint" id="motTestOut"></span>' +
      '<div class="field" style="margin-top:14px"><label for="motVideo">Vidéos (animation des plans)</label><select id="motVideo">' +
      '<option value="agnes">Agnes Video 2.5 — gratuit</option><option value="grok">Grok Imagine (votre abonnement) — Agnes ouverte depuis Lumina</option>' +
      '<option value="flow">Google Flow (vos crédits Google) — Agnes ouverte depuis Lumina + FlowKit</option></select>' +
      '<p class="hint">Grok : gardez un onglet <b>grok.com/imagine</b> ouvert et connecté ; il passe au premier plan pendant chaque génération. Une vidéo à la fois. Durée arrondie à 6, 10 ou 15 s ; formats 9:16, 16:9 ou 1:1. Image de départ et références envoyées sans imgbb.' +
      (this.canGrok() ? '' : ' <b>Indisponible ici</b> : ouvrez Agnes depuis l\'onglet Agnes de Lumina.') + '</p></div>' +
      '<div class="hint" id="motGrokBloc" style="display:none;color:var(--danger)"></div>' +
      '<div class="row-inline" id="motGrokOpts"><label class="inline">Résolution <select id="motGrokRes"><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>' +
      '<label class="inline">Qualité <select id="motGrokQ"><option value="speed">Rapide</option><option value="quality">Qualité</option></select></label></div>' +
      '<div class="hint" id="motFlowBloc" style="display:none;color:var(--danger)"></div>' +
      '<div id="motFlowOpts" style="display:none">' +
      '<p class="hint">Flow : lancez le service FlowKit (dossier <code>flowkit-local</code>) et gardez un onglet <b>flow.google.com</b> ouvert et connecté, Flow activé dans Lumina. ' +
      'Une vidéo à la fois, 1 vidéo par envoi, jamais de renvoi automatique. Durée arrondie à 4, 6, 8 ou 10 s ; formats 9:16 ou 16:9. ' +
      'Début + fin, scène verrouillée et références (7 au plus) : Omni Flash seulement. Veo 3.1 : image de départ seule, 8 s.</p>' +
      '<div class="field"><label for="motFlowMode">Mode Flow</label><select id="motFlowMode">' +
      '<option value="manuel">Manuel : Agnes prépare, vous cliquez Générer puis Télécharger dans Flow (recommandé)</option>' +
      '<option value="auto">Automatique par FlowKit (refusé par Google depuis le 22/09/2026)</option></select>' +
      '<p class="hint">Manuel : l\'image de départ est envoyée dans le projet Flow et le prompt copié ; la vidéo téléchargée est reprise dans ' +
      'Téléchargements par le pont, rangée dans le dossier Production de la carte (extension Classement) puis mise dans la carte.</p></div>' +
      '<div class="field"><label for="motFlowProjet">Projet Flow (liste partagée avec l\'onglet Google Flow de Lumina)</label>' +
      '<div class="row-inline"><select id="motFlowProjet" style="flex:1;min-width:0"></select>' +
      '<button class="small-btn" id="motFlowOpen" type="button" title="Ouvrir ce projet dans l\'onglet Google Flow (jamais un deuxième onglet)">Ouvrir</button>' +
      '<button class="small-btn" id="motFlowDel" type="button" title="Retirer ce projet de la liste (rien n\'est supprimé chez Google)">Retirer</button></div>' +
      '<details id="motFlowAdd"><summary class="hint" style="cursor:pointer">Ajouter un projet</summary>' +
      '<input type="text" id="motFlowNom" placeholder="Nom (ex. Marketing, compte Pro 1)">' +
      '<input type="text" id="motFlowUrl" placeholder="Lien du projet (barre d\'adresse de Flow) ou identifiant">' +
      '<input type="text" id="motFlowCompte" placeholder="Compte Google du projet (adresse e-mail)">' +
      '<select id="motFlowTier"><option value="">Abonnement du compte…</option><option value="PAYGATE_TIER_ONE">Gratuit</option><option value="PAYGATE_TIER_TWO">Pro</option></select>' +
      '<button class="small-btn" id="motFlowAjout" type="button">Ajouter à la liste</button></details>' +
      '<p class="hint" id="motFlowWarn" style="color:var(--danger)" hidden></p>' +
      '<p class="hint">Google Flow ne doit être ouvert qu\'une seule fois, tous navigateurs confondus : Lumina vérifie ce navigateur avant chaque envoi, mais ne voit pas les autres navigateurs sans Lumina.</p></div>' +
      '<div class="row-inline"><label class="inline">Modèle <select id="motFlowModel"><option value="omni_flash">Omni Flash</option><option value="veo">Veo 3.1</option></select></label>' +
      '<label class="inline">Résolution <select id="motFlowRes"><option value="360p">360p</option><option value="720p">720p</option></select></label></div>' +
      '<div class="field"><label for="motFlowkit">Adresse du service FlowKit</label><input type="text" id="motFlowkit" autocomplete="off"></div>' +
      '<button class="small-btn" id="motFlowTest" type="button">Tester FlowKit</button> <button class="small-btn" id="motFlowCredits" type="button">Voir mes crédits Flow</button> ' +
      '<span class="hint" id="motFlowOut"></span></div>';
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
      if (vsel.value !== "agnes" && !self.canGrok()) {
        var nom = self.shortName(vsel.value); vsel.value = "agnes";
        return self.core.toast(nom + " n'est disponible que dans Agnes ouverte depuis Lumina.", "err");
      }
      self.cfg.video = vsel.value; self.cfg.save(); self.refresh();
    });
    res.addEventListener("change", function () { self.cfg.grokRes = res.value; self.cfg.save(); });
    q.addEventListener("change", function () { self.cfg.grokQuality = q.value; self.cfg.save(); });
    // Flow
    var fp = card.querySelector("#motFlowProjet"), fm = card.querySelector("#motFlowModel"), fr = card.querySelector("#motFlowRes");
    var fk = card.querySelector("#motFlowkit"), fout = card.querySelector("#motFlowOut");
    fm.value = this.cfg.flowModel || "omni_flash"; fr.value = this.cfg.flowRes || "720p"; fk.value = this.flowBase();
    var fmode = card.querySelector("#motFlowMode");
    fmode.value = this.cfg.flowMode === "auto" ? "auto" : "manuel";
    fmode.addEventListener("change", function () { self.cfg.flowMode = fmode.value; self.cfg.save(); });
    this.renderFlowProjects();
    fp.addEventListener("change", function () {
      self.flowProjects.actif = fp.value; self.flowProjectsSave(); self.flowVerify();
    });
    card.querySelector("#motFlowOpen").addEventListener("click", function () {
      var p = self.flowActive(); if (!p) return;
      self.flowMsg({ type: "FLOW_OPEN_PROJECT", url: self.flowProjectUrl(p) }, 5000).then(function (r) {
        if (!r || !r.ok) self.flowWarn((r && r.warning) || "Ouverture impossible : Lumina ne répond pas.");
        else setTimeout(function () { self.flowVerify(); }, 4000);
      });
    });
    card.querySelector("#motFlowDel").addEventListener("click", function () {
      var p = self.flowActive();
      if (!p || !confirm("Retirer « " + p.nom + " » de la liste ? (Rien n'est supprimé chez Google Flow.)")) return;
      self.flowProjects.list = self.flowProjects.list.filter(function (x) { return x.id !== p.id; });
      self.flowProjects.actif = self.flowProjects.list.length ? self.flowProjects.list[0].id : "";
      self.flowProjectsSave();
    });
    card.querySelector("#motFlowAjout").addEventListener("click", function () {
      var v = function (id) { return String(card.querySelector(id).value || "").trim(); };
      var raw = v("#motFlowUrl"), id = (raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1];
      var nom = v("#motFlowNom"), compte = v("#motFlowCompte").toLowerCase(), tier = v("#motFlowTier");
      if (!nom || !id || !tier) return self.flowWarn("Pour ajouter un projet : un nom, le lien du projet (ou son identifiant) et l'abonnement du compte.");
      if (compte && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(compte)) return self.flowWarn("Adresse du compte Google non reconnue.");
      id = id.toLowerCase();
      self.flowProjects.list = self.flowProjects.list.filter(function (x) { return x.id !== id; })
        .concat([{ id: id, nom: nom.slice(0, 60), url: /^https:\/\//.test(raw) ? raw : "", compte: compte, tier: tier }]);
      self.flowProjects.actif = id; self.flowProjectsSave();
      ["#motFlowNom", "#motFlowUrl", "#motFlowCompte", "#motFlowTier"].forEach(function (x) { card.querySelector(x).value = ""; });
      card.querySelector("#motFlowAdd").removeAttribute("open"); self.flowWarn("");
    });
    fm.addEventListener("change", function () { self.cfg.flowModel = fm.value; self.cfg.save(); });
    fr.addEventListener("change", function () { self.cfg.flowRes = fr.value; self.cfg.save(); });
    fk.addEventListener("change", function () {
      var u = fk.value.trim().replace(/\/+$/, "").replace(/\/api$/, "");
      if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
      self.cfg.flowkit = u || self.FLOWKIT; fk.value = self.cfg.flowkit; self.cfg.save();
    });
    card.querySelector("#motFlowTest").addEventListener("click", function () {
      fout.textContent = "…";
      self.flowGet("/flow/status").then(function (j) {
        fout.textContent = !j.connected ? "FlowKit répond, mais Lumina n'y est pas connecté : activez Flow dans Lumina et ouvrez flow.google.com."
          : "FlowKit prêt. Projet choisi : " + ((self.flowActive() || {}).nom || "aucun — ajoutez-en un ci-dessus") + ".";
        self.flowVerify();
      }, function (e) { fout.textContent = e.display || String(e); });
    });
    card.querySelector("#motFlowCredits").addEventListener("click", function () {
      fout.textContent = "…";
      self.flowGet("/flow/credits").then(function (j) {
        var n = j && (j.credits != null ? j.credits : j.remainingCredits);
        // Nouvelle version de Flow : FlowKit ne lit plus le solde, seulement le niveau d'abonnement configuré
        fout.textContent = n != null ? "Crédits Flow : " + n + "." :
          "Solde non lisible par FlowKit : regardez-le sur flow.google.com (menu du compte).";
      }, function (e) { fout.textContent = e.display || String(e); });
    });
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
        .then(function (j) { out.textContent = j.ok ? "Pont joignable." : "Réponse inattendue."; })
        .catch(function () { out.textContent = "Pont injoignable : lancez lancer_pont.bat."; });
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
    // Image intermédiaire (facultative, rôle Grok « Image intermédiaire ») : ex. le profil de la recette
    // « arc face → profil → face » (29/09/2026), la face étant en « Boucle ».
    var mid = (m === "i2v" || m === "frames") && shot.midRef ? shot.midRef : "";
    return Promise.all([
      Promise.all(starts.map(function (r) { return self.startImage(r, shot, proj); })),
      Promise.all((withRefs ? shot.ingredients || [] : []).slice(0, 7).map(function (id) { return self.libData(proj, id, 1024); })),
      mid ? self.startImage(mid, shot, proj) : Promise.resolve(null)
    ]).then(function (r) {
      var imgs = r[0].filter(Boolean), refs = r[1].filter(Boolean), midImg = r[2];
      if (starts.length && imgs.length !== starts.length) throw { display: "Image de départ introuvable pour ce plan." };
      if (mid && !midImg) throw { display: "Image intermédiaire introuvable dans la Bibliothèque." };
      // Scène verrouillée (même image au début et à la fin) : UNE image en rôle Grok « Boucle » (début et fin).
      // Début + fin distincts (mode « frames ») : « Première » + « Dernière ». Sinon « Première » seule.
      var loop = m === "i2v" && shot.i2v === "anchor" && imgs.length === 1;
      var pair = m === "frames" ? "startEnd" : imgs.length ? "startOnly" : "";
      if (pair === "startEnd" && imgs.length === 1) imgs = [imgs[0], imgs[0]];
      var grokMode = m === "ingr_v" ? "ingredients" : imgs.length ? "frame2v" : "t2v";
      var attachments = imgs.map(function (u, i) { return { url: u, role: loop ? "loop" : i === 1 ? "last" : "first", name: "Scène " + (i + 1) }; })
        .concat(midImg ? [{ url: midImg, role: "middle", name: "Image intermédiaire" }] : [])
        .concat(refs.map(function (x) { return { url: x.data, role: "reference", name: x.nom }; }));
      // Règles de tous les projets : jeu subtil, regard vers l'interlocuteur, image nette, pas de musique
      var prompt = A.buildPrompt(shot, proj);
      if (!/subtle/i.test(prompt)) prompt += ". Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to";
      if (!/no film grain/i.test(prompt)) prompt += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!/no music/i.test(prompt)) prompt += ". No music. No song. Ambient sound only";
      // Grok : UNE vidéo par envoi (chaque génération est décomptée). « Sorties » > 1 est ignoré, avec un avertissement.
      var res = self.cfg.grokRes || "720p", wanted = 1, takes = [];
      if ((Number(shot.outputs) || 1) > 1) {
        job.warning = "Grok : 1 vidéo par envoi (Sorties = " + shot.outputs + " ignoré pour ne pas décompter de générations en plus).";
        A.emitJob(job);
      }
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
            self.core.toast("Grok a généré " + r.surplus + " vidéo(s) de plus que demandé : Grok est bloqué (⚙ → Moteurs pour le réactiver).", "err");
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

  // =========================================================
  // VIDÉOS PAR GOOGLE FLOW (service FlowKit local → onglet flow.google.com piloté par Lumina)
  // =========================================================
  flowBase: function () { return String(this.cfg.flowkit || this.FLOWKIT).replace(/\/+$/, ""); },

  // Lien de projet Flow (…/project/<uuid>) ou identifiant seul → identifiant ; "" si vide ; null si non reconnu
  flowProjectId: function (v) {
    v = String(v || "").trim();
    if (!v) return "";
    var m = v.match(/project\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) ||
      v.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    return m ? m[1].toLowerCase() : null;
  },

  // Omni Flash : 4, 6, 8 ou 10 s. Veo : 8 s, non réglable.
  flowDuration: function (sec, model) {
    if (model === "veo") return 8;
    var d = Number(sec) || 8;
    return d <= 5 ? 4 : d <= 7 ? 6 : d <= 9 ? 8 : 10;
  },

  // Appel à l'API de FlowKit (routes sous /api). Erreur { display, network } lisible par l'utilisatrice.
  flowCall: function (method, path, body, signal) {
    var base = this.flowBase(), init = { method: method, signal: signal };
    if (method !== "GET") { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(body || {}); }
    return fetch(base + "/api" + path, init).catch(function (e) {
      if (e && e.name === "AbortError") throw { display: "Annulé.", cancelled: true };
      throw { display: "Service FlowKit injoignable (" + base + ") : lancez-le (dossier flowkit-local), puis relancez.", network: true };
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.ok) return j || {};
        var d = j && (j.detail || j.error);
        d = typeof d === "string" ? d : d ? JSON.stringify(d) : "HTTP " + r.status;
        if (r.status === 503 || /not connected/i.test(d)) d = "Lumina n'est pas connecté à FlowKit : activez Flow dans Lumina et gardez flow.google.com ouvert et connecté.";
        else if (/FLOW_COOLDOWN/.test(d)) d = "pause anti-restriction en cours dans Lumina, rien n'a été envoyé. Relancez après la pause (onglet Google Flow de Lumina).";
        throw { display: "Flow : " + d, status: r.status };
      });
    });
  },
  flowGet: function (path) { return this.flowCall("GET", path); },

  // --- Liste des projets Flow, partagée avec l'onglet Google Flow de Lumina (même clé chrome.storage.local,
  // lue aussi par flow/side_panel.js) : { list: [{ id, nom, url, compte, tier }], actif }. Choisir un projet
  // ici le choisit aussi dans Lumina, et inversement : Agnes et Lumina travaillent toujours sur le même projet.
  FLOW_PROJECTS_KEY: "luminaFlowProjects",
  flowProjects: { list: [], actif: "" },
  flowStore: function () { return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null; },
  flowActive: function () { var a = this.flowProjects.actif; return this.flowProjects.list.find(function (p) { return p.id === a; }) || null; },
  flowProjectUrl: function (p) { return p.url || "https://labs.google/fx/tools/flow/project/" + p.id; },
  // Liste de référence gardée par le pont (GET/POST /flow/projets), commune aux deux profils Chrome (« Principal » et
  // « Flow seulement ») ; la copie du navigateur (chrome.storage.local) sert si le pont est arrêté.
  pontJson: function (path, init) {
    var url = String(this.cfg.pont || "http://127.0.0.1:8177").replace(/\/+$/, "") + path;
    return Promise.resolve().then(function () { return fetch(url, init); })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : null; }); })
      .catch(function () { return null; });
  },
  flowProjectsLoad: function () {
    var self = this, st = this.flowStore();
    if (!st) return Promise.resolve(this.flowProjects);
    return new Promise(function (resolve) {
      st.get(self.FLOW_PROJECTS_KEY, function (d) { resolve(d); });
    }).then(function (d) {
      return self.pontJson("/flow/projets").then(function (pont) { return { d: d, pont: pont }; });
    }).then(function (x) {
      return new Promise(function (resolve) {
        var d = x.d, pont = x.pont;
        var v = (d || {})[self.FLOW_PROJECTS_KEY] || {};
        self.flowProjects = { list: Array.isArray(v.list) ? v.list : [], actif: v.actif || "" };
        if (pont && Array.isArray(pont.list)) {
          if (!pont.maj && self.flowProjects.list.length) self.flowProjectsSave();   // première fois : la liste d'ici va au pont
          else self.flowProjects = { list: pont.list, actif: pont.actif || "" };
        }
        // Ancien réglage d'Agnes (projet saisi à la main) : rejoint la liste une fois, abonnement à préciser
        if (!self.flowProjects.list.length && self.cfg.flowProjet) {
          self.flowProjects = { list: [{ id: self.cfg.flowProjet, nom: "Projet Agnes", url: "", compte: "", tier: "" }], actif: self.cfg.flowProjet };
          delete self.cfg.flowProjet; self.cfg.save(); self.flowProjectsSave();
        }
        self.renderFlowProjects(); resolve(self.flowProjects);
      });
    });
  },
  flowProjectsSave: function () {
    var self = this, st = this.flowStore(), o = {}, v = { list: this.flowProjects.list, actif: this.flowProjects.actif };
    o[this.FLOW_PROJECTS_KEY] = v;
    if (st) st.set(o);
    this.renderFlowProjects();
    this.pontJson("/flow/projets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) })
      .then(function (r) { if (!r) self.flowWarn("Pont local injoignable (lancer_pont.bat) : la liste n'est enregistrée que dans ce navigateur."); });
  },
  // Rôle du navigateur où Agnes est ouverte (réglé dans la petite fenêtre Lumina) : tout | principal | flow
  flowRole: function () {
    var st = this.flowStore();
    if (!st) return Promise.resolve("tout");
    return new Promise(function (resolve) {
      st.get("luminaRole", function (d) { var r = d && d.luminaRole; resolve(r === "principal" || r === "flow" ? r : "tout"); });
    });
  },
  renderFlowProjects: function () {
    var sel = document.getElementById("motFlowProjet"), A = this.A, a = this.flowActive();
    if (!sel) return;
    var tierName = function (t) { return t === "PAYGATE_TIER_TWO" ? "Pro" : t === "PAYGATE_TIER_ONE" ? "Gratuit" : "abonnement ?"; };
    sel.innerHTML = this.flowProjects.list.length ? this.flowProjects.list.map(function (p) {
      return '<option value="' + A.esc(p.id) + '">' + A.esc(p.nom) + " — " + A.esc(p.compte || "compte ?") + " (" + tierName(p.tier) + ")</option>";
    }).join("") : '<option value="">Aucun projet : ajoutez-en un ci-dessous</option>';
    sel.value = a ? a.id : "";
  },
  // Message au service de Lumina, avec délai : null si Lumina ne répond pas
  flowMsg: function (msg, ms) {
    return new Promise(function (resolve) {
      var done = false, finish = function (r) { if (!done) { done = true; resolve(r || null); } };
      try { chrome.runtime.sendMessage(msg, function (r) { void chrome.runtime.lastError; finish(r); }); } catch (e) { finish(null); }
      setTimeout(function () { finish(null); }, ms || 1500);
    });
  },
  // Avertissement en simple texte sous la liste (pas d'encadré)
  flowWarn: function (text) {
    var el = document.getElementById("motFlowWarn"); if (!el) return;
    el.textContent = text || ""; el.hidden = !text;
  },
  // Bilan de Lumina : une seule page Flow ouverte, pas d'autre navigateur relié à FlowKit, bon compte
  flowVerify: function () {
    var self = this, p = this.flowActive(), compte = (p && p.compte) || "";
    return this.flowRole().then(function (role) {
      if (role === "flow") return { blocking: true, warning: "Ce navigateur est en rôle « Flow seulement » : ouvrez Agnes dans le navigateur Principal. Rien n'est envoyé." };
      if (role === "principal") return self.flowVerifyRemote(compte);
      return self.flowMsg({ type: "FLOW_CHECK", compte: compte }, 8000).then(function (r) {
        return r || { blocking: true, warning: "Lumina ne répond pas à la vérification de Google Flow : rechargez Lumina (chrome://extensions), puis Agnes. Rien n'est envoyé." };
      });
    }).then(function (r) { self.flowWarn(r.warning || ""); return r; });
  },
  // Rôle « principal » : Google Flow tourne dans l'autre profil Chrome, qui dépose son bilan au pont (/flow/etat)
  // toutes les ~25 s et à chaque changement d'onglet. Bilan absent ou trop ancien = rien n'est envoyé.
  flowVerifyRemote: function (compte) {
    return this.pontJson("/flow/etat").then(function (j) {
      var e = j && j.etat, age = j && j.age_s;
      if (!j) return { blocking: true, warning: "Pont local injoignable (lancer_pont.bat) : impossible de vérifier le navigateur Flow. Rien n'est envoyé." };
      if (!e || age == null || age > 60) return { blocking: true, warning: "Le navigateur Flow ne donne pas de nouvelles" + (age != null ? " depuis " + Math.round(age) + " s" : "") +
        " : ouvrez Chrome avec le compte Flow, Lumina en rôle « Flow seulement » et Flow activé (onglet Google Flow du panneau), puis relancez. Rien n'est envoyé." };
      if (!e.flowActive) return { blocking: true, warning: "Flow n'est pas activé dans le navigateur Flow (onglet Google Flow du panneau Lumina, interrupteur « Connecté »). Rien n'est envoyé." };
      var email = String(e.email || "").toLowerCase(), want = String(compte || "").toLowerCase(), warnings = [];
      if (e.blocking && e.warning) warnings.push(e.warning);
      if (want && email && email !== want) warnings.push("Le compte ouvert dans Google Flow (" + email + ") n'est pas celui du projet (" + want + ") : changez de projet dans la liste ou de compte dans Flow, puis relancez.");
      return { blocking: warnings.length > 0, warning: warnings.join(" "), email: email, accountChecked: Boolean(want && email), tabs: e.tabs, pace: e.pace, remote: true };
    });
  },
  flowPost: function (path, body, signal) { return this.flowCall("POST", path, body, signal); },

  // Rythme anti-restriction de Lumina (flow/background.js) : pause en cours, limites signalées récemment.
  // null si Lumina ne répond pas (ancienne version) : l'envoi reste alors espacé par FlowKit seul.
  flowPace: function () { return this.flowMsg({ type: "PACE_STATUS" }, 1500); },

  flowBlock: function (msg) {
    this.cfg.flowBloque = msg + " (" + new Date().toLocaleString("fr-FR") + ")";
    this.cfg.save(); this.refresh();
    this.core.toast("Flow bloqué par sécurité : " + msg + " Vérifiez le projet Flow, puis réactivez Flow dans ⚙ → Moteurs.", "err");
  },

  flowVideo: function (job, shot, proj) {
    var self = this, A = this.A, run = this.flowQueue.then(function () { return self.flowVideoNow(job, shot, proj); });
    this.flowQueue = run.catch(function () { });
    job.info = "En attente de Flow…"; A.emitJob(job);
    return run;
  },

  flowVideoNow: function (job, shot, proj) {
    if (this.cfg.flowMode !== "auto") return this.flowManualNow(job, shot, proj);
    var self = this, A = this.A, m = shot.mode, notes = [];
    var warn = function (t) { notes.push(t); job.warning = notes.join(" · "); A.emitJob(job); };
    var aborted = function () { return job.signal && job.signal.aborted; };
    if (!this.canFlow()) return Promise.reject({ display: "Flow n'est disponible que dans Agnes ouverte depuis Lumina (onglet Agnes). Repassez les vidéos sur Agnes (⚙ → Moteurs)." });
    if (this.cfg.flowBloque) return Promise.reject({ display: "Flow est bloqué par sécurité : " + this.cfg.flowBloque + " Vérifiez le projet Flow, puis réactivez-le dans ⚙ → Moteurs de génération." });
    if (aborted()) return Promise.reject({ display: "Annulé.", cancelled: true });
    job.info = "Flow : vérification du service FlowKit…"; A.emitJob(job);

    var starts = m === "frames" ? [shot.startRef, shot.endRef] : m === "i2v" ? [shot.sourceRef] : [];
    var withRefs = m === "t2v" || m === "ingr_v" || (m === "i2v" && shot.i2v === "refs");
    var ingr = withRefs ? shot.ingredients || [] : [], project = "", tier = "";
    // Projet de la liste partagée avec Lumina (relue à chaque envoi : jamais un projet sans rapport)
    return this.flowProjectsLoad().then(function () {
      var entry = self.flowActive();
      if (!entry) throw { display: "Aucun projet Flow choisi : ajoutez-en un dans ⚙ → Moteurs (liste partagée avec l'onglet Google Flow de Lumina)." };
      if (!entry.tier) throw { display: "Précisez l'abonnement (Gratuit ou Pro) du compte du projet « " + entry.nom + " » dans ⚙ → Moteurs (retirez-le puis ajoutez-le à nouveau)." };
      project = entry.id; tier = entry.tier;
      return self.flowGet("/flow/status");
    }).then(function (st) {
      if (!st.connected) throw { display: "Lumina n'est pas connecté à FlowKit : activez Flow dans Lumina et gardez flow.google.com ouvert et connecté." };
      job.info = "Flow : vérification des pages et du compte Google Flow…"; A.emitJob(job);
      return self.flowVerify();
    }).then(function (chk) {
      if (chk.blocking) throw { display: chk.warning };
      if (!chk.accountChecked) warn("Compte Google Flow non vérifié (" + (self.flowActive().compte ? "adresse non lisible dans la page Flow" : "aucun compte indiqué pour ce projet") + ")");
      return chk.remote ? chk.pace || null : self.flowPace();
    }).then(function (p) {
      // Marge de sécurité : jamais d'envoi pendant une pause anti-restriction (le compte serait classé « robot »)
      if (p && p.cooldownLeftMs > 0) throw { display: "Flow est en pause anti-restriction (" + (p.lastReason || "limite signalée par Flow") + ") : reprise dans " +
        Math.ceil(p.cooldownLeftMs / 1000) + " s. Rien n'a été envoyé ; relancez après la pause." };
      if (p && p.strikes > 0) warn("Flow a signalé une limite récemment : envoi espacé par Lumina (rythme " + (p.preset || "normal") + ")");
      job.info = "Flow : préparation des images…"; A.emitJob(job);
      return Promise.all([
        Promise.all(starts.map(function (r) { return self.startImage(r, shot, proj); })),
        Promise.all(ingr.slice(0, 7).map(function (id) { return self.libData(proj, id, 1024); }))
      ]);
    }).then(function (r) {
      var imgs = r[0].filter(Boolean), refs = r[1].filter(Boolean);
      if (starts.length && imgs.length !== starts.length) throw { display: "Image de départ introuvable pour ce plan." };
      if (shot.midRef && (m === "i2v" || m === "frames")) warn("Flow n'a pas d'image intermédiaire (propre à Grok) : ignorée");
      if (ingr.length > 7) warn("Flow : 7 références au plus, " + (ingr.length - 7) + " ignorée(s)");
      if (imgs.length && refs.length) { warn("Flow : image de départ OU références, pas les deux — références ignorées"); refs = []; }
      // Scène verrouillée : la même image au début et à la fin (Omni Flash début + fin)
      var loop = m === "i2v" && shot.i2v === "anchor" && imgs.length === 1;
      var useRefs = !imgs.length && refs.length > 0;
      var model = self.cfg.flowModel === "veo" && imgs.length === 1 && !loop ? "veo" : "omni_flash";
      if (self.cfg.flowModel === "veo" && model !== "veo") warn("Veo 3.1 : image de départ seule — ce plan part en Omni Flash");
      if ((Number(shot.outputs) || 1) > 1) warn("Flow : 1 vidéo par envoi (Sorties = " + shot.outputs + " ignoré pour ne pas décompter de crédits en plus)");
      var ratio = A.nearestRatio(shot.aspect || proj.aspect || "9:16", ["9:16", "16:9"]);
      var duration = self.flowDuration(shot.duration, model), res = self.cfg.flowRes === "360p" ? "360p" : "720p";
      // Règles de tous les projets : jeu subtil, regard vers l'interlocuteur, image nette, pas de musique
      var prompt = A.buildPrompt(shot, proj);
      if (!/subtle/i.test(prompt)) prompt += ". Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to";
      if (!/no film grain/i.test(prompt)) prompt += ". Tack-sharp, crisp image, no film grain, no noise";
      if (!/no music/i.test(prompt)) prompt += ". No music. No song. Ambient sound only";

      // Envoi des images à Flow (sans crédit) : une fois chacune, dans l'ordre
      var upload = function (dataUrl, name) {
        var mime = (String(dataUrl).match(/^data:([^;,]+)/) || [])[1] || "image/jpeg";
        return self.flowPost("/flow/upload-image", { image_base64: dataUrl, mime_type: mime, project_id: project, file_name: name }, job.signal)
          .then(function (x) { if (!x.media_id) throw { display: "Flow : import de « " + name + " » refusé." }; return x.media_id; });
      };
      var list = (loop ? imgs.slice(0, 1) : imgs).map(function (u, i) { return { data: u, name: "agnes-scene-" + (i + 1) + ".jpg" }; })
        .concat(useRefs ? refs.map(function (x) { return { data: x.data, name: String(x.nom || "reference").slice(0, 60) + ".jpg" }; }) : []);
      var ids = [];
      var chain = list.reduce(function (p, it, i) {
        return p.then(function () {
          job.info = "Flow : import des images (" + (i + 1) + "/" + list.length + ")…"; A.emitJob(job);
          return upload(it.data, it.name).then(function (id) { ids.push(id); });
        });
      }, Promise.resolve());

      return chain.then(function () {
        if (aborted()) throw { display: "Annulé.", cancelled: true };
        var body = { prompt: prompt, project_id: project, scene_id: "agnes-" + shot.id + "-" + Date.now(), aspect_ratio: self.FLOW_ASPECT[ratio], duration_s: duration };
        body.user_paygate_tier = tier;
        var path;
        if (useRefs) { path = "/flow/generate-video-refs"; Object.assign(body, { reference_media_ids: ids, model_family: "omni_flash", resolution: res }); }
        else if (imgs.length) {
          path = "/flow/generate-video";
          Object.assign(body, { start_image_media_id: ids[0], model_family: model, resolution: res });
          if (loop) body.end_image_media_id = ids[0];
          else if (imgs.length === 2) body.end_image_media_id = ids[1];
        } else path = "/flow/generate-video-omni-text";
        shot.lastRequest = { moteur: "flow", route: path, modele: model, duree: duration, resolution: res, format: ratio, projet: project,
          images: imgs.length + " image(s)" + (loop ? " (scène verrouillée : début = fin)" : ""), references: useRefs ? refs.map(function (x) { return x.nom; }) : [] };
        job.info = "Flow génère la vidéo — " + duration + " s, " + res + (model === "veo" ? ", Veo 3.1" : ", Omni Flash") + "…"; A.emitJob(job);
        // UN seul envoi, sans signal d'annulation : couper la requête en route laisserait ignorer si la vidéo est partie.
        return self.flowPost(path, body).catch(function (e) {
          if (e && e.network) self.flowBlock("envoi interrompu, la vidéo est peut-être partie.");
          throw e;
        });
      });
    }).then(function (sub) {
      var fp = sub.flowkitPolling || {};
      var wf = sub.workflows || fp.workflows || null, ops = sub.operations || fp.operations || null;
      var n = (wf || ops || []).length;
      if (!n) { self.flowBlock("réponse d'envoi inattendue, la vidéo est peut-être partie."); throw { display: "Flow : réponse inattendue (aucune génération à suivre)." }; }
      if (n > 1) { self.flowBlock("Flow a lancé " + n + " vidéos pour un seul envoi."); warn("Flow a lancé " + n + " vidéos pour un envoi — Flow bloqué"); }
      return self.flowPoll(job, project, wf && wf.slice(0, 1), ops && ops.slice(0, 1));
    }).then(function (url) {
      job.info = "Récupération de la vidéo…"; A.emitJob(job);
      return fetch(url).then(function (x) { if (!x.ok) throw { display: "Vidéo Flow illisible (HTTP " + x.status + ") : récupérez-la dans le projet Flow." }; return x.blob(); },
        function () { throw { display: "Vidéo Flow non téléchargeable : récupérez-la dans le projet Flow." }; });
    }).then(function (blob) { return self.storeTake(blob, "video", "flow"); })
      .then(function (take) { return [take]; });
  },

  // =========================================================
  // FLOW MANUEL (depuis le 22/09/2026, Google refuse les générations lancées par une extension)
  // Agnes prépare : image de départ envoyée dans le projet Flow (FlowKit, sans jeton anti-robot), prompt copié, projet
  // ouvert ; l'utilisatrice clique Générer puis Télécharger dans Flow. Le pont (POST /flow/recuperer) repère la vidéo
  // arrivée dans Téléchargements APRÈS l'envoi, la déplace dans le dossier Production de la carte (AgnesApp.classementLocal,
  // extension Classement ; sinon Production/_A_classer/<projet>/Video) ; Agnes la range comme prise « flow ».
  // Une seule carte attend à la fois (file Flow), rien n'est jamais généré par Agnes.
  // =========================================================
  flowManualNow: function (job, shot, proj) {
    var self = this, A = this.A, m = shot.mode, notes = [], entry = null, depuis = 0, dest = null;
    var warn = function (t) { notes.push(t); job.warning = notes.join(" · "); A.emitJob(job); };
    if (this.cfg.flowBloque) return Promise.reject({ display: "Flow est bloqué par sécurité : " + this.cfg.flowBloque + " Réactivez-le dans ⚙ → Moteurs de génération." });
    var starts = m === "frames" ? [shot.startRef, shot.endRef] : m === "i2v" ? [shot.sourceRef] : [];
    var num = A.sortedShots ? A.sortedShots(proj).indexOf(shot) + 1 : 0;
    var loc = A.classementLocal ? A.classementLocal(shot) : null;
    dest = loc ? { dossier: loc.video, nom: loc.nom } : {
      dossier: "_A_classer/" + String(proj.name || "Projet").replace(/[<>:"\/\\|?*\x00-\x1f]+/g, " ").trim().slice(0, 50) + "/Video",
      nom: "Carte " + (num < 10 ? "0" : "") + num
    };
    if (!loc) warn("Pas de thématique de classement pour ce projet : vidéo rangée dans Production\\_A_classer (réglez-la avec « Classer »)");
    if ((Number(shot.outputs) || 1) > 1) warn("Flow manuel : 1 vidéo par carte");
    var ratio = A.nearestRatio(shot.aspect || proj.aspect || "9:16", ["9:16", "16:9"]);
    var duration = this.flowDuration(shot.duration, this.cfg.flowModel);
    var prompt = A.buildPrompt(shot, proj);
    if (!/subtle/i.test(prompt)) prompt += ". Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to";
    if (!/no film grain/i.test(prompt)) prompt += ". Tack-sharp, crisp image, no film grain, no noise";
    if (!/no music/i.test(prompt)) prompt += ". No music. No song. Ambient sound only";
    job.info = "Flow (manuel) : préparation…"; A.emitJob(job);

    return this.flowProjectsLoad().then(function () {
      entry = self.flowActive();
      if (!entry) throw { display: "Aucun projet Flow choisi : ajoutez-en un dans ⚙ → Moteurs (liste partagée avec l'onglet Google Flow de Lumina)." };
      return self.flowVerify();
    }).then(function (chk) {
      // Aucune page Flow ouverte (rôle « Tout ») : on ouvre le projet ; plusieurs pages ou mauvais compte : on s'arrête.
      if (chk.blocking && !chk.remote && chk.tabs === 0) {
        return self.flowMsg({ type: "FLOW_OPEN_PROJECT", url: self.flowProjectUrl(entry) }, 5000)
          .then(function () { return A.sleep(6000, job.signal); }).then(function () { return self.flowVerify(); });
      }
      return chk;
    }).then(function (chk) {
      if (chk.blocking) throw { display: chk.warning };
      return Promise.all(starts.map(function (r) { return self.startImage(r, shot, proj); }));
    }).then(function (imgs) {
      imgs = imgs.filter(Boolean);
      if (starts.length && imgs.length !== starts.length) throw { display: "Image de départ introuvable pour ce plan." };
      if (m === "i2v" && shot.i2v === "anchor") warn("Scène verrouillée : dans Flow, mettez la même image en début et en fin");
      // Images envoyées dans le projet Flow (sans crédit, sans jeton anti-robot) ; si FlowKit est arrêté, l'utilisatrice
      // les importe elle-même (bouton « Télécharger l'image » de la carte).
      var noms = [];
      return imgs.reduce(function (pr, u, i) {
        var nom = dest.nom + (imgs.length > 1 ? (i ? " - fin" : " - debut") : "") + ".jpg";
        return pr.then(function () {
          var mime = (String(u).match(/^data:([^;,]+)/) || [])[1] || "image/jpeg";
          return self.flowPost("/flow/upload-image", { image_base64: u, mime_type: mime, project_id: entry.id, file_name: nom }, job.signal)
            .then(function () { noms.push(nom); }, function (e) {
              if (e && e.cancelled) throw e;
              warn("Image non envoyée dans Flow (" + (e && e.display || "FlowKit") + ") : importez-la vous-même depuis la carte");
            });
        });
      }, Promise.resolve()).then(function () { return noms; });
    }).then(function (noms) {
      var copie = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(prompt).then(function () { return true; }, function () { return false; }) : Promise.resolve(false);
      return copie.then(function (ok) {
        shot.lastRequest = { moteur: "flow (manuel)", projet: entry.nom + " (" + entry.id + ")", modele: self.cfg.flowModel === "veo" ? "Veo 3.1" : "Omni Flash",
          duree: duration, resolution: self.cfg.flowRes || "720p", format: ratio, images: noms, rangement: "Production/" + dest.dossier + "/" + dest.nom + ".mp4" };
        depuis = Date.now() / 1000;
        job.info = "Flow (manuel), à vous dans Flow : " + (noms.length ? "image « " + noms.join(" » puis « ") + " », " : "") +
          (ok ? "collez le prompt (Ctrl + V)" : "copiez le prompt (bouton « Prompt final » de la carte)") + ", " +
          (self.cfg.flowModel === "veo" ? "Veo 3.1" : "Omni Flash") + ", " + duration + " s, " + ratio + ", " + (self.cfg.flowRes || "720p") +
          ", puis Générer ; quand la vidéo est prête : Télécharger. Agnes la reprend toute seule.";
        A.emitJob(job);
        self.core.toast("Flow (manuel) : carte " + num + " prête. Dans Flow, cliquez Générer puis Télécharger.", "ok");
        return self.flowWaitDownload(job, dest, depuis);
      });
    }).then(function (chemin) {
      job.info = "Vidéo reçue : " + chemin; A.emitJob(job);
      return fetch(String(self.cfg.pont || "http://127.0.0.1:8177").replace(/\/+$/, "") + "/classement/lire?chemin=" + encodeURIComponent(chemin))
        .then(function (r) { if (!r.ok) throw { display: "Vidéo rangée (Production/" + chemin + ") mais illisible par Agnes." }; return r.blob(); })
        .then(function (blob) { return self.storeTake(blob, "video", "flow"); })
        .then(function (take) { take.localPath = chemin; return [take]; });
    });
  },

  // Attend la vidéo téléchargée depuis Flow (45 min au plus) : le pont la cherche dans Téléchargements toutes les 5 s.
  flowWaitDownload: function (job, dest, depuis) {
    var self = this, A = this.A, end = Date.now() + 45 * 60000, base = String(this.cfg.pont || "http://127.0.0.1:8177").replace(/\/+$/, "");
    function tour() {
      if (Date.now() > end) return Promise.reject({ display: "Aucune vidéo téléchargée depuis Flow en 45 minutes. Si elle est faite, relancez la carte : Agnes reprendra la prochaine vidéo téléchargée." });
      return A.sleep(5000, job.signal).then(function () {
        return fetch(base + "/flow/recuperer", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ depuis: depuis, dest: dest.dossier, nom: dest.nom }) })
          .then(function (r) { return r.json(); }, function () { return { attente: "pont injoignable (lancer_pont.bat)" }; });
      }).then(function (j) {
        if (j && j.trouve) {
          if (j.autres) self.core.toast(j.autres + " autre(s) vidéo(s) téléchargée(s) en même temps : seule la première est rangée dans la carte.", "err");
          return j.chemin;
        }
        if (j && j.error) throw { display: "Récupération de la vidéo Flow : " + j.error };
        return tour();
      });
    }
    return tour();
  },

  // Attente du résultat : jamais de renvoi. 15 minutes au plus ; FlowKit muet 6 fois de suite = arrêt.
  // Sondage espacé (15 s, puis 20 s après 2 min) : moins de requêtes vers Flow, moins de risque de restriction.
  flowPoll: function (job, project, wf, ops) {
    var self = this, A = this.A, end = Date.now() + 15 * 60000, start = Date.now(), fails = 0;
    var gone = " — la vidéo peut encore se terminer dans le projet Flow (crédits décomptés) : vérifiez-le avant de relancer.";
    function poll() {
      if (Date.now() > end) return Promise.reject({ display: "Flow n'a pas rendu la vidéo en 15 minutes" + gone });
      return A.sleep(Date.now() - start < 120000 ? 15000 : 20000, job.signal).catch(function () { throw { display: "Annulé dans Agnes" + gone, cancelled: true }; }).then(function () {
        var q = wf ? self.flowPost("/flow/check-omni-status", { workflows: wf, project_id: project, include_encoded_video: false })
          : self.flowPost("/flow/check-status", { operations: ops, project_id: project });
        return q.then(function (r) { fails = 0; return r; }, function (e) {
          if (e && e.status && e.status < 500) throw e;
          if (++fails >= 6) throw { display: "FlowKit ne répond plus pendant l'attente" + gone };
          return null;
        });
      }).then(function (r) {
        var sec = Math.round((Date.now() - start) / 1000), info = "";
        if (r && wf) {
          var list = r.workflows || [];
          if (list.length) wf = list.map(function (w) { return { name: w.name, primary_media_id: w.primary_media_id, project_id: w.project_id }; });
          var bad = list.find(function (w) { return w.status === "FAILED" || w.error; });
          if (bad) throw { display: "Flow a refusé ou raté la vidéo : " + (bad.error || "échec") };
          if (list.length && list.every(function (w) { return w.done; })) {
            var u = list[0].media && list[0].media.url;
            if (u) return u;
            throw { display: "Flow : vidéo terminée mais sans adresse — récupérez-la dans le projet Flow." };
          }
        } else if (r) {
          var l = r.operations || [], op = l[0];
          if (l.length) ops = l;
          if (op && op.status === "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
            var v = op.operation && op.operation.metadata && op.operation.metadata.video;
            if (v && v.fifeUrl) return v.fifeUrl;
          }
          if (op && op.status === "MEDIA_GENERATION_STATUS_FAILED") throw { display: "Flow a refusé ou raté la vidéo : " + (op.error || op.complaint || "échec") };
          if (op && op.error) info = " (Flow signale : " + op.error + ")";
        }
        job.info = (r ? "Flow génère la vidéo" : "FlowKit ne répond pas, nouvel essai") + " — " + sec + " s" + info + "…"; A.emitJob(job);
        return poll();
      });
    }
    return poll();
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
