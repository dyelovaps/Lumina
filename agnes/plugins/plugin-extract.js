// plugins/plugin-extract.js — Extracteur : téléchargement par lien, script (transcription), images d'une vidéo
// 1. Lien → vidéo : un navigateur ne peut pas récupérer une vidéo TikTok/Instagram/YouTube (blocage des sites),
//    l'app prépare donc un kit yt-dlp (.bat / .sh) qui télécharge vos liens sur votre PC. Les liens directs
//    vers un fichier .mp4 sont récupérés directement quand le serveur l'autorise.
// 2. Script : transcription Whisper dans le navigateur (gratuit, privé, modèle téléchargé une fois) ou API OpenAI,
//    ou import de sous-titres .srt/.vtt. Export texte / timecodes / .srt, envoi vers l'onglet Scénario.
// 3. Images : extraction toutes les N secondes, N images réparties, une image par plan (détection des coupes)
//    ou capture manuelle ; export .zip, envoi vers la Bibliothèque ou vers Stills → Clip.
AgnesPlugins.register("extracteur", {
  name: "Extracteur (lien, script, images)",
  version: "1.1",
  TIKWM: "https://www.tikwm.com",
  TFJS: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.frames = []; this.segments = []; this.video = null; this.srcName = "";
    var cfg = core.pluginSettings("extracteur", {
      dlQuality: "1080", dlSubs: true, dlAudio: false,
      engine: "local", whisper: "Xenova/whisper-small", lang: "french", openaiKey: "", openaiModel: "whisper-1",
      mode: "scenes", every: 2, count: 12, threshold: 30, pick: "middle", fmt: "image/jpeg"
    });
    this.cfg = cfg;

    var view = core.ui.addTab("extraire", "Extraire",
      '<p class="hint">Pour vos propres vidéos, ou pour analyser une référence. Republier le contenu d\'un autre créateur demande son accord.</p>' +
      // ---------- 0. Veille ----------
      '<div class="card"><h3>🔎 Veille — les meilleures vidéos de votre catégorie</h3>' +
      '<p class="hint" style="margin-top:0">L\'IA propose des mots-clés, TikWM cherche sur TikTok avec les vraies statistiques (vues, likes, partages, date), l\'app classe. ' +
      'Les liens cochés vont dans « 1. Télécharger depuis un lien ». Tout est enregistré dans le projet.</p>' +
      '<div class="grid2"><div class="field"><label for="exVCat">Catégorie ou série</label><input type="text" id="exVCat" placeholder="Ex. mini-séries dramatiques avec des personnages fruits IA"></div>' +
      '<div class="field"><label for="exVKeys">Mots-clés TikTok (un par ligne)</label><textarea id="exVKeys" rows="3" placeholder="fruit drama&#10;aidrama&#10;série ia"></textarea></div></div>' +
      '<div class="row-inline"><button class="small-btn" id="exVSuggest" type="button">✨ Proposer des mots-clés (IA)</button>' +
      '<label class="inline">Période <select id="exVPeriod" style="width:auto"><option value="0">Toutes</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">3 mois</option><option value="180">6 mois</option></select></label>' +
      '<label class="inline">Classer par <select id="exVSort" style="width:auto"><option value="play">Vues</option><option value="like">Likes</option><option value="share">Partages</option><option value="eng">Engagement</option></select></label>' +
      '<label class="inline">Garder <select id="exVKeep" style="width:auto"><option>10</option><option>20</option><option>30</option><option>50</option></select></label>' +
      '<label class="inline">Durée max <input type="number" id="exVMaxDur" min="0" placeholder="—" style="width:70px"> s</label>' +
      '<button class="primary-btn" id="exVSearch" type="button">Chercher</button></div>' +
      '<div id="exVOut" style="margin-top:10px"></div></div>' +
      // ---------- 1. Lien ----------
      '<div class="card"><h3>1. Télécharger depuis un lien</h3>' +
      '<p class="hint">Collez un ou plusieurs liens (TikTok, YouTube, Instagram, X, Facebook…), un par ligne. Les sites bloquent le téléchargement depuis une page web : ' +
      'l\'app prépare un petit kit <b>yt-dlp</b> qui télécharge tout d\'un double-clic sur votre PC. Déposez ensuite les vidéos ci-dessous pour en extraire le script et les images.</p>' +
      '<textarea id="exLinks" rows="4" placeholder="https://www.tiktok.com/@compte/video/7412345678901234567&#10;https://www.youtube.com/shorts/…"></textarea>' +
      '<div class="row-inline" style="margin-top:8px"><label class="hint" style="margin:0">Qualité <select id="exQ"><option value="1080">1080p max</option><option value="720">720p max</option><option value="best">La meilleure</option></select></label>' +
      '<label class="hint" style="margin:0"><input type="checkbox" id="exSubs"> Sous-titres du site (.srt) si disponibles</label>' +
      '<label class="hint" style="margin:0"><input type="checkbox" id="exAudio"> Aussi l\'audio seul (.mp3)</label></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="exTkBtn">Récupérer les vidéos TikTok ici</button>' +
      '<button class="small-btn" id="exKit">Kit yt-dlp (.zip) — tous les sites</button><button class="small-btn" id="exDirect">Lien direct vers un fichier .mp4</button></div>' +
      '<p class="hint" style="margin-top:6px"><b>TikTok</b> : récupération directe par le service gratuit <b>TikWM</b> (non officiel : il peut être lent, limité à ~1 lien/s, ou indisponible). ' +
      'En cas d\'échec, ou pour les autres sites, utilisez le kit yt-dlp.</p>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="exProxy"> Si TikWM est bloqué, réessayer via le relais public allOrigins (votre lien passe alors par ce relais)</label>' +
      '<div id="exTk" style="margin-top:8px"></div></div>' +
      // ---------- Source ----------
      '<div class="card"><h3>2. La vidéo à analyser</h3>' +
      '<div class="dropzone" id="exDrop" tabindex="0" role="button">Glissez une vidéo (ou un fichier audio) ici — ou cliquez pour choisir<input type="file" id="exFile" accept="video/*,audio/*" hidden></div>' +
      '<div class="row-inline" style="margin-top:8px"><select id="exFromApp" style="min-width:260px"><option value="">…ou un rendu vidéo de ce projet</option></select><span class="hint" id="exSrcInfo" style="margin:0"></span></div>' +
      '<div class="row-inline" id="exSessBar" style="margin-top:8px;display:none"><label class="inline">Vidéos analysées de ce projet <select id="exSess" style="width:auto;min-width:240px"></select></label>' +
      '<button class="small-btn" id="exSessDel" type="button">Retirer de la liste</button></div>' +
      '<video id="exPlayer" controls playsinline style="display:none;max-width:100%;max-height:48vh;margin-top:10px;border-radius:10px;background:#000"></video></div>' +
      // ---------- 3. Script ----------
      '<div class="card"><h3>3. Récupérer le script</h3><div class="ext-cols">' +
      '<div class="field"><label>Moteur</label><select id="exEngine"><option value="local">Whisper dans le navigateur (gratuit, privé)</option><option value="openai">API OpenAI (clé)</option><option value="subs">Fichier de sous-titres (.srt / .vtt)</option></select></div>' +
      '<div class="field ex-local"><label>Précision</label><select id="exWhisper"><option value="Xenova/whisper-base">Rapide (modèle ~80 Mo)</option><option value="Xenova/whisper-small">Précis (modèle ~250 Mo)</option></select></div>' +
      '<div class="field ex-local ex-openai"><label>Langue parlée</label><select id="exLang"><option value="french">Français</option><option value="english">Anglais</option><option value="spanish">Espagnol</option><option value="arabic">Arabe</option><option value="">Détection auto</option></select></div>' +
      '<div class="field ex-openai"><label>Clé OpenAI</label><input type="password" id="exKey" placeholder="reprise de l\'onglet Voix si vide"></div>' +
      '<div class="field ex-openai"><label>Modèle</label><select id="exOModel"><option value="whisper-1">whisper-1 (avec timecodes)</option><option value="gpt-4o-transcribe">gpt-4o-transcribe (texte seul, plus précis)</option><option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (texte seul)</option></select></div>' +
      '</div><p class="hint ex-local">Le modèle est téléchargé une seule fois puis gardé par le navigateur. Comptez environ le temps réel de la vidéo avec le modèle précis.</p>' +
      '<div class="row-inline"><button class="primary-btn" id="exTranscribe">Transcrire</button><label class="small-btn ex-subs" style="cursor:pointer">Importer .srt / .vtt<input type="file" id="exSubsFile" accept=".srt,.vtt,.txt" hidden></label><span class="hint" id="exTStatus" style="margin:0"></span></div>' +
      '<div id="exScriptWrap" style="display:none;margin-top:10px"><div class="row-inline"><select id="exFormat"><option value="text">Texte</option><option value="time">Avec timecodes</option><option value="srt">Sous-titres .srt</option></select>' +
      '<button class="small-btn" id="exCopy">Copier</button><button class="small-btn" id="exDlTxt">Télécharger</button><button class="small-btn" id="exToScenario">→ Scénario</button>' +
      '<button class="small-btn" id="exToAtelier" type="button">→ Atelier IA (document)</button><button class="primary-btn" id="exConvOpen" type="button">✨ Convertir en prompts (IA)</button></div>' +
      '<textarea id="exScript" rows="10" style="margin-top:8px"></textarea>' +
      '<div id="exConvBox" class="refs-block" style="display:none;margin-top:12px"><b>Convertir en prompts pour Le lot</b>' +
      '<p class="hint" style="margin:4px 0 8px">L\'IA de l\'Atelier (Agnes par défaut) réécrit la vidéo plan par plan : un bloc IMAGE / VIDÉO / RÉF par plan. Les plans suivent les images extraites (étape 4) ; sans images, un plan par passage du script.</p>' +
      '<div class="field"><label for="exConvInstr">Consigne d\'adaptation</label><textarea id="exConvInstr" rows="2" placeholder="Ex. Recrée cette vidéo dans l\'univers de ma série : mêmes cadrages et même rythme, mais avec mes personnages. Remplace la marque par la mienne."></textarea></div>' +
      '<div class="row-inline"><label class="inline"><input type="checkbox" id="exConvImgs" checked> Joindre les images extraites (le modèle voit chaque plan)</label>' +
      '<label class="inline"><input type="checkbox" id="exConvBible" checked> Utiliser la Bible et la Bibliothèque du projet</label>' +
      '<button class="primary-btn" id="exConvGo" type="button">Convertir</button><span class="hint" id="exConvSt" style="margin:0"></span></div>' +
      '<textarea id="exConvOut" rows="12" style="margin-top:8px" placeholder="Le script numéroté (01 — libellé / IMAGE : / VIDÉO : / RÉF :) apparaîtra ici. Modifiable."></textarea>' +
      '<div class="row-inline" style="margin-top:6px"><button class="primary-btn" id="exConvLot" type="button">→ Le lot</button><button class="small-btn" id="exConvCopy" type="button">Copier</button></div></div>' +
      '</div></div>' +
      // ---------- 4. Images ----------
      '<div class="card"><h3>4. Extraire des images</h3><div class="ext-cols">' +
      '<div class="field"><label>Méthode</label><select id="exMode"><option value="scenes">Une image par plan (détection des coupes)</option><option value="every">Toutes les N secondes</option><option value="count">N images réparties</option><option value="edges">Première + dernière image</option></select></div>' +
      '<div class="field ex-m-every"><label>Toutes les (s)</label><input type="number" id="exEvery" min="0.1" step="0.1" style="width:90px"></div>' +
      '<div class="field ex-m-count"><label>Nombre d\'images</label><input type="number" id="exCount" min="1" max="200" style="width:90px"></div>' +
      '<div class="field ex-m-scenes"><label>Sensibilité aux coupes</label><input type="range" id="exThr" min="8" max="60" style="width:100%"><span class="hint" style="margin:0">gauche : plus de plans détectés</span></div>' +
      '<div class="field ex-m-scenes"><label>Image retenue par plan</label><select id="exPick"><option value="middle">Milieu du plan</option><option value="first">Début du plan</option><option value="last">Fin du plan</option></select></div>' +
      '<div class="field"><label>Format</label><select id="exFmt"><option value="image/jpeg">JPG (léger)</option><option value="image/png">PNG (sans perte)</option></select></div>' +
      '</div><div class="row-inline"><button class="primary-btn" id="exExtract">Extraire</button><button class="small-btn" id="exShot">📸 Capturer l\'image affichée</button><button class="small-btn" id="exStop" style="display:none">Arrêter</button><span class="hint" id="exFStatus" style="margin:0"></span></div>' +
      '<div id="exFramesWrap" style="display:none;margin-top:10px"><div class="row-inline"><button class="small-btn" id="exAll">Tout cocher</button><button class="small-btn" id="exNone">Tout décocher</button>' +
      '<button class="primary-btn" id="exZip">Télécharger (.zip)</button><button class="small-btn" id="exToLib">→ Bibliothèque</button><select id="exLibKind"></select><button class="small-btn" id="exToStills">→ Stills → Clip</button><button class="small-btn" id="exClearF">Vider</button></div>' +
      '<div id="exFrames" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px"></div></div></div>');
    this.view = view;
    var $ = function (id) { return view.querySelector("#" + id); };
    this.$ = $;
    $("exLibKind").innerHTML = App.optionsHtml(App.LIB_KINDS, "source");

    // ---------- Réglages ----------
    function fill() {
      $("exQ").value = cfg.dlQuality; $("exSubs").checked = cfg.dlSubs; $("exAudio").checked = cfg.dlAudio;
      $("exEngine").value = cfg.engine; $("exWhisper").value = cfg.whisper; $("exLang").value = cfg.lang; $("exKey").value = cfg.openaiKey; $("exOModel").value = cfg.openaiModel;
      $("exMode").value = cfg.mode; $("exEvery").value = cfg.every; $("exCount").value = cfg.count; $("exThr").value = cfg.threshold; $("exPick").value = cfg.pick; $("exFmt").value = cfg.fmt;
      view.querySelectorAll(".ex-local,.ex-openai,.ex-subs").forEach(function (n) {
        n.style.display = n.classList.contains("ex-" + cfg.engine) ? "" : "none";
      });
      ["every", "count", "scenes"].forEach(function (m) { view.querySelectorAll(".ex-m-" + m).forEach(function (n) { n.style.display = cfg.mode === m ? "" : "none"; }); });
      $("exTranscribe").style.display = cfg.engine === "subs" ? "none" : "";
    }
    view.addEventListener("change", function (e) {
      var id = e.target.id;
      var map = { exQ: "dlQuality", exEngine: "engine", exWhisper: "whisper", exLang: "lang", exOModel: "openaiModel", exMode: "mode", exPick: "pick", exFmt: "fmt" };
      if (map[id]) cfg[map[id]] = e.target.value;
      if (id === "exSubs") cfg.dlSubs = e.target.checked; if (id === "exAudio") cfg.dlAudio = e.target.checked;
      if (id === "exKey") cfg.openaiKey = e.target.value.trim();
      if (id === "exEvery") cfg.every = Math.max(0.1, Number(e.target.value) || 2);
      if (id === "exCount") cfg.count = App.clamp(e.target.value, 1, 200);
      if (id === "exThr") cfg.threshold = Number(e.target.value);
      if (id === "exFormat") return self.showScript();
      cfg.save(); fill();
    });

    // ---------- 1. Lien ----------
    $("exKit").addEventListener("click", function () { self.downloadKit(); });
    $("exTkBtn").addEventListener("click", function () { self.fetchTikToks(); });
    $("exProxy").checked = !!cfg.tkProxy;
    $("exProxy").addEventListener("change", function () { cfg.tkProxy = this.checked; cfg.save(); });
    $("exTk").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tk]"); if (!b) return;
      var it = self.tk[+b.getAttribute("data-i")]; if (!it) return;
      var act = b.getAttribute("data-tk");
      if (act === "open") return window.open(self.tkUrl(it, b.getAttribute("data-q")), "_blank", "noopener");
      if (act === "cover") return self.tkCover(it);
      self.tkMedia(it, b.getAttribute("data-q"), act, b);
    });
    $("exDirect").addEventListener("click", function () { self.directFetch(); });

    // ---------- 2. Source ----------
    var drop = $("exDrop");
    drop.addEventListener("click", function (e) { if (e.target.id !== "exFile") $("exFile").click(); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("exFile").click(); } });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("over"); var f = e.dataTransfer.files[0]; if (f) self.setSource(f, f.name); });
    $("exFile").addEventListener("change", function () { var f = this.files[0]; this.value = ""; if (f) self.setSource(f, f.name); });
    $("exFromApp").addEventListener("change", function () {
      var v = this.value; if (!v) return;
      var s = core.getShot(v), t = s && core.getSelectedTake(s);
      core.getTakeBlobOrFetch(t).then(function (b) {
        if (!b) throw new Error("rendu indisponible (utilisez « ⟳ Récupérer le fichier » sur le plan)");
        self.setSource(b, "plan-" + (core.getShots().indexOf(s) + 1) + ".mp4");
      }).catch(function (e) { core.toast(e.message, "err"); });
    });

    // ---------- 3. Script ----------
    $("exTranscribe").addEventListener("click", function () { self.transcribe(); });
    $("exSubsFile").addEventListener("change", function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      f.text().then(function (t) { self.segments = self.parseSubs(t); self.srcName = self.srcName || f.name; self.showScript(); self.saveSegments(); core.toast(self.segments.length + " répliques importées.", "ok"); });
    });
    $("exCopy").addEventListener("click", function () { var t = $("exScript").value; navigator.clipboard.writeText(t).then(function () { core.toast("Script copié.", "ok"); }); });
    $("exDlTxt").addEventListener("click", function () {
      var srt = $("exFormat").value === "srt";
      core.download(new Blob([$("exScript").value], { type: "text/plain;charset=utf-8" }), App.slugify(self.srcName.replace(/\.[^.]+$/, "") || "script") + (srt ? ".srt" : "_script.txt"));
    });
    $("exToScenario").addEventListener("click", function () {
      if (!AgnesPlugins.isLoaded("scenario")) return core.toast("Activez l'extension « Import de scénario » dans ⚙.", "err");
      var ta = document.getElementById("scText"); if (!ta) return;
      ta.value = $("exFormat").value === "text" && $("exScript").value.trim() ? $("exScript").value : self.segments.map(function (s) { return s.text.trim(); }).join("\n\n");
      App.showView("view_scenario"); core.toast("Script collé dans l'onglet Scénario : ajoutez les noms des personnages puis « Analyser ».", "ok");
    });

    // ---------- 4. Images ----------
    $("exExtract").addEventListener("click", function () { self.extract(); });
    $("exStop").addEventListener("click", function () { self.stop = true; });
    $("exShot").addEventListener("click", function () {
      if (!self.video) return core.toast("Choisissez d'abord une vidéo.", "err");
      var v = $("exPlayer"); v.pause();
      self.capture(v.currentTime).then(function (f) { if (f) { self.frames.push(f); self.frames.sort(function (a, b) { return a.t - b.t; }); self.renderFrames(); self.saveFrames(); } });
    });
    $("exAll").addEventListener("click", function () { self.frames.forEach(function (f) { f.on = true; }); self.renderFrames(); });
    $("exNone").addEventListener("click", function () { self.frames.forEach(function (f) { f.on = false; }); self.renderFrames(); });
    $("exClearF").addEventListener("click", function () { self.frames.forEach(function (f) { URL.revokeObjectURL(f.url); }); self.frames = []; self.renderFrames(); });
    $("exFrames").addEventListener("change", function (e) { var i = e.target.getAttribute("data-fi"); if (i != null) self.frames[+i].on = e.target.checked; });
    $("exFrames").addEventListener("click", function (e) { var b = e.target.closest("[data-seek]"); if (b) { var v = $("exPlayer"); v.currentTime = +b.getAttribute("data-seek"); } });
    $("exZip").addEventListener("click", function () { self.zipFrames(); });
    $("exToLib").addEventListener("click", function () { self.framesToLibrary(); });
    $("exToStills").addEventListener("click", function () { self.framesToStills(); });

    // ---------- Veille ----------
    $("exVSearch").addEventListener("click", function () { self.veilleSearch(); });
    $("exVSuggest").addEventListener("click", function () { self.veilleSuggest(); });
    ["exVCat", "exVKeys", "exVPeriod", "exVSort", "exVKeep", "exVMaxDur"].forEach(function (id) {
      $(id).addEventListener("change", function () { self.veilleSaveForm(); if (id === "exVSort" || id === "exVKeep" || id === "exVMaxDur" || id === "exVPeriod") self.veilleRender(); });
    });
    $("exVOut").addEventListener("change", function (e) {
      var i = e.target.getAttribute("data-vi"); if (i == null) return;
      var r = self.st().veille.results[+i]; if (r) { r.on = e.target.checked; self.saveSoon(); }
    });
    $("exVOut").addEventListener("click", function (e) {
      var b = e.target.closest("[data-vact]"); if (!b) return;
      var act = b.getAttribute("data-vact"), v = self.st().veille, list = self.veilleView();
      if (act === "all") { var on = !list.every(function (r) { return r.on; }); list.forEach(function (r) { r.on = on; }); self.saveSoon(); self.veilleRender(); }
      if (act === "add") self.veilleToLinks();
      if (act === "fetch") { self.veilleToLinks(true); }
      if (act === "why") self.veilleAnalyse(b);
    });
    // ---------- Liens et résultats TikTok : enregistrés ----------
    $("exLinks").addEventListener("input", function () { self.st().links = this.value; self.saveSoon(); });
    // ---------- Vidéos analysées ----------
    $("exSess").addEventListener("change", function () { if (this.value) self.openSession(this.value); });
    $("exSessDel").addEventListener("click", function () { self.deleteSession($("exSess").value); });
    // ---------- Script : édition et sorties ----------
    $("exScript").addEventListener("input", function () { var ss = self.session(); if (ss) { ss.scriptEdit = this.value; ss.scriptFmt = $("exFormat").value; self.saveSoon(); } });
    $("exToAtelier").addEventListener("click", function () { self.scriptToAtelier(); });
    $("exConvOpen").addEventListener("click", function () { var box = $("exConvBox"); box.style.display = box.style.display === "none" ? "" : "none"; if (box.style.display === "") box.scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("exConvGo").addEventListener("click", function () { self.convertToPrompts(); });
    $("exConvLot").addEventListener("click", function () { self.convToLot(); });
    $("exConvCopy").addEventListener("click", function () { navigator.clipboard.writeText($("exConvOut").value).then(function () { core.toast("Copié.", "ok"); }); });
    ["exConvInstr", "exConvOut"].forEach(function (id) { $(id).addEventListener("input", function () { var ss = self.session(); if (ss) { ss[id === "exConvInstr" ? "convInstr" : "convOut"] = this.value; self.saveSoon(); } }); });
    // Images : toute modification est enregistrée
    ["exAll", "exNone", "exClearF"].forEach(function (id) { $(id).addEventListener("click", function () { self.saveFrames(); }); });
    $("exFrames").addEventListener("change", function () { self.saveFrames(); });

    core.on("view:change", function (v) { if (v === "view_extraire") { fill(); self.fillApp(); } });
    core.on("project:change", function () { self.restore(); });
    fill();
    this.restore();
  },

  fillApp: function () {
    var core = this.core, opts = core.getShots().map(function (s, i) {
      var t = core.getSelectedTake(s); return t && t.kind === "video" ? '<option value="' + s.id + '">Plan #' + (i + 1) + ' — ' + window.AgnesApp.esc((s.prompt || "").slice(0, 40)) + '</option>' : "";
    }).join("");
    this.$("exFromApp").innerHTML = '<option value="">…ou un rendu vidéo de ce projet</option>' + opts;
  },
  setSource: function (blob, name, restoring) {
    var v = this.$("exPlayer");
    if (!restoring) this.newSession(blob, name);
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
    this.video = blob; this.srcName = name; this.videoUrl = URL.createObjectURL(blob);
    v.src = this.videoUrl; v.style.display = /^audio\//.test(blob.type) ? "none" : "";
    var self = this;
    v.onloadedmetadata = function () {
      var d = isFinite(v.duration) ? v.duration : 0;
      self.$("exSrcInfo").textContent = name + (d ? " · " + self.fmtTime(d) : "") + (v.videoWidth ? " · " + v.videoWidth + "×" + v.videoHeight : "");
    };
    this.$("exSrcInfo").textContent = name;
  },
  fmtTime: function (s, ms) {
    s = Math.max(0, s || 0); var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = Math.floor(s % 60), z = function (n, l) { return String(n).padStart(l || 2, "0"); };
    return ms ? z(h) + ":" + z(m) + ":" + z(x) + "," + z(Math.round((s % 1) * 1000), 3) : (h ? h + ":" + z(m) : m) + ":" + z(x);
  },

  // ======================= 1. LIENS =======================
  links: function () {
    return this.$("exLinks").value.split(/\s+/).map(function (l) { return l.trim(); }).filter(function (l) { return /^https?:\/\//i.test(l); });
  },
  downloadKit: function () {
    var core = this.core, cfg = this.cfg, links = this.links();
    if (!links.length) return core.toast("Collez au moins un lien (https://…).", "err");
    if (typeof JSZip === "undefined") return core.toast("Module ZIP indisponible.", "err");
    var fmt = cfg.dlQuality === "best" ? "bv*+ba/b" : "bv*[height<=" + cfg.dlQuality + "][ext=mp4]+ba[ext=m4a]/b[height<=" + cfg.dlQuality + "][ext=mp4]/bv*[height<=" + cfg.dlQuality + "]+ba/b";
    function args(pct) {
      var o = pct + "(autonumber)02d_" + pct + "(extractor)s_" + pct + "(id)s." + pct + "(ext)s";
      var a = ['-f "' + fmt + '"', "--merge-output-format mp4", "--restrict-filenames", "--no-playlist", "--ignore-errors", '-o "telechargements/' + o + '"'];
      if (cfg.dlSubs) a.push('--write-subs --write-auto-subs --sub-langs "fr.*,en.*" --convert-subs srt');
      return a.join(" ") + " -a liens.txt";
    }
    var audioArgs = function (pct) { return '-x --audio-format mp3 --restrict-filenames --no-playlist --ignore-errors -o "telechargements/audio/' + pct + '(autonumber)02d_' + pct + '(id)s.' + pct + '(ext)s" -a liens.txt'; };
    var bat = ["@echo off", "chcp 65001 >nul", 'cd /d "%~dp0"',
      "where yt-dlp >nul 2>nul || (echo yt-dlp est introuvable. & echo Installez-le avec :  winget install yt-dlp.yt-dlp   puis relancez ce fichier. & echo ^(ou telechargez yt-dlp.exe sur https://github.com/yt-dlp/yt-dlp/releases et placez-le dans ce dossier^) & pause & exit /b 1)",
      "where ffmpeg >nul 2>nul || echo Attention : FFmpeg absent, certaines videos ne pourront pas etre assemblees (winget install Gyan.FFmpeg).",
      "echo Mise a jour de yt-dlp...", "yt-dlp -U",
      "echo Telechargement de " + links.length + " lien(s)...", "yt-dlp " + args("%%")].concat(cfg.dlAudio ? ["yt-dlp " + audioArgs("%%")] : [], [
      "echo.", "echo Termine. Les fichiers sont dans le dossier telechargements.", 'start "" "telechargements"', "pause"]).join("\r\n");
    var sh = ["#!/usr/bin/env bash", 'cd "$(dirname "$0")"',
      "command -v yt-dlp >/dev/null || { echo 'yt-dlp est introuvable. Installez-le : pipx install \"yt-dlp[default,curl-cffi]\"'; exit 1; }",
      "yt-dlp -U || true", "yt-dlp " + args("%")].concat(cfg.dlAudio ? ["yt-dlp " + audioArgs("%")] : [], ["echo 'Terminé : dossier telechargements/'"]).join("\n");
    var zip = new JSZip();
    zip.file("liens.txt", links.join("\r\n") + "\r\n");
    zip.file("telecharger.bat", bat); zip.file("telecharger.sh", sh, { unixPermissions: "755" });
    zip.file("LISEZMOI.txt", [
      "Kit de téléchargement — " + links.length + " lien(s)", "",
      "Windows : double-cliquez sur telecharger.bat", "Mac / Linux : ouvrez un terminal dans ce dossier et lancez  bash telecharger.sh", "",
      "Première fois : installez yt-dlp (et FFmpeg, déjà utile pour le kit de montage) :",
      "  Windows : winget install yt-dlp.yt-dlp   puis   winget install Gyan.FFmpeg",
      "  Mac     : brew install ffmpeg   puis   pipx install \"yt-dlp[default,curl-cffi]\"", "",
      "Si TikTok refuse (erreur « impersonation ») : mettez yt-dlp à jour (le script le fait tout seul) ; sur Mac/Linux, installez la variante curl-cffi ci-dessus.", "",
      "Les vidéos arrivent dans le dossier telechargements/ (numérotées dans l'ordre des liens)" + (cfg.dlSubs ? ", avec les sous-titres .srt quand le site en fournit." : "."),
      "Déposez-les ensuite dans l'onglet Extraire pour récupérer le script et les images.", "",
      "Pour ajouter des liens plus tard : éditez liens.txt (un lien par ligne) et relancez.",
      "Utilisez ce kit pour vos propres vidéos ou pour de l'analyse : republier le contenu d'un autre créateur demande son accord."
    ].join("\r\n"));
    zip.generateAsync({ type: "blob", platform: "UNIX" }).then(function (b) { core.download(b, "kit-telechargement.zip"); core.toast("Kit prêt : dézippez-le puis double-cliquez sur telecharger.bat.", "ok"); });
  },
  directFetch: function () {
    var self = this, core = this.core, links = this.links();
    if (!links.length) return core.toast("Collez un lien.", "err");
    var url = links[0];
    core.toast("Récupération directe…");
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error("le serveur répond HTTP " + r.status);
      var ct = r.headers.get("content-type") || "";
      if (!/video|audio|octet-stream/.test(ct)) throw new Error("ce lien mène à une page web, pas à un fichier vidéo : utilisez le kit");
      return r.blob();
    }).then(function (b) {
      var name = (url.split("?")[0].split("/").pop() || "video.mp4");
      self.setSource(b, name); core.toast("Vidéo récupérée : " + (b.size / 1048576).toFixed(1) + " Mo.", "ok");
    }).catch(function (e) {
      core.toast("Récupération directe impossible : " + (e instanceof TypeError ? "le site bloque les téléchargements depuis une page web — utilisez le kit" : e.message) + ".", "err");
    });
  },

  // ---------- TikTok via TikWM ----------
  isTikTok: function (u) { return /(^|\.)tiktok\.com\//i.test(u) || /\/\/(vm|vt)\.tiktok\.com/i.test(u); },
  abs: function (u) { return !u ? "" : /^https?:/i.test(u) ? u : this.TIKWM + (u.charAt(0) === "/" ? "" : "/") + u; },
  tikwmInfo: function (url) {
    var self = this, api = this.TIKWM + "/api/?hd=1&url=" + encodeURIComponent(url);
    var parse = function (d) { if (!d || d.code !== 0 || !d.data) throw new Error((d && d.msg) || "réponse vide"); return d.data; };
    var timeout = function (p) { return Promise.race([p, new Promise(function (_, r) { setTimeout(function () { r(new Error("délai dépassé")); }, 12000); })]); };
    var tries = [
      function () { return fetch(api, { headers: { Accept: "application/json" } }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(parse); },
      function () {
        return fetch(self.TIKWM + "/api/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ url: url, hd: "1" }) })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(parse);
      }
    ];
    if (this.cfg.tkProxy) tries.push(function () {
      return fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(api)).then(function (r) { if (!r.ok) throw new Error("relais HTTP " + r.status); return r.json(); })
        .then(function (w) { return parse(JSON.parse(w.contents)); });
    });
    var last = null, chain = Promise.reject();
    tries.forEach(function (t) { chain = chain.catch(function (e) { if (e) last = e; return timeout(t()); }); });
    return chain.catch(function (e) { throw (e && e.message ? e : last) || new Error("échec"); });
  },
  fetchTikToks: function () {
    var self = this, core = this.core, links = this.links().filter(function (u) { return self.isTikTok(u); }), others = this.links().length - links.length;
    if (!links.length) return core.toast(others ? "Ces liens ne sont pas des liens TikTok : utilisez le kit yt-dlp." : "Collez au moins un lien TikTok.", "err");
    var btn = this.$("exTkBtn"); btn.disabled = true; this.tk = [];
    var chain = Promise.resolve();
    links.forEach(function (url, i) {
      chain = chain.then(function () {
        self.$("exTk").innerHTML = '<p class="hint">Récupération ' + (i + 1) + '/' + links.length + '…</p>' + self.tkHtml();
        return self.tikwmInfo(url).then(function (d) { self.tk.push({ url: url, d: d }); }, function (e) { self.tk.push({ url: url, err: e.message || String(e) }); })
          .then(function () { return i < links.length - 1 ? new Promise(function (r) { setTimeout(r, 1200); }) : null; }); // TikWM : ~1 requête / s
      });
    });
    chain.then(function () {
      self.$("exTk").innerHTML = self.tkHtml();
      self.st().tk = self.tk.map(function (t) { return t.d ? { url: t.url, d: t.d } : { url: t.url, err: t.err }; }); self.saveSoon();
      var ok = self.tk.filter(function (t) { return t.d; }).length;
      core.toast(ok + "/" + links.length + " vidéo(s) trouvée(s)" + (others ? " — " + others + " lien(s) d'autres sites : utilisez le kit." : "."), ok ? "ok" : "err");
    }).finally(function () { btn.disabled = false; });
  },
  tkUrl: function (it, q) { var d = it.d; return this.abs(q === "wm" ? d.wmplay : q === "hd" ? (d.hdplay || d.play) : d.play); },
  tkName: function (it, q) {
    var d = it.d, base = window.AgnesApp.slugify(((d.author && (d.author.unique_id || d.author.nickname)) || "tiktok") + "-" + (d.title || d.id || "video")).slice(0, 60);
    return base + (q === "hd" ? "_hd" : q === "wm" ? "_filigrane" : "") + ".mp4";
  },
  tkHtml: function () {
    var self = this, esc = window.AgnesApp.esc;
    return (this.tk || []).map(function (it, i) {
      if (it.err) return '<div class="ext-row"><span class="ext-tag err">échec</span><span class="grow hint" style="margin:0">' + esc(it.url) + ' — ' + esc(String(it.err).replace(/[.\s]+$/, '')) +
        '. Réessayez dans un moment, cochez le relais ci-dessus, ou utilisez le kit yt-dlp.</span></div>';
      var d = it.d, a = d.author || {}, dur = d.duration ? self.fmtTime(d.duration) : "";
      var btn = function (act, q, label, cls) { return '<button class="' + (cls || "small-btn") + '" data-tk="' + act + '" data-q="' + q + '" data-i="' + i + '">' + label + '</button>'; };
      return '<div class="ext-row">' + (d.cover ? '<img src="' + esc(self.abs(d.cover)) + '" alt="" style="width:54px;height:96px;object-fit:cover;border-radius:6px" referrerpolicy="no-referrer">' : '') +
        '<div class="grow"><b>' + esc((d.title || "Vidéo TikTok").slice(0, 120)) + '</b><br><span class="hint" style="margin:0">@' + esc(a.unique_id || a.nickname || "—") + (dur ? " · " + dur : "") +
        (d.play_count ? " · " + Number(d.play_count).toLocaleString("fr-FR") + " vues" : "") + '</span>' +
        '<div class="row-inline" style="margin-top:6px">' + btn("load", d.hdplay ? "hd" : "sd", "Analyser ici (script, images)", "primary-btn") +
        btn("save", d.hdplay ? "hd" : "sd", "⬇ Télécharger" + (d.hdplay ? " (HD)" : "")) + (d.hdplay ? btn("save", "sd", "⬇ Qualité standard") : "") +
        (d.wmplay ? btn("save", "wm", "⬇ Avec filigrane") : "") + btn("cover", "", "Couverture → Bibliothèque") + '</div></div></div>';
    }).join("");
  },
  // Récupère le fichier ; si le serveur refuse, on ouvre le lien pour « Enregistrer sous… »
  tkMedia: function (it, q, act, btn) {
    var self = this, core = this.core, url = this.tkUrl(it, q), name = this.tkName(it, q);
    if (!url) return core.toast("Lien vidéo absent pour cette qualité.", "err");
    var label = btn.textContent; btn.disabled = true; btn.textContent = "…";
    fetch(url, { referrerPolicy: "no-referrer" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }).then(function (b) {
      if (b.size < 20000) throw new Error("fichier vide");
      var blob = /video|octet/.test(b.type) ? new Blob([b], { type: "video/mp4" }) : b;
      if (act === "load") { self.setSource(blob, name); self.$("exPlayer").scrollIntoView({ behavior: "smooth", block: "center" }); core.toast("Vidéo chargée : passez au script ou aux images.", "ok"); }
      else { core.download(blob, name); core.toast("Téléchargement : " + name, "ok"); }
    }).catch(function (e) {
      window.open(url, "_blank", "noopener");
      core.toast("Téléchargement direct refusé (" + (e instanceof TypeError ? "blocage du serveur" : e.message) + ") : la vidéo s'ouvre dans un onglet — clic droit → « Enregistrer la vidéo sous… », puis glissez-la dans l'étape 2.", "err");
    }).finally(function () { btn.disabled = false; btn.textContent = label; });
  },
  tkCover: function (it) {
    var core = this.core, d = it.d, url = this.abs(d.origin_cover || d.cover);
    fetch(url, { referrerPolicy: "no-referrer" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
      .then(function (b) { return core.addToLibrary(b, { name: "Couverture " + ((d.author && d.author.unique_id) || "TikTok"), kind: "source" }); })
      .then(function () { core.toast("Couverture ajoutée à la Bibliothèque.", "ok"); })
      .catch(function (e) { core.toast("Couverture : " + (e.message || e), "err"); });
  },

  // ======================= 3. SCRIPT =======================
  // Audio de la source → Float32Array mono 16 kHz
  audio16k: function () {
    var blob = this.video;
    return blob.arrayBuffer().then(function (ab) {
      var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      return ctx.decodeAudioData(ab).then(function (buf) { ctx.close(); return buf; }, function () { ctx.close(); throw new Error("impossible de lire le son de ce fichier (pas de piste audio, ou format non pris en charge)"); });
    }).then(function (buf) {
      var off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * 16000)), 16000), src = off.createBufferSource();
      src.buffer = buf; src.connect(off.destination); src.start(0);
      return off.startRendering();
    }).then(function (r) { return r.getChannelData(0); });
  },
  transcribe: function () {
    var self = this, core = this.core, cfg = this.cfg, st = this.$("exTStatus"), btn = this.$("exTranscribe");
    if (!this.video) return core.toast("Choisissez d'abord une vidéo (étape 2).", "err");
    btn.disabled = true; st.textContent = "Lecture du son…";
    var job = this.audio16k().then(function (pcm) {
      if (pcm.length < 16000 * 0.5) throw new Error("piste audio vide");
      return cfg.engine === "openai" ? self.openaiTranscribe(pcm, st) : self.localTranscribe(pcm, st);
    });
    job.then(function (segs) {
      self.segments = segs.filter(function (s) { return s.text && s.text.trim(); });
      self.showScript(); st.textContent = self.segments.length ? "Terminé — " + self.segments.length + " passage(s)." : "Aucune parole détectée.";
      self.saveSegments();
    }).catch(function (e) { st.textContent = ""; core.toast("Transcription : " + (e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  },
  loadWhisper: function (model, st) {
    var self = this;
    if (this.asr && this.asrModel === model) return Promise.resolve(this.asr);
    st.textContent = "Chargement du moteur…";
    return import(this.TFJS).then(function (T) {
      T.env.allowLocalModels = false;
      try { T.env.backends.onnx.wasm.proxy = true; } catch (e) { }
      var files = {};
      var progress = function (p) {
        if (p.status === "progress" && p.file) { files[p.file] = p; }
        var list = Object.keys(files).map(function (k) { return files[k]; }), tot = list.reduce(function (a, f) { return a + (f.total || 0); }, 0), got = list.reduce(function (a, f) { return a + (f.loaded || 0); }, 0);
        if (tot) st.textContent = "Téléchargement du modèle (une seule fois)… " + Math.round(got / tot * 100) + " %";
      };
      var make = function (device) { return T.pipeline("automatic-speech-recognition", model, { device: device, progress_callback: progress }); };
      return (navigator.gpu ? make("webgpu").catch(function () { return make("wasm"); }) : make("wasm"));
    }).then(function (asr) { self.asr = asr; self.asrModel = model; return asr; })
      .catch(function (e) {
        if (location.protocol === "chrome-extension:") throw new Error("Whisper dans le navigateur n'est pas disponible dans Lumina (Chrome interdit le code distant dans une extension). Utilisez l'API OpenAI, un fichier de sous-titres, ou ouvrez Agnes directement (index.html) pour cette transcription.");
        throw new Error("moteur Whisper indisponible (" + (e.message || e) + "). Vérifiez la connexion internet pour le premier chargement, ou utilisez l'API OpenAI.");
      });
  },
  localTranscribe: function (pcm, st) {
    var cfg = this.cfg, dur = pcm.length / 16000;
    return this.loadWhisper(cfg.whisper, st).then(function (asr) {
      st.textContent = "Transcription en cours… (≈ " + Math.max(1, Math.round(dur / 60)) + " min d'audio)";
      var opts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, task: "transcribe" };
      if (cfg.lang) opts.language = cfg.lang;
      return asr(pcm, opts);
    }).then(function (out) {
      var chunks = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, dur], text: out.text || "" }];
      return chunks.map(function (c) { return { start: c.timestamp[0] || 0, end: c.timestamp[1] == null ? dur : c.timestamp[1], text: c.text }; });
    });
  },
  wav: function (pcm) {
    var n = pcm.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    function s(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    s(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); s(8, "WAVE"); s(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([ab], { type: "audio/wav" });
  },
  openaiTranscribe: function (pcm, st) {
    var self = this, cfg = this.cfg, key = cfg.openaiKey, base = "https://api.openai.com/v1";
    if (!key) { try { var t = JSON.parse(localStorage.getItem("agnes_plugin_tts") || "{}"); key = t.openaiKey; if (t.openaiBase) base = t.openaiBase.replace(/\/+$/, ""); } catch (e) { } }
    if (!key) return Promise.reject(new Error("clé OpenAI manquante (ici ou dans l'onglet Voix)"));
    var CH = 16000 * 600, parts = [], out = [], chain = Promise.resolve();   // morceaux de 10 min (< 25 Mo)
    for (var i = 0; i < pcm.length; i += CH) parts.push({ off: i / 16000, pcm: pcm.subarray(i, Math.min(pcm.length, i + CH)) });
    parts.forEach(function (p, k) {
      chain = chain.then(function () {
        st.textContent = "Envoi à OpenAI… " + (k + 1) + "/" + parts.length;
        var fd = new FormData(); fd.append("file", self.wav(p.pcm), "audio.wav"); fd.append("model", cfg.openaiModel);
        var lang = { french: "fr", english: "en", spanish: "es", arabic: "ar" }[cfg.lang]; if (lang) fd.append("language", lang);
        var verbose = cfg.openaiModel === "whisper-1";
        fd.append("response_format", verbose ? "verbose_json" : "json");
        if (verbose) fd.append("timestamp_granularities[]", "segment");
        return fetch(base + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd }).then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error((r.status === 401 ? "clé refusée" : "erreur " + r.status) + (j.error && j.error.message ? " — " + j.error.message : ""));
            if (j.segments && j.segments.length) j.segments.forEach(function (s) { out.push({ start: p.off + s.start, end: p.off + s.end, text: s.text }); });
            else out.push({ start: p.off, end: p.off + p.pcm.length / 16000, text: j.text || "" });
          });
        });
      });
    });
    return chain.then(function () { return out; });
  },
  parseSubs: function (t) {
    var out = [], toS = function (x) { var m = x.replace(",", ".").match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; };
    String(t).replace(/\r/g, "").split(/\n\s*\n/).forEach(function (b) {
      var lines = b.split("\n").filter(function (l) { return l.trim() && !/^WEBVTT|^NOTE|^\d+$/.test(l.trim()); });
      var ti = lines.findIndex(function (l) { return /-->/.test(l); }); if (ti < 0) return;
      var tt = lines[ti].split("-->"), text = lines.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      if (!text) return;
      var prev = out[out.length - 1];
      if (prev && prev.text === text) { prev.end = toS(tt[1]); return; } // doublons des sous-titres auto
      out.push({ start: toS(tt[0]), end: toS(tt[1]), text: text });
    });
    return out;
  },
  showScript: function () {
    var self = this, f = this.$("exFormat").value, segs = this.segments, txt;
    this.$("exScriptWrap").style.display = segs.length ? "" : "none";
    if (f === "srt") txt = segs.map(function (s, i) { return (i + 1) + "\n" + self.fmtTime(s.start, true) + " --> " + self.fmtTime(s.end, true) + "\n" + s.text.trim() + "\n"; }).join("\n");
    else if (f === "time") txt = segs.map(function (s) { return "[" + self.fmtTime(s.start) + "] " + s.text.trim(); }).join("\n");
    else {
      // texte : paragraphes aux pauses de plus de 1,2 s
      var paras = [], cur = "";
      segs.forEach(function (s, i) { var gap = i ? s.start - segs[i - 1].end : 0; if (gap > 1.2 && cur) { paras.push(cur.trim()); cur = ""; } cur += " " + s.text.trim(); });
      if (cur.trim()) paras.push(cur.trim()); txt = paras.join("\n\n");
    }
    this.$("exScript").value = txt;
  },

  // ======================= 4. IMAGES =======================
  seekVideo: function (v, t) {
    return new Promise(function (res) {
      var done = false, fin = function () { if (done) return; done = true; v.removeEventListener("seeked", fin); res(); };
      v.addEventListener("seeked", fin); v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.04)); setTimeout(fin, 3000);
    });
  },
  worker: function () {
    // vidéo cachée, indépendante du lecteur, pour les extractions
    var self = this;
    if (this.wv && this.wv.srcBlob === this.video) return Promise.resolve(this.wv);
    var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = this.videoUrl; v.srcBlob = this.video;
    return new Promise(function (res, rej) {
      v.onloadeddata = function () {
        if (isFinite(v.duration)) { self.wv = v; return res(v); }
        v.currentTime = 1e6; v.onseeked = function () { v.onseeked = null; self.wv = v; res(v); }; // WebM sans durée
      };
      v.onerror = function () { rej(new Error("vidéo illisible dans le navigateur")); };
    });
  },
  capture: function (t) {
    var self = this;
    return this.worker().then(function (v) {
      return self.seekVideo(v, t).then(function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext("2d").drawImage(v, 0, 0);
        return window.AgnesApp.canvasToBlob(c, self.cfg.fmt, 0.92);
      }).then(function (b) { return { t: t, blob: b, url: URL.createObjectURL(b), on: true }; });
    }).catch(function (e) { self.core.toast("Capture : " + e.message, "err"); return null; });
  },
  // Détection des coupes : différence moyenne entre images réduites (64×36, niveaux de gris)
  detectScenes: function (v, st) {
    var self = this, thr = this.cfg.threshold, step = 0.2, dur = v.duration, c = document.createElement("canvas"); c.width = 64; c.height = 36;
    var ctx = c.getContext("2d", { willReadFrequently: true }), prev = null, cuts = [0], t = 0;
    function next() {
      if (self.stop || t > dur) return Promise.resolve();
      return self.seekVideo(v, t).then(function () {
        ctx.drawImage(v, 0, 0, 64, 36);
        // comparaison des couleurs (et pas seulement de la luminosité) : deux plans aussi clairs l'un que l'autre restent distincts
        var d = ctx.getImageData(0, 0, 64, 36).data, g = new Float32Array(64 * 36 * 3), diff = 0;
        for (var i = 0, j = 0; i < d.length; i += 4) { g[j++] = d[i]; g[j++] = d[i + 1]; g[j++] = d[i + 2]; }
        if (prev) { for (var k = 0; k < g.length; k++) diff += Math.abs(g[k] - prev[k]); diff /= g.length; }
        if (prev && diff > thr && t - cuts[cuts.length - 1] > 0.5) cuts.push(t);
        prev = g; st.textContent = "Analyse des coupes… " + Math.round(t / dur * 100) + " % · " + cuts.length + " plan(s)";
        t += step; return next();
      });
    }
    return next().then(function () {
      var pick = self.cfg.pick;
      return cuts.map(function (a, i) {
        var b = i + 1 < cuts.length ? cuts[i + 1] : dur;
        return pick === "first" ? a + 0.05 : pick === "last" ? Math.max(a, b - 0.12) : (a + b) / 2;
      });
    });
  },
  extract: function () {
    var self = this, core = this.core, cfg = this.cfg, st = this.$("exFStatus");
    if (!this.video || /^audio\//.test(this.video.type)) return core.toast("Choisissez d'abord une vidéo (étape 2).", "err");
    this.stop = false; this.$("exStop").style.display = ""; this.$("exExtract").disabled = true;
    this.worker().then(function (v) {
      var dur = v.duration, times;
      if (cfg.mode === "scenes") return self.detectScenes(v, st);
      if (cfg.mode === "every") { times = []; for (var t = 0; t < dur; t += cfg.every) times.push(t); return times; }
      if (cfg.mode === "count") { times = []; for (var i = 0; i < cfg.count; i++) times.push(dur * (i + 0.5) / cfg.count); return times; }
      return [0.02, Math.max(0, dur - 0.08)];
    }).then(function (times) {
      if (times.length > 300) { times = times.slice(0, 300); core.toast("Limité à 300 images."); }
      var n = 0, chain = Promise.resolve();
      times.forEach(function (t) {
        chain = chain.then(function () {
          if (self.stop) return;
          return self.capture(t).then(function (f) { if (f) { self.frames.push(f); n++; st.textContent = "Extraction… " + n + "/" + times.length; if (n % 6 === 0) self.renderFrames(); } });
        });
      });
      return chain.then(function () { return n; });
    }).then(function (n) {
      self.frames.sort(function (a, b) { return a.t - b.t; }); self.renderFrames();
      st.textContent = (self.stop ? "Arrêté — " : "") + n + " image(s) extraite(s).";
      self.saveFrames();
    }).catch(function (e) { core.toast("Extraction : " + e.message, "err"); st.textContent = ""; })
      .finally(function () { self.$("exStop").style.display = "none"; self.$("exExtract").disabled = false; });
  },
  renderFrames: function () {
    var self = this;
    this.$("exFramesWrap").style.display = this.frames.length ? "" : "none";
    this.$("exFrames").innerHTML = this.frames.map(function (f, i) {
      return '<label style="display:flex;flex-direction:column;gap:4px;cursor:pointer"><img src="' + f.url + '" alt="Image à ' + self.fmtTime(f.t) + '" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;opacity:' + (f.on ? 1 : .45) + '">' +
        '<span class="hint" style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" data-fi="' + i + '"' + (f.on ? " checked" : "") + '> ' + String(i + 1).padStart(2, "0") +
        ' · <button type="button" class="small-btn" data-seek="' + f.t + '" style="padding:0 6px" title="Voir dans le lecteur">' + self.fmtTime(f.t) + '</button></span></label>';
    }).join("");
  },
  selected: function () { return this.frames.filter(function (f) { return f.on; }); },
  frameName: function (i) { var ext = this.cfg.fmt === "image/png" ? "png" : "jpg"; return String(i + 1).padStart(2, "0") + "." + ext; },
  zipFrames: function () {
    var self = this, core = this.core, App = window.AgnesApp, sel = this.selected();
    if (!sel.length) return core.toast("Aucune image cochée.", "err");
    var zip = new JSZip();
    sel.forEach(function (f, i) { zip.file(self.frameName(i), f.blob); });
    zip.file("timecodes.txt", sel.map(function (f, i) { return self.frameName(i) + "  " + self.fmtTime(f.t) + "  (" + f.t.toFixed(2) + " s)"; }).join("\r\n"));
    zip.generateAsync({ type: "blob" }).then(function (b) { core.download(b, App.slugify(self.srcName.replace(/\.[^.]+$/, "") || "video") + "_images.zip"); });
  },
  framesToLibrary: function () {
    var self = this, core = this.core, sel = this.selected(), kind = this.$("exLibKind").value, chain = Promise.resolve(), base = this.srcName.replace(/\.[^.]+$/, "").slice(0, 30) || "Image";
    if (!sel.length) return core.toast("Aucune image cochée.", "err");
    sel.forEach(function (f) { chain = chain.then(function () { return core.addToLibrary(f.blob, { name: base + " " + self.fmtTime(f.t), kind: kind }); }); });
    chain.then(function () { core.toast(sel.length + " image(s) ajoutée(s) à la Bibliothèque.", "ok"); });
  },
  framesToStills: function () {
    var self = this, core = this.core, App = window.AgnesApp, sel = this.selected();
    if (!sel.length) return core.toast("Aucune image cochée.", "err");
    if (!AgnesPlugins.isLoaded("stills")) return core.toast("Activez l'extension « Stills → Clip » dans ⚙.", "err");
    var files = sel.map(function (f, i) { return new File([f.blob], self.frameName(i), { type: f.blob.type, lastModified: Date.now() }); });
    AgnesPlugins.get("stills").addFiles(files);
    App.showView("view_stills");
    core.toast(files.length + " image(s) envoyée(s) dans Stills → Clip, numérotées dans l'ordre.", "ok");
  },

  // =========================================================
  // ENREGISTREMENT DANS LE PROJET
  // proj.extract = { links, tk[], veille{}, sessions[], current }
  // session = { id, name, srcKey, segments[], scriptEdit, scriptFmt, frames[{ t, key, on }], convInstr, convOut, at }
  // Fichiers dans IndexedDB : « extract:v:<session> » (vidéo), « extract:f:<session>:<id> » (images)
  // =========================================================
  st: function () {
    var p = this.core.getProject();
    if (!p.extract) p.extract = { links: "", tk: [], veille: {}, sessions: [], current: null };
    if (!p.extract.veille) p.extract.veille = {};
    return p.extract;
  },
  session: function () { var st = this.st(); return st.sessions.find(function (x) { return x.id === st.current; }) || null; },
  saveSoon: function () { var self = this; clearTimeout(this._sv); this._sv = setTimeout(function () { self.core.saveProject(); }, 400); },
  newSession: function (blob, name) {
    var st = this.st(), id = window.AgnesApp.uid(), ss = { id: id, name: name || "vidéo", srcKey: "extract:v:" + id, segments: [], scriptEdit: null, frames: [], convInstr: "", convOut: "", at: Date.now() };
    st.sessions.unshift(ss); st.current = id;
    // on repart d'une page propre pour cette vidéo
    this.segments = []; this.showScript(); this.clearFramesUI();
    this.$("exConvInstr").value = ""; this.$("exConvOut").value = "";
    this.core.store.put(ss.srcKey, blob);
    if (st.sessions.length > 30) { var old = st.sessions.pop(); this.dropSessionFiles(old); }
    this.core.saveProject(); this.renderSessions();
  },
  saveSegments: function () { var ss = this.session(); if (!ss) return; ss.segments = this.segments.slice(); ss.scriptEdit = null; this.core.saveProject(); },
  saveFrames: function () {
    var self = this, ss = this.session(); if (!ss) return;
    var store = this.core.store, keep = {};
    ss.frames = this.frames.map(function (f) {
      if (!f.key) { f.key = "extract:f:" + ss.id + ":" + window.AgnesApp.uid(); store.put(f.key, f.blob); }
      keep[f.key] = 1; return { t: f.t, key: f.key, on: !!f.on };
    });
    (ss._keys || []).forEach(function (k) { if (!keep[k]) store.del(k); });
    ss._keys = Object.keys(keep);
    this.saveSoon();
  },
  clearFramesUI: function () { this.frames.forEach(function (f) { if (f.url) URL.revokeObjectURL(f.url); }); this.frames = []; this.renderFrames(); },
  dropSessionFiles: function (ss) {
    var store = this.core.store; store.del(ss.srcKey); (ss.frames || []).forEach(function (f) { store.del(f.key); });
  },
  renderSessions: function () {
    var st = this.st(), esc = window.AgnesApp.esc;
    this.$("exSessBar").style.display = st.sessions.length ? "" : "none";
    this.$("exSess").innerHTML = st.sessions.map(function (x) {
      return '<option value="' + x.id + '"' + (x.id === st.current ? " selected" : "") + '>' + esc(x.name) + ' — ' + new Date(x.at).toLocaleDateString("fr-FR") +
        (x.segments && x.segments.length ? " · script" : "") + (x.frames && x.frames.length ? " · " + x.frames.length + " image(s)" : "") + '</option>';
    }).join("");
  },
  openSession: function (id) {
    var self = this, st = this.st(), ss = st.sessions.find(function (x) { return x.id === id; }); if (!ss) return Promise.resolve();
    st.current = id; this.saveSoon();
    this.segments = (ss.segments || []).slice(); this.clearFramesUI();
    return this.core.store.get(ss.srcKey).then(function (blob) {
      if (blob) self.setSource(blob, ss.name, true);
      else { self.video = null; self.srcName = ss.name; self.$("exPlayer").style.display = "none"; self.$("exSrcInfo").textContent = ss.name + " (fichier vidéo indisponible : glissez-le à nouveau pour extraire des images)"; }
      self.showScript();
      if (ss.scriptEdit != null) { if (ss.scriptFmt) self.$("exFormat").value = ss.scriptFmt; self.$("exScript").value = ss.scriptEdit; self.$("exScriptWrap").style.display = ""; }
      self.$("exConvInstr").value = ss.convInstr || ""; self.$("exConvOut").value = ss.convOut || "";
      self.$("exConvBox").style.display = ss.convOut || ss.convInstr ? "" : "none";
      return Promise.all((ss.frames || []).map(function (f) {
        return self.core.store.get(f.key).then(function (b) { return b ? { t: f.t, key: f.key, blob: b, url: URL.createObjectURL(b), on: f.on } : null; });
      }));
    }).then(function (fr) {
      if (!fr) return;
      self.frames = fr.filter(Boolean).sort(function (a, b) { return a.t - b.t; }); ss._keys = self.frames.map(function (f) { return f.key; });
      self.renderFrames(); self.renderSessions();
    });
  },
  deleteSession: function (id) {
    var st = this.st(), ss = st.sessions.find(function (x) { return x.id === id; });
    if (!ss || !window.confirm("Retirer « " + ss.name + " » de la liste ? Sa vidéo, son script et ses images enregistrés sont supprimés de l'app.")) return;
    this.dropSessionFiles(ss); st.sessions = st.sessions.filter(function (x) { return x.id !== id; });
    st.current = st.sessions.length ? st.sessions[0].id : null; this.core.saveProject();
    if (st.current) this.openSession(st.current); else this.resetView();
    this.renderSessions();
  },
  resetView: function () {
    this.video = null; this.srcName = ""; this.segments = []; this.showScript(); this.clearFramesUI();
    var v = this.$("exPlayer"); v.removeAttribute("src"); v.style.display = "none"; this.$("exSrcInfo").textContent = "";
    this.$("exConvInstr").value = ""; this.$("exConvOut").value = ""; this.$("exConvBox").style.display = "none";
  },
  // À l'ouverture de l'app ou au changement de projet : on retrouve tout
  restore: function () {
    if (!this.core.getProject()) return;
    var st = this.st(), self = this;
    this.$("exLinks").value = st.links || "";
    this.tk = (st.tk || []).slice(); this.$("exTk").innerHTML = this.tk.length ? this.tkHtml() : "";
    this.veilleFillForm(); this.veilleRender();
    this.renderSessions();
    if (st.current) this.openSession(st.current); else this.resetView();
  },

  // =========================================================
  // VEILLE (TikWM : recherche TikTok + statistiques)
  // =========================================================
  veilleSaveForm: function () {
    var v = this.st().veille, $ = this.$.bind(this);
    v.cat = $("exVCat").value; v.keys = $("exVKeys").value; v.period = +$("exVPeriod").value; v.sort = $("exVSort").value;
    v.keep = +$("exVKeep").value; v.maxDur = +$("exVMaxDur").value || 0; this.saveSoon();
  },
  veilleFillForm: function () {
    var v = this.st().veille, $ = this.$.bind(this);
    $("exVCat").value = v.cat || ""; $("exVKeys").value = v.keys || ""; $("exVPeriod").value = String(v.period != null ? v.period : 30);
    $("exVSort").value = v.sort || "play"; $("exVKeep").value = String(v.keep || 20); $("exVMaxDur").value = v.maxDur || "";
  },
  atelier: function () {
    var at = window.AgnesPlugins && AgnesPlugins.get("atelier");
    if (!at || !at.chat) throw new Error("activez l'extension Atelier IA (⚙) : elle fournit l'IA (Agnes par défaut)");
    return at;
  },
  veilleSuggest: function () {
    var self = this, core = this.core, v = this.st().veille, btn = this.$("exVSuggest");
    this.veilleSaveForm();
    if (!v.cat) return core.toast("Décrivez d'abord votre catégorie ou votre série.", "err");
    var at; try { at = this.atelier(); } catch (e) { return core.toast(e.message, "err"); }
    btn.disabled = true; btn.textContent = "L'IA cherche des mots-clés…";
    at.chat([{ role: "system", content: "Tu es expert des tendances TikTok francophones. Réponds uniquement par une liste de 8 recherches TikTok, une par ligne, sans numéro ni commentaire : mots-clés courts et hashtags sans #, en français surtout, 2 en anglais." },
      { role: "user", content: "Catégorie : " + v.cat }], { temperature: 0.5, max_tokens: 200 })
      .then(function (m) {
        var keys = String(m.content || "").split(/\n+/).map(function (l) { return l.replace(/^[\s\-*•\d.)#]+/, "").trim(); }).filter(function (l) { return l && l.length < 60; }).slice(0, 10);
        if (!keys.length) throw new Error("réponse vide");
        self.$("exVKeys").value = keys.join("\n"); self.veilleSaveForm();
        core.toast(keys.length + " mots-clés proposés : modifiez-les si besoin, puis « Chercher ».", "ok");
      }).catch(function (e) { core.toast("Mots-clés : " + (e.display || e.message || e), "err"); })
      .finally(function () { btn.disabled = false; btn.textContent = "✨ Proposer des mots-clés (IA)"; });
  },
  // Recherche TikWM : GET puis POST, relais allOrigins si coché
  tikwmSearch: function (kw, cursor) {
    var self = this, params = { keywords: kw, count: "30", cursor: String(cursor || 0), HD: "1", region: "FR" };
    var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&"), url = this.TIKWM + "/api/feed/search?" + qs;
    function parse(j) {
      if (j && typeof j.contents === "string") { try { j = JSON.parse(j.contents); } catch (e) { } }
      if (!j || (j.code != null && j.code !== 0)) throw new Error((j && j.msg) || "réponse TikWM invalide");
      var d = j.data || {}; return { videos: d.videos || d.aweme_list || (Array.isArray(d) ? d : []), cursor: d.cursor, more: !!d.hasMore };
    }
    var tries = [function () { return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(parse); },
      function () { return fetch(self.TIKWM + "/api/feed/search", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(parse); }];
    if (this.cfg.tkProxy) tries.push(function () { return fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(url)).then(function (r) { return r.json(); }).then(parse); });
    var chain = Promise.reject(), last = null;
    tries.forEach(function (t) { chain = chain.catch(function (e) { if (e) last = e; return t(); }); });
    return chain.catch(function (e) { throw e && e.message ? e : last || new Error("échec"); });
  },
  veilleSearch: function () {
    var self = this, core = this.core, v = this.st().veille, btn = this.$("exVSearch"), out = this.$("exVOut");
    this.veilleSaveForm();
    var keys = String(v.keys || "").split(/\n+/).map(function (k) { return k.replace(/^#/, "").trim(); }).filter(Boolean).slice(0, 12);
    if (!keys.length) return core.toast("Écrivez au moins un mot-clé (ou « Proposer des mots-clés »).", "err");
    btn.disabled = true; var found = {}, errors = [], chain = Promise.resolve();
    keys.forEach(function (kw, i) {
      chain = chain.then(function () {
        out.innerHTML = '<p class="hint">Recherche « ' + window.AgnesApp.esc(kw) + ' » (' + (i + 1) + '/' + keys.length + ')…</p>';
        return self.tikwmSearch(kw, 0).then(function (r) {
          r.videos.forEach(function (x) {
            var id = String(x.video_id || x.aweme_id || x.id || ""); if (!id) return;
            var a = x.author || {}, user = a.unique_id || a.uniqueId || "";
            var item = found[id] || { id: id, url: "https://www.tiktok.com/@" + (user || "_") + "/video/" + id, title: x.title || x.desc || "", user: user, cover: self.abs(x.cover || x.origin_cover || ""),
              dur: +x.duration || 0, play: +x.play_count || 0, like: +x.digg_count || 0, comment: +x.comment_count || 0, share: +x.share_count || 0, time: +x.create_time || 0, keys: [], on: false };
            if (item.keys.indexOf(kw) === -1) item.keys.push(kw);
            found[id] = item;
          });
        }, function (e) { errors.push(kw + " : " + (e.message || e)); })
          .then(function () { return new Promise(function (res) { setTimeout(res, 1200); }); });   // TikWM : ~1 requête / s
      });
    });
    chain.then(function () {
      v.results = Object.keys(found).map(function (k) { return found[k]; }); v.at = Date.now(); v.analysis = "";
      self.veilleView().slice(0, 5).forEach(function (r) { r.on = true; });
      core.saveProject(); self.veilleRender();
      if (!v.results.length) core.toast("Aucune vidéo trouvée" + (errors.length ? " — " + errors[0] + ". Réessayez dans une minute ou cochez le relais allOrigins (étape 1)." : "."), "err");
      else core.toast(v.results.length + " vidéo(s) trouvée(s) ; les " + Math.min(v.keep || 20, self.veilleView().length) + " meilleures sont affichées" + (errors.length ? " (" + errors.length + " recherche(s) en échec)" : "") + ".", "ok");
    }).finally(function () { btn.disabled = false; });
  },
  // Résultats filtrés (période, durée) et classés
  veilleView: function () {
    var v = this.st().veille, now = Date.now() / 1000, list = (v.results || []).slice();
    if (v.period) list = list.filter(function (r) { return !r.time || now - r.time <= v.period * 86400; });
    if (v.maxDur) list = list.filter(function (r) { return !r.dur || r.dur <= v.maxDur; });
    var score = { play: function (r) { return r.play; }, like: function (r) { return r.like; }, share: function (r) { return r.share; },
      eng: function (r) { return r.play > 500 ? (r.like + r.comment * 2 + r.share * 3) / r.play : 0; } }[v.sort || "play"];
    return list.sort(function (a, b) { return score(b) - score(a); }).slice(0, v.keep || 20);
  },
  veilleRender: function () {
    var self = this, v = this.st().veille, out = this.$("exVOut"), esc = window.AgnesApp.esc, list = this.veilleView();
    if (!v.results || !v.results.length) { out.innerHTML = ""; return; }
    var n = function (x) { return x >= 1e6 ? (x / 1e6).toFixed(1).replace(".", ",") + " M" : x >= 1e3 ? Math.round(x / 1e3) + " k" : String(x); };
    var all = v.results;
    out.innerHTML = '<p class="hint" style="margin:0 0 8px">' + list.length + ' vidéo(s) affichée(s) sur ' + all.length + ' trouvée(s)' + (v.at ? ' · recherche du ' + new Date(v.at).toLocaleString("fr-FR") : '') + '</p>' +
      list.map(function (r) {
        var i = all.indexOf(r), eng = r.play ? Math.round((r.like + r.comment + r.share) / r.play * 1000) / 10 : 0;
        return '<div class="ext-row ex-vrow"><input type="checkbox" data-vi="' + i + '"' + (r.on ? " checked" : "") + ' aria-label="Garder cette vidéo">' +
          (r.cover ? '<img src="' + esc(r.cover) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ex-vnocover"></span>') +
          '<div class="grow"><b>' + esc((r.title || "Vidéo TikTok").slice(0, 110)) + '</b><br><span class="hint" style="margin:0">@' + esc(r.user || "—") +
          (r.time ? ' · ' + new Date(r.time * 1000).toLocaleDateString("fr-FR") : '') + (r.dur ? ' · ' + r.dur + ' s' : '') + ' · via « ' + esc(r.keys.join(", ")) + ' »</span>' +
          '<div class="ex-vstats"><span>👁 ' + n(r.play) + '</span><span>❤ ' + n(r.like) + '</span><span>💬 ' + n(r.comment) + '</span><span>↗ ' + n(r.share) + '</span><span>' + eng + ' % d\'engagement</span>' +
          '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">ouvrir</a></div></div></div>';
      }).join("") +
      '<div class="row-inline" style="margin-top:8px"><button class="small-btn" data-vact="all" type="button">Tout cocher / décocher</button>' +
      '<button class="primary-btn" data-vact="add" type="button">Ajouter les liens cochés → 1. Télécharger</button>' +
      '<button class="small-btn" data-vact="fetch" type="button">Ajouter et récupérer ici</button>' +
      '<button class="small-btn" data-vact="why" type="button">✨ Ce qui marche (analyse IA)</button></div>' +
      (v.analysis ? '<div class="refs-block ex-vana" style="margin-top:10px">' + esc(v.analysis) + '</div>' : '');
  },
  veilleToLinks: function (fetchNow) {
    var core = this.core, st = this.st(), sel = this.veilleView().filter(function (r) { return r.on; });
    if (!sel.length) return core.toast("Cochez au moins une vidéo.", "err");
    var ta = this.$("exLinks"), have = ta.value.split(/\s+/).filter(Boolean), added = 0;
    sel.forEach(function (r) { if (have.indexOf(r.url) === -1) { have.push(r.url); added++; } });
    ta.value = have.join("\n"); st.links = ta.value; this.saveSoon();
    ta.scrollIntoView({ behavior: "smooth", block: "center" });
    core.toast(added + " lien(s) ajouté(s) au champ « 1. Télécharger depuis un lien »" + (added < sel.length ? " (les autres y étaient déjà)" : "") + ".", "ok");
    if (fetchNow) this.fetchTikToks();
  },
  veilleAnalyse: function (btn) {
    var self = this, core = this.core, v = this.st().veille, list = this.veilleView();
    var at; try { at = this.atelier(); } catch (e) { return core.toast(e.message, "err"); }
    btn.disabled = true; btn.textContent = "Analyse…";
    var rows = list.map(function (r, i) { return (i + 1) + ". « " + (r.title || "").slice(0, 150) + " » — " + r.play + " vues, " + r.like + " likes, " + r.share + " partages, " + (r.dur || "?") + " s, @" + r.user; }).join("\n");
    at.chat([{ role: "system", content: "Tu es stratège de contenu TikTok. Analyse ces vidéos performantes et réponds en français, en texte simple (pas de tableau), en 10 points courts maximum : accroches qui reviennent, formats et durées, thèmes, ton, ce qui déclenche les partages, et 3 idées de vidéos à produire pour la catégorie." },
      { role: "user", content: "Catégorie : " + (v.cat || "—") + "\n\n" + rows }], { temperature: 0.4, max_tokens: 900 })
      .then(function (m) { v.analysis = String(m.content || "").trim(); self.core.saveProject(); self.veilleRender(); })
      .catch(function (e) { core.toast("Analyse : " + (e.display || e.message || e), "err"); btn.disabled = false; btn.textContent = "✨ Ce qui marche (analyse IA)"; });
  },

  // =========================================================
  // SCRIPT → ATELIER / PROMPTS
  // =========================================================
  scriptText: function () {
    var t = this.$("exScript").value.trim();
    return t || this.segments.map(function (s) { return "[" + this.fmtTime(s.start) + "] " + s.text.trim(); }, this).join("\n");
  },
  scriptToAtelier: function () {
    var core = this.core, at = window.AgnesPlugins && AgnesPlugins.get("atelier");
    if (!at || !at.addDoc) return core.toast("Activez l'extension Atelier IA (⚙).", "err");
    var t = this.scriptText(); if (!t) return core.toast("Pas encore de script : transcrivez d'abord la vidéo.", "err");
    at.addDoc("Script de « " + (this.srcName || "vidéo") + " »", t, "texte");
    window.AgnesApp.showView("view_atelier");
    core.toast("Script ajouté aux documents de l'Atelier : demandez par exemple « @8 adapte ce script en prompts image ».", "ok");
  },
  // Plans : les images extraites (une par plan) ; sinon un plan par passage du script
  plans: function () {
    var self = this, fr = this.selected().slice().sort(function (a, b) { return a.t - b.t; }), segs = this.segments;
    var dur = this.$("exPlayer").duration || (segs.length ? segs[segs.length - 1].end : 0);
    var plans = fr.length ? fr.map(function (f, i) {
      var a = i ? (fr[i - 1].t + f.t) / 2 : 0, b = i + 1 < fr.length ? (f.t + fr[i + 1].t) / 2 : (isFinite(dur) && dur ? dur : f.t + 3);
      return { start: a, end: b, frame: f };
    }) : segs.map(function (s) { return { start: s.start, end: s.end }; });
    plans.forEach(function (p) {
      p.speech = segs.filter(function (s) { var m = (s.start + s.end) / 2; return m >= p.start && m < p.end; }).map(function (s) { return s.text.trim(); }).join(" ");
    });
    if (!plans.length && this.$("exScript").value.trim()) plans = this.$("exScript").value.trim().split(/\n{2,}/).map(function (t) { return { start: 0, end: 0, speech: t }; });
    return plans;
  },
  thumbData: function (blob) {
    return window.AgnesApp.loadImage(URL.createObjectURL(blob)).then(function (img) {
      var k = 448 / Math.max(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.7);
    });
  },
  convertToPrompts: function () {
    var self = this, core = this.core, $ = this.$.bind(this), st = $("exConvSt"), btn = $("exConvGo"), ss = this.session();
    var at; try { at = this.atelier(); } catch (e) { return core.toast(e.message, "err"); }
    var plans = this.plans(); if (!plans.length) return core.toast("Transcrivez la vidéo (étape 3) ou extrayez ses images (étape 4) d'abord.", "err");
    if (plans.length > 40) { plans = plans.slice(0, 40); core.toast("Limité aux 40 premiers plans."); }
    var instr = $("exConvInstr").value.trim(), useImgs = $("exConvImgs").checked && plans.some(function (p) { return p.frame; }), useBible = $("exConvBible").checked;
    if (ss) { ss.convInstr = instr; self.saveSoon(); }
    var ctx = "";
    if (useBible) {
      var B = window.AgnesPlugins && AgnesPlugins.get("bible"), s = B && B.series && B.series();
      if (s) ctx += "\nBIBLE (personnages et lieux de ma série) :\n" + s.entries.map(function (e) { return "- " + e.name + " (" + e.kind + ")" + (e.dna ? " : " + e.dna : ""); }).join("\n") + (s.style ? "\nStyle commun : " + s.style : "");
      var lib = (core.getProject().library || []).filter(function (l) { return l.kind !== "source"; }).map(function (l) { return l.name; });
      if (lib.length) ctx += "\nNOMS DANS MA BIBLIOTHÈQUE (à utiliser tels quels dans RÉF :) : " + lib.join(", ");
    }
    if (at.skillsText) ctx += "\nSKILLS DE L'APP (facultatif) : tu peux ajouter à chaque bloc une ligne « SKILLS : » avec 1 à 3 noms EXACTS de cette liste ; l'app ajoute leur texte au prompt.\n" + at.skillsText();
    var sys = "Tu es réalisateur et prompt designer pour des séries verticales générées par IA (images Agnes Image 2.5, vidéos Agnes Video 2.5 de 4 à 12 s). " +
      "On te donne une vidéo de référence découpée en plans (avec la parole et, si fournie, une image de chaque plan). Réécris-la plan par plan en prompts, en suivant la consigne d'adaptation. " +
      "Réponds UNIQUEMENT avec ce format, un bloc par plan, dans l'ordre, ligne vide entre les blocs :\n01 — libellé court en français\nIMAGE : prompt en anglais (sujet, cadrage, lumière, décor, style ; image fixe, sans texte)\nVIDÉO : en anglais, le mouvement à partir de l'image (geste, regard, caméra), un seul plan continu ; durée conseillée entre crochets, ex. [5 s]\nRÉF : noms des personnages et lieux présents (ceux de la Bibliothèque si fournis)\nSKILLS : (facultatif) noms exacts de skills de l'app\n" +
      "Garde le cadrage et le rythme de chaque plan de référence. Jamais de texte, sous-titres, logo ni musique dans les prompts. Les dialogues ne vont pas dans les prompts.";
    var head = "CONSIGNE D'ADAPTATION : " + (instr || "Recrée fidèlement la vidéo (mêmes cadrages, même rythme) avec des personnages et décors originaux.") + ctx + "\n\nPLANS DE LA VIDÉO DE RÉFÉRENCE (" + plans.length + ") :";
    var lines = plans.map(function (p, i) { return String(i + 1).padStart(2, "0") + " [" + self.fmtTime(p.start) + "–" + self.fmtTime(p.end) + "]" + (p.speech ? " parole : « " + p.speech + " »" : " (sans parole)"); });
    btn.disabled = true; st.textContent = useImgs ? "Préparation des images…" : "Conversion…";
    (useImgs ? Promise.all(plans.map(function (p) { return p.frame ? self.thumbData(p.frame.blob) : null; })) : Promise.resolve(null)).then(function (imgs) {
      var content;
      if (imgs) {
        content = [{ type: "text", text: head }];
        lines.forEach(function (l, i) { content.push({ type: "text", text: l }); if (imgs[i]) content.push({ type: "image_url", image_url: { url: imgs[i] } }); });
      } else content = head + "\n" + lines.join("\n");
      st.textContent = "Conversion par l'IA…";
      var msgs = [{ role: "system", content: sys }, { role: "user", content: content }];
      return at.chat(msgs, { temperature: 0.6, max_tokens: 8000 }).catch(function (e) {
        if (!imgs) throw e;
        st.textContent = "Ce modèle ne lit pas les images : nouvel essai sans elles…";
        return at.chat([{ role: "system", content: sys }, { role: "user", content: head + "\n" + lines.join("\n") }], { temperature: 0.6, max_tokens: 8000 });
      });
    }).then(function (m) {
      var out = String(m.content || "").replace(/^```[a-z]*\n?|```$/g, "").trim();
      $("exConvOut").value = out; if (ss) { ss.convOut = out; self.core.saveProject(); }
      var n = (out.match(/^\s*\d{1,3}\s*[—–-]/mg) || []).length;
      st.textContent = n + " plan(s) écrit(s)" + (m._provider ? " par " + m._provider + (m._model ? " (" + m._model + ")" : "") : "") + ". Relisez, puis « → Le lot ».";
    }).catch(function (e) { st.textContent = ""; core.toast("Conversion : " + (e.display || e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  },
  convToLot: function () {
    var core = this.core, t = this.$("exConvOut").value.trim(), ta = document.getElementById("batchScript"), op = document.getElementById("batchOp");
    if (!t) return core.toast("Rien à envoyer : lancez d'abord « Convertir ».", "err");
    if (!ta || !op) return core.toast("Onglet Le lot introuvable.", "err");
    if (ta.value.trim() && !window.confirm("Le lot contient déjà un script. Le remplacer ?")) return;
    op.value = "script"; op.dispatchEvent(new Event("change")); ta.value = t; ta.dispatchEvent(new Event("input"));
    window.AgnesApp.showView("viewBatch");
    core.toast("Script placé dans Le lot : vérifiez la liste et les références, puis « Créer les plans ».", "ok");
  }
});
