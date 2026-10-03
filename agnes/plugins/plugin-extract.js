// plugins/plugin-extract.js — Extracteur : téléchargement par lien, script (transcription), images d'une vidéo
// 1. Lien → vidéo : le pont local utilise yt-dlp pour charger une vidéo publique directement dans l'analyse.
//    Le kit .bat / .sh reste disponible comme solution de secours. Les liens directs vers un fichier .mp4
//    sont récupérés dans le navigateur quand le serveur l'autorise.
// 2. Script : transcription Whisper dans le navigateur (gratuit, privé, modèle téléchargé une fois) ou API OpenAI,
//    ou import de sous-titres .srt/.vtt. Export texte / timecodes / .srt, envoi vers l'onglet Scénario.
// 3. Images : extraction toutes les N secondes, N images réparties, une image par plan (détection des coupes)
//    ou capture manuelle ; export .zip, envoi vers la Bibliothèque ou vers Stills → Clip.
AgnesPlugins.register("extracteur", {
  name: "Extracteur (lien, script, images)",
  version: "2.0",
  TIKWM: "https://www.tikwm.com",
  TFJS: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.frames = []; this.segments = []; this.video = null; this.srcName = ""; this.sourceUrl = ""; this.metaSeq = 0; this.metaInfo = null;
    this.transformersPromise = null; this.asrLoading = null; this.asrLoadingModel = "";
    var cfg = core.pluginSettings("extracteur", {
      dlQuality: "1080", dlSubs: true, dlAudio: false,
      engine: "local", whisper: "Xenova/whisper-small", lang: "french", openaiKey: "", openaiModel: "whisper-1",
      mode: "scenes", every: 2, count: 12, threshold: 30, pick: "middle", fmt: "image/jpeg"
    });
    this.cfg = cfg;
    // Migration unique : l'ancien réglage par défaut chargeait whisper-small en WebGPU et pouvait faire
    // recharger l'onglet par manque de mémoire. On repart une fois sur le modèle léger et stable.
    if (!cfg.whisperStableWasm) {
      cfg.whisper = "Xenova/whisper-base";
      cfg.whisperStableWasm = true;
      cfg.save();
    }

    var view = core.ui.addTab("extraire", "Extraire",
      '<p class="hint">Pour vos propres vidéos, ou pour analyser une référence. Republier le contenu d\'un autre créateur demande son accord.</p>' +
      // ---------- 0. Veille ----------
      '<div class="card"><h3>🔎 Veille — vidéos performantes de votre catégorie</h3>' +
      '<p class="hint" style="margin-top:0">L\'IA propose des mots-clés, puis l\'app repère des vidéos TikTok et vérifie leurs statistiques publiques (compte, vues, likes, commentaires, partages et date). ' +
      'Le classement porte sur les résultats accessibles au moment de la recherche : il ne garantit pas le classement global de TikTok. Les liens cochés vont dans « 1. Télécharger depuis un lien ».</p>' +
      '<div class="grid2"><div class="field"><label for="exVCat">Catégorie ou série</label><input type="text" id="exVCat" placeholder="Ex. mini-séries dramatiques avec des personnages fruits IA"></div>' +
      '<div class="field"><label for="exVKeys">Mots-clés TikTok (un par ligne)</label><textarea id="exVKeys" rows="3" placeholder="fruit drama&#10;aidrama&#10;série ia"></textarea></div></div>' +
      '<div class="row-inline"><button class="small-btn" id="exVSuggest" type="button">✨ Proposer des mots-clés (IA)</button>' +
      '<label class="inline">Pays cible <input type="text" id="exVCountry" placeholder="Monde / France / Japon…" style="width:155px"></label>' +
      '<label class="inline">Période <select id="exVPeriod" style="width:auto"><option value="0">Toutes</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">3 mois</option><option value="180">6 mois</option></select></label>' +
      '<label class="inline">Classer par <select id="exVSort" style="width:auto"><option value="play">Vues</option><option value="like">Likes</option><option value="share">Partages</option><option value="eng">Engagement</option></select></label>' +
      '<label class="inline">Garder <select id="exVKeep" style="width:auto"><option>10</option><option>20</option><option>30</option><option>50</option></select></label>' +
      '<label class="inline">Durée max <input type="number" id="exVMaxDur" min="0" placeholder="—" style="width:70px"> s</label>' +
      '<button class="primary-btn" id="exVSearch" type="button">Chercher</button>' +
      '<button class="small-btn" id="exVCodex" type="button">🌐 Recherche renforcée (Codex + TikTok)</button></div>' +
      '<p class="hint" style="margin:6px 0 0">Si la recherche gratuite est bloquée, la recherche renforcée essaie Codex puis, si nécessaire, ouvre temporairement TikTok dans votre Chrome. Elle ne conserve que les liens réellement affichés et fait vérifier leurs statistiques. Le pays cible oriente la recherche, mais TikTok peut encore la personnaliser selon votre compte et votre connexion. Le quota Codex est utilisé uniquement lorsque vous cliquez sur ce bouton.</p>' +
      '<div id="exVOut" style="margin-top:10px"></div></div>' +
      // ---------- 1. Lien ----------
      '<div class="card"><h3>1. Télécharger depuis un lien</h3>' +
      '<p class="hint">Collez un ou plusieurs liens (TikTok, YouTube, Instagram, X, Facebook…), un par ligne. Le pont local peut utiliser <b>yt-dlp</b> pour charger la première vidéo directement dans l’étape 2. ' +
      'Le kit ZIP reste disponible si un site refuse le téléchargement intégré.</p>' +
      '<textarea id="exLinks" rows="4" placeholder="https://www.tiktok.com/@compte/video/7412345678901234567&#10;https://www.youtube.com/shorts/…"></textarea>' +
      '<div class="row-inline" style="margin-top:8px"><label class="hint" style="margin:0">Qualité <select id="exQ"><option value="1080">1080p max</option><option value="720">720p max</option><option value="best">La meilleure</option></select></label>' +
      '<label class="hint" style="margin:0"><input type="checkbox" id="exSubs"> Sous-titres du site (.srt) si disponibles</label>' +
      '<label class="hint" style="margin:0"><input type="checkbox" id="exAudio"> Aussi l\'audio seul (.mp3)</label></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="exImport">Télécharger pour analyser</button>' +
      '<button class="small-btn" id="exTkBtn">Choisir une qualité TikTok</button>' +
      '<button class="small-btn" id="exKit">Kit yt-dlp (.zip) — secours</button><button class="small-btn" id="exDirect">Lien direct vers un fichier .mp4</button></div>' +
      '<p class="hint" style="margin-top:6px"><b>TikTok</b> : récupération directe par le service gratuit <b>TikWM</b> (non officiel : il peut être lent, limité à ~1 lien/s, ou indisponible). ' +
      'Pour YouTube et les autres sites pris en charge, le téléchargement intégré passe par votre pont local. Une vidéo privée, protégée ou nécessitant une connexion restera refusée.</p>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="exProxy"> Si TikWM est bloqué, réessayer via le relais public allOrigins (votre lien passe alors par ce relais)</label>' +
      '<div id="exTk" style="margin-top:8px"></div></div>' +
      // ---------- Source ----------
      '<div class="card"><h3>2. La vidéo à analyser</h3>' +
      '<div class="dropzone" id="exDrop" tabindex="0" role="button">Glissez une vidéo (ou un fichier audio) ici — ou cliquez pour choisir<input type="file" id="exFile" accept="video/*,audio/*" hidden></div>' +
      '<div class="row-inline" style="margin-top:8px"><select id="exFromApp" style="min-width:260px"><option value="">…ou un rendu vidéo de ce projet</option></select><span class="hint" id="exSrcInfo" style="margin:0"></span></div>' +
      '<div class="row-inline" id="exSessBar" style="margin-top:8px;display:none"><label class="inline">Vidéos analysées de ce projet <select id="exSess" style="width:auto;min-width:240px"></select></label>' +
      '<button class="small-btn" id="exSessDel" type="button">Retirer de la liste</button></div>' +
      '<div class="refs-block" id="exMetaBox" style="display:none;margin-top:10px"><div class="row-inline">' +
      '<b>Confidentialité des métadonnées</b><button class="small-btn" id="exMetaCheck" type="button">Vérifier avec FFprobe</button>' +
      '<button class="primary-btn" id="exMetaClean" type="button" style="display:none">Nettoyer avec FFmpeg</button>' +
      '<button class="small-btn" id="exMetaDownload" type="button" style="display:none">Télécharger la copie nettoyée</button></div>' +
      '<p class="hint" id="exMetaStatus" style="margin:7px 0 0"></p><div class="hint" id="exMetaDetails" style="margin-top:5px"></div></div>' +
      '<div id="exVideoAnalysisWrap" style="display:none;grid-template-columns:minmax(280px,375px) minmax(300px,1fr);gap:16px;align-items:start;margin-top:10px">' +
      '<video id="exPlayer" controls playsinline style="display:block;width:100%;max-height:70vh;border-radius:10px;background:#000"></video>' +
      '<div class="refs-block" id="exVideoAnalysisBox" style="min-height:180px;max-height:70vh;overflow:auto"><div class="row-inline">' +
      '<b>Analyse technique et visuelle</b><button class="primary-btn" id="exVideoAnalyze" type="button">✨ Analyser la vidéo</button></div>' +
      '<p class="hint" id="exVideoAnalysisStatus" style="margin:7px 0 0">L’analyse démarre uniquement lorsque vous appuyez sur le bouton.</p>' +
      '<div id="exVideoAnalysisResult" style="margin-top:8px"></div></div></div></div>' +
      // ---------- 3. Script ----------
      '<div class="card"><h3>3. Récupérer le script</h3><div class="ext-cols">' +
      '<div class="field"><label>Moteur</label><select id="exEngine"><option value="local">Whisper dans le navigateur (gratuit, privé)</option><option value="openai">API OpenAI (clé)</option><option value="subs">Fichier de sous-titres (.srt / .vtt)</option></select></div>' +
      '<div class="field ex-local"><label>Précision</label><select id="exWhisper"><option value="Xenova/whisper-base">Rapide et stable (recommandé, ~80 Mo)</option><option value="Xenova/whisper-small">Précis (~250 Mo, ordinateur puissant)</option></select></div>' +
      '<div class="field ex-local ex-openai"><label>Langue parlée</label><select id="exLang"><option value="french">Français</option><option value="english">Anglais</option><option value="spanish">Espagnol</option><option value="arabic">Arabe</option><option value="">Détection auto</option></select></div>' +
      '<div class="field ex-openai"><label>Clé OpenAI</label><input type="password" id="exKey" placeholder="reprise de l\'onglet Voix si vide"></div>' +
      '<div class="field ex-openai"><label>Modèle</label><select id="exOModel"><option value="whisper-1">whisper-1 (avec timecodes)</option><option value="gpt-4o-transcribe">gpt-4o-transcribe (texte seul, plus précis)</option><option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (texte seul)</option></select></div>' +
      '</div><p class="hint ex-local">Le modèle est téléchargé une seule fois puis gardé par le navigateur. Le mode local stable limite la mémoire utilisée afin d\'éviter le rechargement de la page.</p>' +
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
    $("exImport").addEventListener("click", function () { self.downloadForAnalysis(); });
    $("exTkBtn").addEventListener("click", function () { self.fetchTikToks(); });
    $("exProxy").checked = !!cfg.tkProxy;
    $("exProxy").addEventListener("change", function () { cfg.tkProxy = this.checked; cfg.save(); });
    $("exTk").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tk]"); if (!b) return;
      e.preventDefault();
      var it = self.tk[+b.getAttribute("data-i")]; if (!it) return;
      var act = b.getAttribute("data-tk");
      if (b.classList.contains("primary-btn")) act = "load";
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
    $("exMetaCheck").addEventListener("click", function () { self.checkMetadata(false); });
    $("exMetaClean").addEventListener("click", function () { self.cleanMetadata(); });
    $("exMetaDownload").addEventListener("click", function () { if (self.video) core.download(self.video, self.srcName || "video_nettoyee.mp4"); });
    $("exVideoAnalyze").addEventListener("click", function () { self.analyseVideo(); });

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
    $("exVCodex").addEventListener("click", function () { self.veilleCodexSearch(); });
    $("exVSuggest").addEventListener("click", function () { self.veilleSuggest(); });
    ["exVCat", "exVKeys", "exVCountry", "exVPeriod", "exVSort", "exVKeep", "exVMaxDur"].forEach(function (id) {
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
  openUrl: function (url) {
    var parsed;
    try { parsed = new URL(String(url || "").trim()); } catch (error) { parsed = null; }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      this.core.toast("Adresse vidéo invalide.", "err"); return false;
    }
    var links = this.$("exLinks"), list = links.value.split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean);
    if (list.indexOf(parsed.href) === -1) list.unshift(parsed.href);
    links.value = list.join("\n");
    this.st().links = links.value; this.saveSoon();
    window.AgnesApp.showView("view_extraire");
    links.scrollIntoView({ behavior: "smooth", block: "center" });
    this.core.toast("Lien ajouté dans Extraire. Cliquez sur « Télécharger pour analyser ».", "ok");
    return true;
  },
  importUrl: function (url) {
    if (!this.openUrl(url)) return Promise.resolve(false);
    return this.downloadForAnalysis(url);
  },
  downloadForAnalysis: function (givenUrl) {
    var self = this, core = this.core, links = this.links(), url = String(givenUrl || links[0] || "").trim();
    if (!url) { core.toast("Collez un lien vidéo.", "err"); return Promise.resolve(false); }
    var parsed;
    try { parsed = new URL(url); } catch (error) { parsed = null; }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) { core.toast("Adresse vidéo invalide.", "err"); return Promise.resolve(false); }
    var btn = this.$("exImport"), ancien = btn.textContent;
    btn.disabled = true; btn.textContent = "Téléchargement local…";
    core.toast("Le pont local récupère la vidéo avec yt-dlp…");
    var hauteur = this.cfg.dlQuality === "best" ? 1080 : Number(this.cfg.dlQuality) || 1080;
    return fetch(this.bridgeBase() + "/video/importer", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "video/*,application/json" },
      body: JSON.stringify({ url: parsed.href, hauteur: hauteur })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 404) throw new Error("le pont local n’est pas encore à jour pour le téléchargement intégré");
        throw new Error(d.error || ("HTTP " + r.status));
      });
      return r.blob().then(function (blob) {
        if (blob.size < 20000 || /text|html|json/i.test(blob.type || "")) throw new Error("le pont n’a pas renvoyé de fichier vidéo");
        return { blob: /^video\//i.test(blob.type || "") ? blob : new Blob([blob], { type: "video/mp4" }),
          name: decodeURIComponent(r.headers.get("X-File-Name") || "video.mp4") };
      });
    }).then(function (out) {
      self.setSource(out.blob, out.name, false, parsed.href);
      self.$("exPlayer").scrollIntoView({ behavior: "smooth", block: "center" });
      core.toast("Vidéo chargée dans l’étape 2. Vous pouvez maintenant la transcrire et l’analyser.", "ok");
      return true;
    }).catch(function (error) {
      var message = error instanceof TypeError ? "pont local injoignable : relancez-le" : (error.message || error);
      core.toast("Téléchargement impossible : " + message + ". Si la vidéo est publique, réessayez ; sinon utilisez le kit yt-dlp ou un fichier que vous possédez.", "err");
      return false;
    }).finally(function () { btn.disabled = false; btn.textContent = ancien; });
  },
  setSource: function (blob, name, restoring, sourceUrl) {
    var v = this.$("exPlayer");
    if (!restoring) this.newSession(blob, name, sourceUrl);
    var ss = this.session();
    this.sourceUrl = String(sourceUrl || (ss && ss.sourceUrl) || "");
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
    this.video = blob; this.srcName = name; this.videoUrl = URL.createObjectURL(blob);
    var audio = /^audio\//.test(blob.type);
    v.src = this.videoUrl; v.style.display = audio ? "none" : "block";
    this.$("exVideoAnalysisWrap").style.display = audio ? "none" : "grid";
    this.resetVideoAnalysis();
    var self = this;
    v.onloadedmetadata = function () {
      var d = isFinite(v.duration) ? v.duration : 0;
      self.$("exSrcInfo").textContent = name + (d ? " · " + self.fmtTime(d) : "") + (v.videoWidth ? " · " + v.videoWidth + "×" + v.videoHeight : "");
    };
    this.$("exSrcInfo").textContent = name;
    this.resetMetadata();
    this.checkMetadata(true);
  },
  bridgeBase: function () {
    var moteurs = window.AgnesPlugins && AgnesPlugins.get("moteurs");
    return String((moteurs && moteurs.cfg && moteurs.cfg.pont) || "http://127.0.0.1:8177").replace(/\/+$/, "");
  },
  resetMetadata: function () {
    this.metaSeq += 1; this.metaInfo = null;
    if (!this.$ || !this.$("exMetaBox")) return;
    this.$("exMetaBox").style.display = this.video ? "" : "none";
    this.$("exMetaStatus").textContent = this.video ? "Vérification locale en attente…" : "";
    this.$("exMetaDetails").innerHTML = "";
    this.$("exMetaCheck").disabled = !this.video;
    this.$("exMetaClean").style.display = "none";
    this.$("exMetaDownload").style.display = this.video && /_nettoyee\.[^.]+$/i.test(this.srcName || "") ? "" : "none";
  },
  renderMetadata: function (data) {
    var esc = window.AgnesApp.esc, items = (data && data.metadonnees) || [], sensibles = items.filter(function (x) { return x.confidentielle; });
    this.metaInfo = data;
    this.$("exMetaBox").style.display = "";
    this.$("exMetaCheck").disabled = false;
    this.$("exMetaClean").style.display = sensibles.length ? "" : "none";
    this.$("exMetaStatus").textContent = sensibles.length
      ? sensibles.length + " information(s) potentiellement confidentielle(s) détectée(s). Créez une copie nettoyée avant de continuer."
      : "Aucune information confidentielle détectée. Les données purement techniques peuvent rester présentes.";
    if (!items.length) this.$("exMetaDetails").innerHTML = "";
    else this.$("exMetaDetails").innerHTML = '<details' + (sensibles.length ? " open" : "") + '><summary>Voir les métadonnées repérées</summary><ul style="margin:6px 0 0 18px">' +
      items.map(function (x) { return '<li><b>' + esc(x.categorie) + '</b> — ' + esc(x.cle) + ' : ' + esc(x.valeur) + (x.confidentielle ? "" : " (technique)") + '</li>'; }).join("") + "</ul></details>";
  },
  metadataError: function (e, silent) {
    var msg = (e && e.message) || String(e || "erreur inconnue");
    this.$("exMetaCheck").disabled = false; this.$("exMetaClean").style.display = "none";
    this.$("exMetaStatus").textContent = "Vérification indisponible : " + msg;
    if (!silent) this.core.toast("Métadonnées : " + msg, "err");
  },
  checkMetadata: function (silent) {
    var self = this, blob = this.video; if (!blob) { if (!silent) this.core.toast("Choisissez d'abord une vidéo.", "err"); return Promise.resolve(); }
    var seq = ++this.metaSeq, btn = this.$("exMetaCheck"); btn.disabled = true;
    this.$("exMetaStatus").textContent = "Vérification locale avec FFprobe…"; this.$("exMetaDetails").innerHTML = ""; this.$("exMetaClean").style.display = "none";
    return fetch(this.bridgeBase() + "/media/metadata", { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream", "X-File-Name": encodeURIComponent(this.srcName || "video.mp4") }, body: blob })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) { if (seq !== self.metaSeq) return null; self.renderMetadata(d); return d; })
      .catch(function (e) { if (seq === self.metaSeq) self.metadataError(e, silent); return null; });
  },
  cleanMetadata: function () {
    var self = this, blob = this.video, sourceUrl = this.sourceUrl; if (!blob) return this.core.toast("Choisissez d'abord une vidéo.", "err");
    var btn = this.$("exMetaClean"), old = btn.textContent; btn.disabled = true; this.$("exMetaCheck").disabled = true; btn.textContent = "Nettoyage…";
    this.$("exMetaStatus").textContent = "FFmpeg crée une copie nettoyée sans modifier l'original…";
    fetch(this.bridgeBase() + "/media/nettoyer", { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream", "X-File-Name": encodeURIComponent(this.srcName || "video.mp4") }, body: blob })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || ("HTTP " + r.status)); });
        return r.blob().then(function (b) { return { blob: b, name: decodeURIComponent(r.headers.get("X-File-Name") || "video_nettoyee.mp4") }; });
      }).then(function (out) {
        self.setSource(out.blob, out.name, false, sourceUrl);
        self.core.toast("Copie nettoyée chargée dans l'analyse. La vidéo originale est conservée.", "ok");
      }).catch(function (e) { self.metadataError(e, false); })
      .finally(function () { btn.disabled = false; btn.textContent = old; if (self.video) self.$("exMetaCheck").disabled = false; });
  },
  resetVideoAnalysis: function () {
    this.analysisSeq = (this.analysisSeq || 0) + 1; this.videoAnalysis = null;
    if (!this.$ || !this.$("exVideoAnalysisResult")) return;
    this.$("exVideoAnalysisResult").innerHTML = "";
    this.$("exVideoAnalysisStatus").textContent = this.video ? "L’analyse démarre uniquement lorsque vous appuyez sur le bouton." : "";
    this.$("exVideoAnalyze").disabled = !this.video;
  },
  videoAnalysisSamples: function () {
    var self = this;
    return this.worker().then(function (v) {
      var duree = Number(v.duration) || 0, ratios = [0.03, 0.18, 0.37, 0.56, 0.76, 0.95], vus = {}, temps = [];
      ratios.forEach(function (r) { var t = Math.max(0, Math.min(duree - 0.05, duree * r)); var cle = t.toFixed(2); if (!vus[cle]) { vus[cle] = true; temps.push(t); } });
      var images = [], mesures = [], chaine = Promise.resolve();
      temps.forEach(function (t) {
        chaine = chaine.then(function () { return self.seekVideo(v, t); }).then(function () {
          var max = 384, k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement("canvas");
          c.width = Math.max(2, Math.round(v.videoWidth * k)); c.height = Math.max(2, Math.round(v.videoHeight * k));
          var ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(v, 0, 0, c.width, c.height);
          var px = ctx.getImageData(0, 0, c.width, c.height).data, gris = new Float32Array(c.width * c.height), somme = 0, somme2 = 0, sat = 0;
          for (var i = 0, p = 0; i < px.length; i += 4, p++) {
            var r = px[i], g = px[i + 1], b = px[i + 2], y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            gris[p] = y; somme += y; somme2 += y * y; sat += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
          }
          var n = gris.length, lap2 = 0, lapN = 0;
          for (var y0 = 1; y0 < c.height - 1; y0++) for (var x0 = 1; x0 < c.width - 1; x0++) {
            var q = y0 * c.width + x0, lap = 4 * gris[q] - gris[q - 1] - gris[q + 1] - gris[q - c.width] - gris[q + c.width]; lap2 += lap * lap; lapN++;
          }
          mesures.push({ lumiere: somme / n, contraste: Math.sqrt(Math.max(0, somme2 / n - Math.pow(somme / n, 2))), saturation: sat / n * 100, nettete: Math.sqrt(lap2 / Math.max(1, lapN)) });
          images.push({ t: t, data: c.toDataURL("image/jpeg", 0.78) });
        });
      });
      return chaine.then(function () {
        function moyenne(cle) { return mesures.reduce(function (s, x) { return s + x[cle]; }, 0) / Math.max(1, mesures.length); }
        return { largeur: v.videoWidth, hauteur: v.videoHeight, duree: duree, images: images,
          mesures: { lumiere: moyenne("lumiere"), contraste: moyenne("contraste"), saturation: moyenne("saturation"), nettete: moyenne("nettete") } };
      });
    });
  },
  renderVideoTechnical: function (meta, echantillon) {
    var esc = window.AgnesApp.esc, v = (meta && meta.video) || {}, a = (meta && meta.audio) || {};
    var largeur = Number(v.largeur) || echantillon.largeur || 0, hauteur = Number(v.hauteur) || echantillon.hauteur || 0, petit = Math.min(largeur, hauteur), grand = Math.max(largeur, hauteur);
    var definition = petit >= 2160 ? "très élevée (4K ou plus)" : petit >= 1080 ? "élevée (Full HD)" : petit >= 720 ? "bonne (HD)" : petit >= 540 ? "moyenne" : "faible";
    var m = echantillon.mesures || {}, nettete = m.nettete >= 24 ? "détails marqués" : m.nettete >= 12 ? "netteté moyenne" : "image plutôt douce";
    var lumiere = m.lumiere < 70 ? "sombre" : m.lumiere > 190 ? "très claire" : "équilibrée";
    var contraste = m.contraste < 30 ? "faible" : m.contraste > 65 ? "fort" : "moyen";
    var fps = Number(v.fps) || 0, images = Number(v.images) || 0, debit = Number(meta && meta.debit) || 0, taille = Number(meta && meta.taille_octets) || (this.video && this.video.size) || 0;
    var lignes = [
      ["Définition", largeur && hauteur ? largeur + " × " + hauteur + " — " + definition : "information non disponible"],
      ["Format", largeur && hauteur ? (hauteur > largeur ? "vertical" : largeur > hauteur ? "horizontal" : "carré") + " · " + (grand / Math.max(1, petit)).toFixed(2) + ":1" : "information non disponible"],
      ["Images par seconde", fps ? fps.toLocaleString("fr-FR") + " FPS" : "information non disponible"],
      ["Nombre d’images", images ? (v.images_estimees ? "environ " : "") + images.toLocaleString("fr-FR") : "information non disponible"],
      ["Encodage", [v.codec, v.profil, v.pixel].filter(Boolean).join(" · ") || "information non disponible"],
      ["Débit vidéo", debit ? Math.round(debit / 1000).toLocaleString("fr-FR") + " kbit/s" : "information non disponible"],
      ["Taille du fichier", taille ? (taille / 1048576).toFixed(1).replace(".", ",") + " Mo" : "information non disponible"],
      ["Mesure sur " + echantillon.images.length + " images", nettete + " · luminosité " + lumiere + " · contraste " + contraste + " · saturation moyenne " + Math.round(m.saturation || 0) + " %"],
      ["Audio", a.codec ? a.codec + (a.frequence ? " · " + Math.round(a.frequence / 1000) + " kHz" : "") + (a.canaux ? " · " + a.canaux + " canal(aux)" : "") : "information non disponible"]
    ];
    return '<div><b>Mesures locales</b><dl style="display:grid;grid-template-columns:max-content 1fr;gap:5px 12px;margin:8px 0 0">' + lignes.map(function (x) { return '<dt class="hint" style="margin:0">' + esc(x[0]) + '</dt><dd style="margin:0">' + esc(x[1]) + '</dd>'; }).join("") + '</dl>' +
      '<p class="hint" style="margin:8px 0 0">La netteté, la lumière, le contraste et la saturation sont des estimations calculées sur les images échantillonnées, pas une certification de qualité.</p></div>';
  },
  analyseVideo: function () {
    var self = this, core = this.core, blob = this.video, btn = this.$("exVideoAnalyze"), statut = this.$("exVideoAnalysisStatus"), resultat = this.$("exVideoAnalysisResult");
    if (!blob || /^audio\//.test(blob.type)) { core.toast("Choisissez d’abord une vidéo.", "err"); return Promise.resolve(null); }
    var seq = ++this.analysisSeq, ancien = btn.textContent; btn.disabled = true; btn.textContent = "Analyse…"; resultat.innerHTML = ""; statut.textContent = "Mesure de la vidéo et prélèvement de 6 images représentatives…";
    var meta = this.metaInfo ? Promise.resolve(this.metaInfo) : this.checkMetadata(false).then(function () { return self.metaInfo; });
    return Promise.all([meta, this.videoAnalysisSamples()]).then(function (donnees) {
      if (seq !== self.analysisSeq) throw new Error("analyse remplacée par une autre vidéo");
      var technique = donnees[0], echantillon = donnees[1], html = self.renderVideoTechnical(technique, echantillon); resultat.innerHTML = html;
      var at; try { at = self.atelier(); } catch (e) {
        self.videoAnalysis = { technique: technique, visuel: "", at: Date.now() };
        statut.textContent = "Mesures terminées. Analyse du style indisponible : " + e.message; return self.videoAnalysis;
      }
      statut.textContent = "Analyse du style visuel par l’IA sur 6 images…";
      var v = (technique && technique.video) || {}, resume = "Vidéo : " + (v.largeur || echantillon.largeur) + "×" + (v.hauteur || echantillon.hauteur) + ", " + (v.fps || "FPS inconnu") + " FPS, durée " + self.fmtTime(echantillon.duree) + ".";
      var contenu = [{ type: "text", text: resume + "\nLes images suivantes sont des prélèvements à " + echantillon.images.map(function (x) { return self.fmtTime(x.t); }).join(", ") + ". Analyse uniquement ce qui est visible. Sépare OBSERVATIONS et INTERPRÉTATION. Décris : médium probable (prise de vue, 2D, 3D, IA…), style, palette, lumière, composition/cadrages, niveau de détail, cohérence visuelle et défauts visibles. Termine par 4 conseils concrets pour reproduire cette qualité. N’invente ni histoire, ni mouvement entre les images, ni information absente." }];
      echantillon.images.forEach(function (x) { contenu.push({ type: "image_url", image_url: { url: x.data } }); });
      return at.chat([{ role: "system", content: "Tu es directeur de la photographie et analyste d’images. Tu distingues les faits visuels des interprétations et tu signales les limites d’un échantillon de photogrammes." }, { role: "user", content: contenu }], { temperature: 0.2, max_tokens: 1600, _single: true })
        .then(function (m) {
          if (seq !== self.analysisSeq) return;
          var texte = String(m.content || "").trim(); self.videoAnalysis = { technique: technique, visuel: texte, at: Date.now() };
           resultat.innerHTML = html + '<div class="refs-block" style="margin-top:10px"><b>Analyse visuelle par IA</b><p style="white-space:pre-wrap;margin:8px 0 0">' + window.AgnesApp.esc(texte || "information non disponible") + '</p></div>';
           statut.textContent = "Analyse terminée" + (m._provider ? " par " + m._provider : "") + ".";
           return self.videoAnalysis;
         }).catch(function (e) {
           if (seq !== self.analysisSeq) return;
           var message = e.display || e.message || String(e); self.videoAnalysis = { technique: technique, visuel: "", at: Date.now() };
           resultat.innerHTML = html + '<div class="refs-block" style="margin-top:10px"><b>Analyse visuelle indisponible</b><p class="hint" style="margin:6px 0 0">' + window.AgnesApp.esc(message) + '</p></div>';
           statut.textContent = "Mesures techniques terminées ; le modèle IA sélectionné n’a pas pu analyser les images.";
           return self.videoAnalysis;
         });
    }).catch(function (e) { if (seq === self.analysisSeq) { statut.textContent = "Analyse impossible : " + (e.message || e); core.toast("Analyse vidéo : " + (e.message || e), "err"); } return null; })
      .finally(function () { if (seq === self.analysisSeq) { btn.disabled = false; btn.textContent = ancien; } });
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
      self.setSource(b, name, false, url); core.toast("Vidéo récupérée : " + (b.size / 1048576).toFixed(1) + " Mo.", "ok");
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
      var btn = function (act, q, label, cls) { return '<button type="button" class="' + (cls || "small-btn") + '" data-tk="' + act + '" data-q="' + q + '" data-i="' + i + '">' + label + '</button>'; };
      return '<div class="ext-row">' + (d.cover ? '<img src="' + esc(self.abs(d.cover)) + '" alt="" style="width:54px;height:96px;object-fit:cover;border-radius:6px" referrerpolicy="no-referrer">' : '') +
        '<div class="grow"><b>' + esc((d.title || "Vidéo TikTok").slice(0, 120)) + '</b><br><span class="hint" style="margin:0">@' + esc(a.unique_id || a.nickname || "—") + (dur ? " · " + dur : "") +
        (d.play_count ? " · " + Number(d.play_count).toLocaleString("fr-FR") + " vues" : "") + '</span>' +
        '<div class="row-inline" style="margin-top:6px">' + btn("load", d.hdplay ? "hd" : "sd", "Analyser ici (script, images)", "primary-btn") +
        btn("save", d.hdplay ? "hd" : "sd", "⬇ Télécharger" + (d.hdplay ? " (HD)" : "")) + (d.hdplay ? btn("save", "sd", "⬇ Qualité standard") : "") +
        (d.wmplay ? btn("save", "wm", "⬇ Avec filigrane") : "") + btn("cover", "", "Couverture → Bibliothèque") + '</div></div></div>';
    }).join("");
  },
  // Récupère le fichier : direct, puis pont local (qui n'est pas soumis au CORS du navigateur),
  // puis relais allOrigins si l'option est cochée. Aucun échec n'ouvre un onglet tout seul.
  tkMedia: function (it, q, act, btn) {
    var self = this, core = this.core, url = this.tkUrl(it, q);
    if (!url) return core.toast("Lien vidéo absent pour cette qualité.", "err");
    var choices = [{ url: url, q: q, proxy: false }];
    if (q === "hd") {
      var sd = this.tkUrl(it, "sd");
      if (sd && sd !== url) choices.push({ url: sd, q: "sd", proxy: false });
    }
    var direct = choices.slice(), moteurs = window.AgnesPlugins && AgnesPlugins.get("moteurs");
    var pont = String((moteurs && moteurs.cfg && moteurs.cfg.pont) || "http://127.0.0.1:8177").replace(/\/+$/, "");
    direct.forEach(function (c) {
      choices.push({ url: pont + "/media/proxy?url=" + encodeURIComponent(c.url), q: c.q, local: true });
    });
    if (this.cfg.tkProxy) direct.forEach(function (c) {
      choices.push({ url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(c.url), q: c.q, proxy: true });
    });
    var label = btn.textContent; btn.disabled = true; btn.textContent = "…";
    function tryChoice(i, lastError) {
      if (i >= choices.length) return Promise.reject(lastError || new Error("aucun flux vidéo accessible"));
      var choice = choices[i];
      return fetch(choice.url, { referrerPolicy: "no-referrer" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      }).then(function (b) {
        if (b.size < 20000) throw new Error("fichier vide");
        if (/text|html|json/i.test(b.type || "")) throw new Error("le serveur n'a pas renvoyé une vidéo");
        return { blob: /^video\//i.test(b.type || "") ? b : new Blob([b], { type: "video/mp4" }), choice: choice };
      }).catch(function (e) { return tryChoice(i + 1, e); });
    }
    tryChoice(0).then(function (result) {
      var blob = result.blob, choice = result.choice, name = self.tkName(it, choice.q);
      var infos = [];
      if (choice.q !== q) infos.push("qualité standard");
      if (choice.local) infos.push("via le pont local");
      else if (choice.proxy) infos.push("via le relais public");
      var detail = infos.length ? " (" + infos.join(", ") + ")" : "";
      if (act === "load") { self.setSource(blob, name, false, it.url); self.$("exPlayer").scrollIntoView({ behavior: "smooth", block: "center" }); core.toast("Vidéo chargée" + detail + " : passez au script ou aux images.", "ok"); }
      else { core.download(blob, name); core.toast("Téléchargement" + detail + " : " + name, "ok"); }
    }).catch(function (e) {
      var reason = e instanceof TypeError ? "blocage du serveur" : e.message;
      if (act === "load") {
        core.toast("Impossible de charger la vidéo dans l'analyse (" + reason + "). " + (self.cfg.tkProxy ? "Téléchargez-la puis glissez-la dans l'étape 2." : "Cochez le relais public puis réessayez, ou téléchargez-la et glissez-la dans l'étape 2."), "err");
        return;
      }
      core.toast("Téléchargement impossible (" + reason + "). Cochez le relais public puis réessayez.", "err");
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
  audio16k: function () { return this.audio16kBlob(this.video); },
  audio16kBlob: function (blob) {
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
    var core = this.core, st = this.$("exTStatus"), btn = this.$("exTranscribe");
    if (!this.video) return core.toast("Choisissez d'abord une vidéo (étape 2).", "err");
    btn.disabled = true;
    this.runTranscription().then(function (r) {
      st.textContent = r.segments.length ? "Terminé — " + r.segments.length + " passage(s)." : "Aucune parole détectée.";
    }).catch(function (e) { st.textContent = ""; core.toast("Transcription : " + (e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  },
  // Transcription de la source courante (moteur réglé : Whisper local, OpenAI) → segments affichés et enregistrés
  runTranscription: function () {
    var self = this, cfg = this.cfg, st = this.$("exTStatus");
    st.textContent = "Lecture du son…";
    return this.audio16k().then(function (pcm) {
      if (pcm.length < 16000 * 0.5) throw new Error("piste audio vide");
      return cfg.engine === "openai" ? self.openaiTranscribe(pcm, st) : self.localTranscribe(pcm, st);
    }).then(function (segs) {
      self.segments = segs.filter(function (s) { return s.text && s.text.trim(); });
      self.showScript(); self.saveSegments();
      // texte brut (quel que soit le format affiché : texte, timecodes ou .srt), paragraphes aux pauses de plus de 1,2 s
      var text = self.segments.map(function (s, i) {
        var gap = i ? s.start - self.segments[i - 1].end : 0; return (gap > 1.2 ? "\n\n" : " ") + s.text.trim();
      }).join("").trim();
      return { segments: self.segments.slice(), text: text };
    });
  },
  // 01/10 — API pour les autres extensions (ex. le Chef de l'Atelier IA, ressources locales de l'agent Marketing) :
  // transcrit une vidéo donnée et renvoie { text, segments }. Elle apparaît aussi dans l'onglet Extraire (session
  // normale, script modifiable). Extraire ne dépend d'aucune autre extension : c'est l'appelant qui vérifie qu'elle est active.
  transcribeBlob: function (blob, name) {
    if (!blob || !blob.size) return Promise.reject(new Error("vidéo vide"));
    if (this.cfg.engine === "subs") return Promise.reject(new Error("moteur « sous-titres » choisi dans Extraire : choisissez Whisper ou OpenAI"));
    this.resetView(); this.setSource(blob, name || "vidéo");
    return this.runTranscription();
  },
  // Prépare une référence pour Veille : transcription puis analyse technique/visuelle, uniquement après clic utilisateur.
  prepareReference: function (onStatus) {
    var self = this, status = typeof onStatus === "function" ? onStatus : function () {};
    if (!this.video) return Promise.reject(new Error("aucune vidéo n’est chargée dans Extraire"));
    if (this.cfg.engine === "subs" && !this.scriptText()) {
      return Promise.reject(new Error("le moteur « sous-titres » est sélectionné : importez le fichier .srt/.vtt ou choisissez Whisper/OpenAI"));
    }
    var transcription = this.scriptText() ? Promise.resolve({ text: this.scriptText() }) : (status("Transcription…"), this.runTranscription());
    return transcription.then(function (result) {
      var source = String((result && result.text) || self.scriptText() || "").trim();
      if (!source) throw new Error("aucune parole n’a été détectée dans la vidéo");
      if (self.videoAnalysis) return { source: source, analysis: self.videoAnalysis };
      status("Analyse des images…");
      return self.analyseVideo().then(function (analysis) { return { source: source, analysis: analysis }; });
    }).then(function (result) {
      status("Référence prête");
      return { source: result.source, visual: String(result.analysis && result.analysis.visuel || "").trim(),
        name: self.srcName || "vidéo", url: self.sourceUrl || "" };
    });
  },
  // 01/10 — mots minutés pour le karaoké de l'extension Montage : [{ text, start, end }] (secondes de la vidéo donnée).
  // N'utilise ni ne modifie l'onglet Extraire. Whisper local seulement (l'API OpenAI ne rend pas les mots ici).
  // Si le modèle réglé ne sait pas minuter les mots, on essaie un modèle « _timestamped » (téléchargé une seule fois).
  WORD_MODELS: ["onnx-community/whisper-base_timestamped", "onnx-community/whisper-small_timestamped"],
  motsBlob: function (blob, onEtat) {
    var self = this, cfg = this.cfg, st = { set textContent(t) { if (onEtat) onEtat(t); } };
    if (!blob || !blob.size) return Promise.reject(new Error("vidéo vide"));
    var modeles = [cfg.whisper].concat(this.WORD_MODELS.filter(function (m) { return m !== cfg.whisper; }));
    return this.audio16kBlob(blob).then(function (pcm) {
      if (pcm.length < 16000 * 0.3) throw new Error("piste audio vide");
      var essai = function (i, derniere) {
        if (i >= modeles.length) throw new Error("aucun modèle Whisper ne sait minuter les mots ici (" + (derniere && derniere.message || derniere) + ")");
        return self.loadWhisper(modeles[i], st).then(function (asr) {
          st.textContent = "Whisper écoute la réplique…";
          var opts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: "word", task: "transcribe" };
          if (cfg.lang) opts.language = cfg.lang;
          return asr(pcm, opts);
        }).then(function (out) {
          var dur = pcm.length / 16000;
          return (out.chunks || []).map(function (c) {
            return { text: String(c.text || "").trim(), start: c.timestamp[0] || 0, end: c.timestamp[1] == null ? dur : c.timestamp[1] };
          }).filter(function (m) { return m.text; });
        }).catch(function (e) {
          if (/alignment_heads|cross_attentions|token-level/i.test(String(e && e.message))) return essai(i + 1, e);
          throw e;
        });
      };
      return essai(0, null);
    });
  },
  // Moteur Whisper : copie locale (vendor/transformers, identique à jsDelivr) dès qu'Agnes est servie (extension Lumina,
  // localhost, Live Server) ; en fichier (file://) Chrome refuse d'importer un module local : on garde le CDN.
  WHISPER_DIR: "vendor/transformers/",
  whisperSources: function () {
    var ext = location.protocol === "chrome-extension:";
    if (ext || /^https?:$/.test(location.protocol)) {
      var dir = new URL(this.WHISPER_DIR, document.baseURI).href;
      var local = { lib: dir + "transformers.min.js", wasm: dir, proxy: !ext };
      // dans l'extension, pas de repli sur internet (code distant interdit) ; ailleurs, repli sur le CDN
      return ext ? [local] : [local, { lib: this.TFJS, wasm: null, proxy: true }];
    }
    return [{ lib: this.TFJS, wasm: null, proxy: true }];
  },
  importWhisper: function () {
    if (this.transformersPromise) return this.transformersPromise;
    var self = this, tries = this.whisperSources(), last = null;
    var loading = tries.reduce(function (chain, src) {
      return chain.catch(function (e) {
        if (e) last = e;
        return import(src.lib).then(function (T) {
          if (src.wasm) { try { T.env.backends.onnx.wasm.wasmPaths = src.wasm; } catch (e2) { } }
          try { T.env.backends.onnx.wasm.proxy = src.proxy; } catch (e3) { }
          return T;
        });
      });
    }, Promise.reject(null)).catch(function (e) { throw e || last; });
    this.transformersPromise = loading.catch(function (e) {
      self.transformersPromise = null;
      throw e;
    });
    return this.transformersPromise;
  },
  loadWhisper: function (model, st) {
    var self = this;
    if (this.asr && this.asrModel === model) return Promise.resolve(this.asr);
    if (this.asrLoading) {
      if (this.asrLoadingModel === model) {
        st.textContent = "Chargement du modèle déjà en cours…";
        return this.asrLoading;
      }
      return this.asrLoading.then(function () { return self.loadWhisper(model, st); });
    }
    st.textContent = "Chargement du moteur…";
    var loading = this.importWhisper().then(function (T) {
      T.env.allowLocalModels = false;
      T.env.allowRemoteModels = true;
      T.env.useBrowserCache = true;
      // Le mode WebGPU charge Whisper en pleine précision et peut dépasser la mémoire de l'onglet.
      // WASM q8 est moins gourmand et évite les rechargements/crashs observés dans Chrome.
      try { T.env.backends.onnx.wasm.proxy = false; T.env.backends.onnx.wasm.numThreads = 1; } catch (e0) { }
      var files = {};
      var progress = function (p) {
        if (p.status === "progress" && p.file) { files[p.file] = p; }
        var list = Object.keys(files).map(function (k) { return files[k]; }), tot = list.reduce(function (a, f) { return a + (f.total || 0); }, 0), got = list.reduce(function (a, f) { return a + (f.loaded || 0); }, 0);
        if (tot) st.textContent = "Téléchargement du modèle (une seule fois)… " + Math.round(got / tot * 100) + " %";
      };
      return T.pipeline("automatic-speech-recognition", model, { device: "wasm", dtype: "q8", progress_callback: progress });
    }).then(function (asr) { self.asr = asr; self.asrModel = model; return asr; });
    this.asrLoading = loading; this.asrLoadingModel = model;
    return loading
      .catch(function (e) {
        var detail = String((e && e.message) || e || "erreur inconnue");
        if (/Aborted|out of memory|memory access|device.*lost/i.test(detail)) detail = "le moteur local a été interrompu par Chrome (mémoire insuffisante)";
        throw new Error("moteur Whisper indisponible (" + detail + "). Le modèle se télécharge une seule fois depuis " +
          "Hugging Face : vérifiez la connexion internet, ou utilisez l'API OpenAI / un fichier de sous-titres.");
      }).finally(function () {
        if (self.asrLoading === loading) { self.asrLoading = null; self.asrLoadingModel = ""; }
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
  // session = { id, name, sourceUrl, srcKey, segments[], scriptEdit, scriptFmt, frames[{ t, key, on }], convInstr, convOut, at }
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
  newSession: function (blob, name, sourceUrl) {
    var st = this.st(), id = window.AgnesApp.uid(), ss = { id: id, name: name || "vidéo", sourceUrl: String(sourceUrl || ""), srcKey: "extract:v:" + id, segments: [], scriptEdit: null, frames: [], convInstr: "", convOut: "", at: Date.now() };
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
      if (blob) self.setSource(blob, ss.name, true, ss.sourceUrl);
      else { self.video = null; self.srcName = ss.name; self.$("exPlayer").style.display = "none"; self.$("exVideoAnalysisWrap").style.display = "none"; self.resetVideoAnalysis(); self.$("exSrcInfo").textContent = ss.name + " (fichier vidéo indisponible : glissez-le à nouveau pour extraire des images)"; }
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
    this.video = null; this.srcName = ""; this.sourceUrl = ""; this.segments = []; this.showScript(); this.clearFramesUI();
    var v = this.$("exPlayer"); v.removeAttribute("src"); v.style.display = "none"; this.$("exVideoAnalysisWrap").style.display = "none"; this.$("exSrcInfo").textContent = "";
    this.resetVideoAnalysis();
    this.resetMetadata();
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
    v.cat = $("exVCat").value; v.keys = $("exVKeys").value; v.country = $("exVCountry").value.trim(); v.period = +$("exVPeriod").value; v.sort = $("exVSort").value;
    v.keep = +$("exVKeep").value; v.maxDur = +$("exVMaxDur").value || 0; this.saveSoon();
  },
  veilleFillForm: function () {
    var v = this.st().veille, $ = this.$.bind(this);
    $("exVCat").value = v.cat || ""; $("exVKeys").value = v.keys || ""; $("exVCountry").value = v.country || ""; $("exVPeriod").value = String(v.period != null ? v.period : 30);
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
    at.chat([{ role: "system", content: "Tu es expert des tendances TikTok. Réponds uniquement par une liste de 6 recherches TikTok, une par ligne, sans numéro ni commentaire : mots-clés courts et hashtags sans #, dans la langue utile au pays cible et avec 2 variantes internationales." },
      { role: "user", content: "Catégorie : " + v.cat + "\nPays cible : " + (v.country || "monde / sans filtre") }], { temperature: 0.5, max_tokens: 200 })
      .then(function (m) {
        var keys = String(m.content || "").split(/\n+/).map(function (l) { return l.replace(/^[\s\-*•\d.)#]+/, "").trim(); }).filter(function (l) { return l && l.length < 60; }).slice(0, 8);
        if (!keys.length) throw new Error("réponse vide");
        self.$("exVKeys").value = keys.join("\n"); self.veilleSaveForm();
        core.toast(keys.length + " mots-clés proposés : modifiez-les si besoin, puis « Chercher ».", "ok");
      }).catch(function (e) { core.toast("Mots-clés : " + (e.display || e.message || e), "err"); })
      .finally(function () { btn.disabled = false; btn.textContent = "✨ Proposer des mots-clés (IA)"; });
  },
  // Recherche : pont local en priorité (TikWM, puis recherche web de secours), accès direct en repli.
  tikwmSearch: function (kw, cursor) {
    var self = this, params = { keywords: kw, count: "8", cursor: String(cursor || 0), hd: "1", web: "1", region: "FR" };
    var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&"), url = this.TIKWM + "/api/feed/search?" + qs;
    function parse(j) {
      if (j && typeof j.contents === "string") { try { j = JSON.parse(j.contents); } catch (e) { } }
      if (!j || (j.code != null && Number(j.code) !== 0)) throw new Error((j && (j.error || j.msg)) || "réponse TikWM invalide");
      var d = j.data || {}; return { videos: d.videos || d.aweme_list || (Array.isArray(d) ? d : []), cursor: d.cursor, more: !!(d.hasMore || d.has_more), source: j.source || "TikWM", warning: j.warning || "" };
    }
    function json(r, pontLocal) {
      return r.text().then(function (texte) {
        var j;
        try { j = JSON.parse(texte); }
        catch (e) {
          var invalide = new Error(/<!doctype|<html/i.test(texte) ? "le service a renvoyé une page de protection HTML" : "réponse non JSON");
          invalide.pontLocal = !!pontLocal; throw invalide;
        }
        if (!r.ok) {
          var err = new Error(j.error || j.msg || ("HTTP " + r.status));
          err.pontLocal = !!pontLocal && r.status !== 404; throw err;
        }
        return j;
      });
    }
    function limite(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("délai dépassé")); }, ms); })]); }
    var pont = this.bridgeBase() + "/tiktok/search?" + qs;
    return limite(fetch(pont, { headers: { Accept: "application/json" } }).then(function (r) { return json(r, true); }).then(parse), 60000)
      .catch(function (pontErreur) {
        // Le pont a déjà essayé TikWM et les moteurs gratuits : conserver son message clair au lieu de relire
        // la page HTML de Cloudflare. Le direct ne sert que si le pont lui-même est injoignable ou trop ancien.
        if (pontErreur && pontErreur.pontLocal) throw pontErreur;
        var tries = [
          function () { return limite(fetch(url, { headers: { Accept: "application/json, text/plain, */*" } }).then(function (r) { return json(r, false); }).then(parse), 18000); },
          function () { return limite(fetch(self.TIKWM + "/api/feed/search", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, text/plain, */*" }, body: new URLSearchParams(params) }).then(function (r) { return json(r, false); }).then(parse), 18000); }
        ];
        if (self.cfg.tkProxy) tries.push(function () { return limite(fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(url)).then(function (r) { return json(r, false); }).then(parse), 25000); });
        var chain = Promise.reject(), last = pontErreur;
        tries.forEach(function (t) { chain = chain.catch(function (e) { if (e) last = e; return t(); }); });
        return chain.catch(function (e) { throw e && e.message ? e : last || new Error("échec"); });
      });
  },
  veilleIngest: function (found, kw, r) {
    var self = this;
    (r.videos || []).forEach(function (x) {
      var id = String(x.video_id || x.aweme_id || x.id || ""); if (!id) return;
      var a = x.author || {}, stats = x.statistics || x.stats || {}, astats = a.statistics || a.stats || {};
      var metric = function () { for (var z = 0; z < arguments.length; z++) if (arguments[z] !== undefined && arguments[z] !== null && arguments[z] !== "") { var n = Number(arguments[z]); if (isFinite(n)) return n; } return null; };
      var user = a.unique_id || a.uniqueId || x.author_name || x.authorName || "";
      var direct = x.web_video_url || x.share_url || x.url || ("https://www.tiktok.com/@" + (user || "_") + "/video/" + id);
      var item = found[id] || { id: id, url: direct, title: x.title || x.desc || "", user: user, nickname: a.nickname || "", cover: self.abs(x.cover || x.origin_cover || ""),
        dur: metric(x.duration), play: metric(x.play_count, stats.play_count, x.view_count, stats.view_count), like: metric(x.digg_count, stats.digg_count, x.like_count, stats.like_count),
        comment: metric(x.comment_count, stats.comment_count), share: metric(x.share_count, stats.share_count), collect: metric(x.collect_count, stats.collect_count),
        followers: metric(a.follower_count, astats.follower_count, astats.followerCount), time: metric(x.create_time, x.createTime), region: x.region || "", source: r.source || "TikWM", keys: [], on: false };
      var origine = String(x.source_keyword || kw || "recherche").trim();
      if (origine && item.keys.indexOf(origine) === -1) item.keys.push(origine);
      found[id] = item;
    });
  },
  veilleSearch: function () {
    var self = this, core = this.core, v = this.st().veille, btn = this.$("exVSearch"), out = this.$("exVOut");
    this.veilleSaveForm();
    var keys = String(v.keys || "").split(/\n+/).map(function (k) { return k.replace(/^#/, "").trim(); }).filter(Boolean).slice(0, 8);
    if (!keys.length) return core.toast("Écrivez au moins un mot-clé (ou « Proposer des mots-clés »).", "err");
    btn.disabled = true; var found = {}, errors = [], warnings = [], chain = Promise.resolve();
    keys.forEach(function (kw, i) {
      chain = chain.then(function () {
        out.innerHTML = '<p class="hint">Recherche « ' + window.AgnesApp.esc(kw) + ' » (' + (i + 1) + '/' + keys.length + ')…</p>';
        return self.tikwmSearch(kw, 0).then(function (r) {
          if (r.warning) warnings.push(r.warning);
          self.veilleIngest(found, kw, r);
        }, function (e) { errors.push(kw + " : " + (e.message || e)); })
          .then(function () { return new Promise(function (res) { setTimeout(res, 1200); }); });   // TikWM : ~1 requête / s
      });
    });
    chain.then(function () {
      v.results = Object.keys(found).map(function (k) { return found[k]; }); v.at = Date.now(); v.analysis = "";
      v.notice = warnings.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(" "); v.errors = errors;
      self.veilleView().slice(0, 5).forEach(function (r) { r.on = true; });
      core.saveProject(); self.veilleRender();
      if (!v.results.length) core.toast("Aucune vidéo trouvée" + (errors.length ? " — " + errors[0] + ". Vérifiez que le pont est relancé, puis réessayez." : "."), "err");
      else core.toast(v.results.length + " vidéo(s) trouvée(s) ; les " + Math.min(v.keep || 20, self.veilleView().length) + " meilleures sont affichées" + (errors.length ? " (" + errors.length + " recherche(s) en échec)" : "") + ".", "ok");
    }).finally(function () { btn.disabled = false; });
  },
  veilleTikTokBrowserSearch: function (keys, compte, out, country) {
    var self = this;
    if (!window.chrome || !chrome.tabs || !chrome.scripting) return Promise.reject(new Error("ouvrez Agnes depuis l’extension Lumina pour utiliser la recherche TikTok du navigateur"));
    var tabId = null, items = [], vus = {}, limite = Math.max(10, Math.min(60, Number(compte) || 20)), cible = String(country || "").trim();
    function erreurChrome(repli) { return chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : repli; }
    function attendre(id) {
      return new Promise(function (resolve, reject) {
        var fini = false, timer = setTimeout(function () { nettoyer(); reject(new Error("TikTok met trop longtemps à charger")); }, 30000);
        function nettoyer() { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(ecoute); }
        function ok() { if (fini) return; fini = true; nettoyer(); setTimeout(resolve, 1800); }
        function ecoute(changedId, change) { if (changedId === id && change.status === "complete") ok(); }
        chrome.tabs.onUpdated.addListener(ecoute);
        chrome.tabs.get(id, function (tab) { if (chrome.runtime.lastError) { nettoyer(); reject(new Error(erreurChrome("onglet TikTok inaccessible"))); } else if (tab && tab.status === "complete") ok(); });
      });
    }
    function ouvrir(url) {
      return new Promise(function (resolve, reject) {
        if (tabId == null) chrome.tabs.create({ url: url, active: false }, function (tab) {
          if (chrome.runtime.lastError || !tab) reject(new Error(erreurChrome("impossible d’ouvrir TikTok")));
          else { tabId = tab.id; resolve(); }
        });
        else chrome.tabs.update(tabId, { url: url, active: false }, function () {
          if (chrome.runtime.lastError) reject(new Error(erreurChrome("impossible d’ouvrir la recherche TikTok"))); else resolve();
        });
      }).then(function () { return attendre(tabId); });
    }
    function relever() {
      return new Promise(function (resolve, reject) {
        chrome.scripting.executeScript({ target: { tabId: tabId }, func: async function () {
          for (var tour = 0; tour < 3; tour++) {
            window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
            await new Promise(function (r) { setTimeout(r, 1200); });
          }
          var urls = [], deja = {};
          function ajouter(brut) {
            try {
              var u = new URL(brut, location.href), m = u.href.match(/^https:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+/i);
              if (m && !deja[m[0].toLowerCase()]) { deja[m[0].toLowerCase()] = true; urls.push(m[0]); }
            } catch (e) { }
          }
          document.querySelectorAll('a[href*="/video/"]').forEach(function (a) { ajouter(a.href); });
          var html = document.documentElement.innerHTML.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
          (html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d+/gi) || []).forEach(ajouter);
          var texte = (document.body && document.body.innerText || "").slice(0, 1500);
          return { urls: urls, connexion: /se connecter|log in|sign up|captcha|verify/i.test(texte) };
        } }, function (res) {
          if (chrome.runtime.lastError) reject(new Error(erreurChrome("lecture de TikTok refusée")));
          else resolve(res && res[0] && res[0].result || { urls: [] });
        });
      });
    }
    var chaine = Promise.resolve(), connexion = false;
    keys.forEach(function (kw, i) {
      chaine = chaine.then(function () {
        if (items.length >= limite) return;
        out.innerHTML = '<p class="hint">TikTok affiche les résultats « ' + window.AgnesApp.esc(kw) + ' » (' + (i + 1) + '/' + keys.length + ')…</p>';
        var requete = kw + (cible && !/^(monde|global|world)$/i.test(cible) ? " " + cible : "");
        return ouvrir("https://www.tiktok.com/search/video?q=" + encodeURIComponent(requete)).then(relever).then(function (rep) {
          connexion = connexion || !!rep.connexion;
          (rep.urls || []).forEach(function (url) {
            var id = url.toLowerCase(); if (!vus[id] && items.length < limite) { vus[id] = true; items.push({ url: url, keyword: kw }); }
          });
        });
      });
    });
    return chaine.then(function () {
      if (!items.length) throw new Error(connexion ? "TikTok demande une connexion ou une vérification : ouvrez TikTok, connectez-vous, puis réessayez" : "TikTok n’a affiché aucun lien vidéo direct pour ces mots-clés");
      out.innerHTML = '<p class="hint">' + items.length + ' lien(s) trouvé(s) dans TikTok. Vérification des comptes et des statistiques…</p>';
      return fetch(self.bridgeBase() + "/tiktok/verifier-liens", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ items: items, count: limite }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
    }).finally(function () { if (tabId != null) chrome.tabs.remove(tabId, function () { void chrome.runtime.lastError; }); });
  },
  veilleCodexSearch: function () {
    var self = this, core = this.core, v = this.st().veille, btn = this.$("exVCodex"), out = this.$("exVOut");
    this.veilleSaveForm();
    var keys = String(v.keys || "").split(/\n+/).map(function (k) { return k.replace(/^#/, "").trim(); }).filter(Boolean).slice(0, 8);
    if (!keys.length) return core.toast("Écrivez au moins un mot-clé (ou « Proposer des mots-clés »).", "err");
    btn.disabled = true; btn.textContent = "Recherche renforcée…";
    out.innerHTML = '<p class="hint">Codex cherche des liens TikTok publics. Si le Web n’en expose pas, la recherche continuera automatiquement dans TikTok…</p>';
    var controle = typeof AbortController !== "undefined" ? new AbortController() : null;
    var minuterie = controle ? setTimeout(function () { controle.abort(); }, 300000) : null, codexErreur = "";
    fetch(this.bridgeBase() + "/tiktok/recherche-codex", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ keywords: keys, count: Math.min(20, Number(v.keep) || 20), period: Number(v.period) || 0, country: v.country || "" }),
      signal: controle ? controle.signal : undefined
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
      .catch(function (e) {
        codexErreur = e && e.name === "AbortError" ? "Codex : délai dépassé" : "Codex : " + (e.message || e);
        if (minuterie) { clearTimeout(minuterie); minuterie = null; }
        out.innerHTML = '<p class="hint">Codex n’a pas fourni de lien direct. Recherche dans TikTok avec votre navigateur…</p>';
        return self.veilleTikTokBrowserSearch(keys, Math.min(60, Math.max(20, Number(v.keep) || 20)), out, v.country);
      }).then(function (j) {
        var d = j.data || {}, rep = { videos: d.videos || [], source: j.source || "Recherche renforcée + statistiques TikWM", warning: j.warning || "" }, found = {};
        if (codexErreur) rep.warning = codexErreur + ". " + rep.warning;
        self.veilleIngest(found, keys.join(", "), rep);
        v.results = Object.keys(found).map(function (k) { return found[k]; }); v.at = Date.now(); v.analysis = "";
        v.notice = rep.warning; v.errors = [];
        self.veilleView().slice(0, 5).forEach(function (x) { x.on = true; });
        if (!v.results.length) throw new Error("aucun lien TikTok direct et vérifiable trouvé");
        core.saveProject(); self.veilleRender();
        core.toast(v.results.length + " vidéo(s) trouvée(s) et vérifiée(s).", "ok");
      }).catch(function (e) {
        var message = e && e.name === "AbortError" ? "délai dépassé après 5 minutes" : (e.message || e);
        v.errors = ["Recherche renforcée : " + message]; self.veilleRender();
        core.toast("Recherche renforcée : " + message, "err");
      }).finally(function () {
        if (minuterie) clearTimeout(minuterie);
        btn.disabled = false; btn.textContent = "🌐 Recherche renforcée (Codex + TikTok)";
      });
  },
  // Résultats filtrés (période, durée) et classés
  veilleView: function () {
    var v = this.st().veille, now = Date.now() / 1000, list = (v.results || []).slice();
    if (v.period) list = list.filter(function (r) { return r.time && now - r.time <= v.period * 86400; });
    if (v.maxDur) list = list.filter(function (r) { return !r.dur || r.dur <= v.maxDur; });
    var score = { play: function (r) { return r.play || 0; }, like: function (r) { return r.like || 0; }, share: function (r) { return r.share || 0; },
      eng: function (r) { return r.play > 500 ? ((r.like || 0) + (r.comment || 0) * 2 + (r.share || 0) * 3) / r.play : 0; } }[v.sort || "play"];
    return list.sort(function (a, b) { return score(b) - score(a); }).slice(0, v.keep || 20);
  },
  veilleRender: function () {
    var self = this, v = this.st().veille, out = this.$("exVOut"), esc = window.AgnesApp.esc, list = this.veilleView();
    if (!v.results || !v.results.length) {
      out.innerHTML = v.errors && v.errors.length ? '<div class="refs-block"><b>Recherche indisponible</b><p class="hint" style="margin:5px 0 0">' + esc(v.errors.join(" · ")) + '<br>Relancez le pont local, puis réessayez. Les erreurs restent affichées pour faciliter le diagnostic.</p></div>' : "";
      return;
    }
    var n = function (x) { return x == null ? "—" : x >= 1e6 ? (x / 1e6).toFixed(1).replace(".", ",") + " M" : x >= 1e3 ? Math.round(x / 1e3) + " k" : String(x); };
    var all = v.results;
    out.innerHTML = '<p class="hint" style="margin:0 0 8px">' + list.length + ' vidéo(s) affichée(s) sur ' + all.length + ' trouvée(s)' + (v.at ? ' · recherche du ' + new Date(v.at).toLocaleString("fr-FR") : '') + '</p>' +
      (v.notice ? '<div class="refs-block" style="margin-bottom:8px"><span class="hint">' + esc(v.notice) + '</span></div>' : '') +
      (v.errors && v.errors.length ? '<p class="hint" style="margin:0 0 8px">Recherches non abouties : ' + esc(v.errors.join(" · ")) + '</p>' : '') +
      list.map(function (r) {
        var i = all.indexOf(r), eng = r.play ? Math.round(((r.like || 0) + (r.comment || 0) + (r.share || 0)) / r.play * 1000) / 10 : null;
        return '<div class="ext-row ex-vrow"><input type="checkbox" data-vi="' + i + '"' + (r.on ? " checked" : "") + ' aria-label="Garder cette vidéo">' +
          (r.cover ? '<img src="' + esc(r.cover) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ex-vnocover"></span>') +
          '<div class="grow"><b>' + esc((r.title || "Vidéo TikTok").slice(0, 110)) + '</b><br><span class="hint" style="margin:0">@' + esc(r.user || "—") +
          (r.nickname ? ' (' + esc(r.nickname) + ')' : '') + (r.time ? ' · ' + new Date(r.time * 1000).toLocaleDateString("fr-FR") : ' · date indisponible') + (r.dur ? ' · ' + r.dur + ' s' : '') + ' · via « ' + esc(r.keys.join(", ")) + ' »</span>' +
          '<div class="ex-vstats"><span>👁 ' + n(r.play) + '</span><span>❤ ' + n(r.like) + '</span><span>💬 ' + n(r.comment) + '</span><span>↗ ' + n(r.share) + '</span>' + (r.collect != null ? '<span>🔖 ' + n(r.collect) + '</span>' : '') +
          '<span>' + (eng == null ? "engagement —" : eng + " % d'engagement") + '</span><span>source : ' + esc(r.source || "TikWM") + '</span>' +
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
