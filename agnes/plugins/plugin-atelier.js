// plugins/plugin-atelier.js — Atelier IA : une équipe d'agents IA (Agnes, Gemini, Groq, OpenRouter, Mistral…) du concept à la publication
// et un Chef de production qui fait le lien entre les agents et l'app. Toute action qui modifie l'app
// (Bible, Scénario, Le lot, Publication) ou qui lance un agent passe par une autorisation de l'utilisateur.
AgnesPlugins.register("atelier", {
  name: "Atelier IA (agents)",
  version: "1.0",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core;
    var cfg = core.pluginSettings("atelier", { key: "", model: "mistral-medium-latest", base: "https://api.mistral.ai/v1", temperature: 0.7, autoRun: false });
    // Passage à plusieurs fournisseurs : { primary, keys{}, models{}, fallback, customBase }
    if (!cfg.keys) {
      cfg.keys = {}; cfg.models = {};
      if (cfg.key) { cfg.keys.mistral = cfg.key; cfg.models.mistral = cfg.model || this.PROVIDERS.mistral.def; }
      cfg.primary = "agnes"; cfg.fallback = true; cfg.customBase = "";
      cfg.save();
    }
    // 30/09 : clés reçues du .env avant tout réglage (cles-env.js remplit cfg.keys) → le reste de la configuration manquait
    if (!cfg.models) cfg.models = {};
    if (!cfg.primary) cfg.primary = "agnes";
    if (cfg.fallback === undefined) cfg.fallback = true;
    if (cfg.customBase === undefined) cfg.customBase = "";
    // Agnes (clé de l'app) devient le principal, sauf si un autre fournisseur a déjà été choisi avec sa clé
    if (!cfg.agnesChecked) { if (!(cfg.keys[cfg.primary])) cfg.primary = "agnes"; cfg.agnesChecked = true; cfg.save(); }
    this.cfg = cfg; this.agents = []; this.sel = "a1"; this.busy = false; this.pending = null;

    var view = core.ui.addTab("atelier", "Atelier IA",
      '<div class="card"><h3>Atelier IA — équipe de production</h3>' +
      '<p class="hint" style="margin-top:0">Une équipe d\'agents IA (Agnes, Gemini, Groq, OpenRouter, Mistral…) écrit la série étape par étape. Le <b>Chef de production</b> coordonne l\'équipe et, <b>avec votre autorisation</b>, ' +
      'range le travail dans l\'app : personnages et lieux dans la Bible, scénario dans l\'onglet Scénario, prompts dans Le lot, textes dans Publication.</p>' +
      '<details id="atCfgBox"><summary>Connexion aux IA (clés API)</summary>' +
      '<p class="hint" style="margin:8px 0"><b>Agnes AI</b> utilise directement votre clé Agnes (⚙) : rien à ajouter. Vous pouvez aussi renseigner d\'autres clés. Le <b>fournisseur principal</b> fait le travail ; avec le <b>repli automatique</b>, ' +
      'quand il atteint sa limite, l\'Atelier continue avec le suivant. Additionner plusieurs offres gratuites donne plus de requêtes par jour.</p>' +
      '<div id="atProv"></div>' +
      '<datalist id="atModels"></datalist>' +
      '<div class="row-inline" style="margin-top:8px"><label class="inline">Fournisseur principal <select id="atPrimary"></select></label>' +
      '<label class="inline"><input type="checkbox" id="atFallback"> Repli automatique sur les autres fournisseurs en cas de limite</label></div>' +
      '<div class="row-inline"><label class="inline">Créativité <input type="number" id="atTemp" min="0" max="1.5" step="0.1" class="mini"></label>' +
      '<label class="inline"><input type="checkbox" id="atAuto"> Le chef peut lancer les agents sans me demander (le rangement dans l\'app reste toujours soumis à autorisation)</label></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="atSaveCfg">Enregistrer</button><button class="small-btn" id="atTest">Tester les connexions</button></div>' +
      '<pre id="atTestOut" class="diag-log" style="display:none"></pre>' +
      '<p class="hint">⚠ Offres gratuites : vos requêtes peuvent servir à entraîner les modèles du fournisseur (Google et Mistral le précisent). Pour une série inédite, tenez-en compte. ' +
      'Les clés restent dans ce navigateur et ne sont envoyées qu\'au fournisseur concerné.</p></details></div>' +

      '<div class="at-grid">' +
      // --- Chef de production
      '<div class="card at-chat"><h3>🎬 Chef de production</h3>' +
      '<div id="atMsgs" class="at-msgs"></div>' +
      '<div style="position:relative"><div id="atMention" class="at-mention" style="display:none"></div>' +
      '<textarea id="atInput" rows="3" placeholder="Ex. Voici mon idée : … Lance le développement de concept. / Range les personnages dans la Bible. / @6 écris la scène 2 (le @ appelle un agent directement)"></textarea></div>' +
      '<div class="row-inline" style="margin-top:6px"><button class="primary-btn" id="atSend">Envoyer</button><button class="small-btn" id="atClearChat">Nouvelle discussion</button><span class="hint" id="atBusy" style="margin:0"></span></div>' +
      '<div class="at-docs"><h3 style="margin:14px 0 4px">📎 Documents</h3>' +
      '<p class="hint" style="margin:0 0 6px">Scripts, notes, articles, bible existante… Les agents choisis les lisent avec leurs entrées. Enregistrés dans le projet.</p>' +
      '<div class="row-inline"><label class="small-btn" style="cursor:pointer">+ Fichier (.txt, .md, .fountain, .docx, .pdf…)<input type="file" id="atDocFile" multiple hidden accept=".txt,.md,.markdown,.fountain,.csv,.json,.srt,.vtt,.html,.htm,.docx,.pdf"></label>' +
      '<button class="small-btn" id="atDocPasteBtn" type="button">+ Texte collé</button></div>' +
      '<div class="row-inline" style="margin-top:6px"><input type="url" id="atDocUrl" placeholder="https://… (page web à lire)" style="flex:1;min-width:160px"><button class="small-btn" id="atDocUrlBtn" type="button">Lire la page</button></div>' +
      '<p class="hint" style="margin:4px 0 0">La lecture d\'une page web passe par le service gratuit Jina Reader (r.jina.ai), qui reçoit l\'adresse.</p>' +
      '<div id="atDocPaste" style="display:none;margin-top:6px"><input type="text" id="atDocPasteName" placeholder="Nom du document"><textarea id="atDocPasteText" rows="5" placeholder="Collez le texte ici"></textarea>' +
      '<div class="row-inline" style="margin-top:4px"><button class="small-btn" id="atDocPasteOk" type="button">Ajouter</button><button class="small-btn" id="atDocPasteCancel" type="button">Annuler</button></div></div>' +
      '<div id="atDocList" style="margin-top:8px"></div></div></div>' +
      // --- Chaîne des agents
      '<div class="card"><div class="at-head"><h3 style="margin:0">Chaîne de production</h3>' +
      '<label class="small-btn" style="cursor:pointer" title="Agents exportés depuis RMAOPN AI (un ou plusieurs fichiers, ou la sauvegarde complète .RMAOPN.json), ou une équipe exportée de l\'Atelier">⬆ Importer des agents (RMAOPN / .json)<input type="file" id="atImport" accept=".json" multiple hidden></label></div>' +
      '<div id="atImportBox"></div><div id="atList" class="at-list" style="margin-top:10px"></div><div id="atAgent"></div></div>' +
      '</div>');

    // ---------- Réglages ----------
    function $(id) { return document.getElementById(id); }
    function fillCfg() {
      var P = self.PROVIDERS;
      $("atProv").innerHTML = '<table class="at-prov"><tr><th>Fournisseur</th><th>Clé API</th><th>Modèle par défaut</th><th></th></tr>' +
        Object.keys(P).map(function (id) {
          var p = P[id];
          return '<tr><td><b>' + esc(p.label) + '</b><div class="hint" style="margin:0">' + esc(p.note) + '</div>' +
            (id === "custom" ? '<input type="text" id="atBase_custom" placeholder="https://…/v1" value="' + esc(cfg.customBase || "") + '" style="margin-top:4px">' : '') + '</td>' +
            '<td><input type="password" id="atKey_' + id + '" autocomplete="off" value="' + esc(cfg.keys[id] || "") + '" placeholder="' + (p.appKey ? (App.settings.apiKey ? "clé des réglages ⚙ utilisée" : "ajoutez votre clé Agnes dans ⚙") : p.keyUrl ? "clé…" : "") + '"></td>' +
            '<td><input type="text" id="atModel_' + id + '" list="atModels_' + id + '" value="' + esc(cfg.models[id] || p.def) + '">' +
            '<datalist id="atModels_' + id + '">' + p.models.map(function (m) { return '<option value="' + esc(m) + '">'; }).join("") + '</datalist></td>' +
            '<td>' + (p.keyUrl ? '<a href="' + p.keyUrl + '" target="_blank" rel="noopener" class="hint" style="margin:0">obtenir une clé</a>' : '') + '</td></tr>';
        }).join("") + '</table>';
      $("atPrimary").innerHTML = Object.keys(P).map(function (id) { return '<option value="' + id + '"' + (cfg.primary === id ? " selected" : "") + '>' + esc(P[id].label) + '</option>'; }).join("");
      $("atFallback").checked = cfg.fallback !== false; $("atTemp").value = cfg.temperature; $("atAuto").checked = !!cfg.autoRun;
      self.fillModelList();
      if (!self.configured().length) $("atCfgBox").open = true;
    }
    function readCfg() {
      Object.keys(self.PROVIDERS).forEach(function (id) {
        cfg.keys[id] = $("atKey_" + id).value.trim();
        cfg.models[id] = $("atModel_" + id).value.trim() || self.PROVIDERS[id].def;
      });
      cfg.customBase = $("atBase_custom").value.trim();
      cfg.primary = $("atPrimary").value; cfg.fallback = $("atFallback").checked;
      cfg.temperature = App.clamp($("atTemp").value, 0, 1.5); cfg.autoRun = $("atAuto").checked; cfg.save();
      self.fillModelList();
    }
    $("atSaveCfg").addEventListener("click", function () {
      readCfg();
      if (!self.keyOf(cfg.primary)) core.toast("Attention : le fournisseur principal n'a pas de clé.", "err");
      else core.toast("Réglages de l'Atelier enregistrés.", "ok");
    });
    $("atTest").addEventListener("click", function () { readCfg(); self.testAll(); });

    // ---------- Données ----------
    this.project = function () {
      var p = core.getProject(); if (!p) return null;
      if (!p.atelier) p.atelier = { outputs: {}, requests: {}, chat: [] };
      if (!p.atelier.docs) p.atelier.docs = [];
      return p.atelier;
    };
    core.store.getKV("atelier:agents").then(function (saved) {
      self.agents = self.mergeAgents(saved);
      fillCfg(); self.renderAll();
    });
    core.on("project:change", function () { self.renderAll(); });
    core.on("view:change", function (id) { if (id === "view_atelier") self.renderAll(); });

    // ---------- Chaîne ----------
    $("atList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-ag]"); if (!b) return;
      self.sel = b.getAttribute("data-ag"); self.renderAll();
    });
    $("atAgent").addEventListener("click", function (e) {
      var b = e.target.closest("[data-at]"); if (!b) return;
      self.agentAction(b.getAttribute("data-at"), b);
    });
    $("atAgent").addEventListener("input", function (e) {
      var st = self.project(), f = e.target.getAttribute("data-af"); if (!st || !f) return;
      if (f === "request") { st.requests[self.sel] = e.target.value; core.saveProject(); }
      if (f === "output") { var o = st.outputs[self.sel] || (st.outputs[self.sel] = { text: "", at: Date.now() }); o.text = e.target.value; o.edited = true; core.saveProject(); }
    });

    // ---------- Chef de production ----------
    $("atSend").addEventListener("click", function () { self.managerSend(); });
    $("atInput").addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) self.managerSend(); if (e.key === "Escape") self.hideMentions(); });
    $("atInput").addEventListener("input", function () { self.showMentions(); });
    $("atInput").addEventListener("blur", function () { setTimeout(function () { self.hideMentions(); }, 150); });
    $("atClearChat").addEventListener("click", function () {
      var st = self.project(); if (!st || !window.confirm("Effacer la discussion avec le chef de production ? (Le travail des agents est conservé.)")) return;
      st.chat = []; self.pending = null; core.saveProject(); self.renderChat();
    });
    $("atDocFile").addEventListener("change", function () { var fl = Array.from(this.files); this.value = ""; self.addDocFiles(fl); });
    $("atDocUrlBtn").addEventListener("click", function () { self.addDocUrl($("atDocUrl").value.trim()); });
    $("atDocUrl").addEventListener("keydown", function (e) { if (e.key === "Enter") self.addDocUrl(this.value.trim()); });
    $("atDocPasteBtn").addEventListener("click", function () { $("atDocPaste").style.display = ""; $("atDocPasteText").focus(); });
    $("atDocPasteCancel").addEventListener("click", function () { $("atDocPaste").style.display = "none"; });
    $("atDocPasteOk").addEventListener("click", function () {
      var t = $("atDocPasteText").value.trim(); if (!t) return;
      self.addDoc($("atDocPasteName").value.trim() || "Texte collé", t, "texte");
      $("atDocPasteText").value = ""; $("atDocPasteName").value = ""; $("atDocPaste").style.display = "none";
    });
    $("atDocList").addEventListener("change", function (e) {
      var row = e.target.closest("[data-doc]"); if (!row) return;
      var d = self.doc(row.getAttribute("data-doc")); if (!d) return;
      if (e.target.getAttribute("data-dk") === "on") d.on = e.target.checked;
      if (e.target.getAttribute("data-dk") === "for") d.for = e.target.value;
      core.saveProject(); self.renderDocs();
    });
    $("atDocList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-dact]"), row = b && b.closest("[data-doc]"); if (!row) return;
      var id = row.getAttribute("data-doc"), st = self.project(), d = self.doc(id);
      if (b.getAttribute("data-dact") === "del" && window.confirm("Retirer « " + d.name + " » ?")) { st.docs = st.docs.filter(function (x) { return x.id !== id; }); core.saveProject(); self.renderDocs(); }
      if (b.getAttribute("data-dact") === "view") { var w = window.open("", "_blank"); if (w) { w.document.title = d.name; var pre = w.document.createElement("pre"); pre.style.whiteSpace = "pre-wrap"; pre.textContent = d.content; w.document.body.appendChild(pre); } }
    });
    $("atImport").addEventListener("change", function () { var fl = Array.from(this.files); this.value = ""; self.readImport(fl); });
    $("atImportBox").addEventListener("click", function (e) {
      var b = e.target.closest("[data-imp]"); if (!b) return;
      if (b.getAttribute("data-imp") === "apply") self.applyImport(); else { self.imp = null; self.renderImport(); }
    });
    $("atMsgs").addEventListener("click", function (e) {
      var cp = e.target.closest("[data-copy]"), op = e.target.closest("[data-open]");
      if (cp) { var pre = cp.parentNode.querySelector("code"); self.copyText(pre ? pre.textContent : "", cp); return; }
      if (op) { self.openPath(op.getAttribute("data-open"), op); return; }
      var b = e.target.closest("[data-auth]"); if (!b || !self.pending) return;
      self.resolvePending(b.getAttribute("data-auth"));
    });
  },

  // =========================================================
  // L'ÉQUIPE (consignes par défaut, modifiables ; collez-y vos consignes de Gems)
  // =========================================================
  COMMON: "Tu fais partie de l'équipe de production d'Agnes Studio Pro, une app qui produit des séries courtes générées par IA " +
    "(format vertical TikTok/Reels ; images par Agnes Image 2.5 ou ChatGPT, vidéos de 4 à 12 s par Agnes Video 2.5, Grok ou Google Flow). " +
    "Réponds en français, sauf pour les prompts et l'ADN visuel, en anglais. Travaille uniquement à partir des ENTRÉES fournies : " +
    "n'invente pas de personnage, de lieu ou de fait qui contredirait les étapes précédentes. Si une entrée manque, dis-le en une phrase puis fais au mieux. " +
    "Pas de texte, sous-titres ni musique dans les prompts d'image ou de vidéo (dialogues, musique et titres sont gérés à part). " +
    "Structure des prompts (anglais), dans cet ordre : IMAGE = sujet (qui, action figée, place dans l'image) + décor et moment + style + lumière + composition (angle, cadrage) + exigences de qualité (textures, netteté) ; " +
    "VIDÉO = sujet et décor de départ + action et évolution au fil des secondes + mouvement de caméra + style visuel + exigences de cohérence (ce qui ne doit pas changer : visages, tenues, décor). " +
    "Jeu humain et subtil ; celui qui parle regarde son interlocuteur. " +
    "RÉPLIQUES (dialogues en français, entre « » dans les prompts vidéo) : phrases courtes, sans caractères spéciaux (pas de tiret —, pas de ; ni de :, pas de guillemets à l'intérieur), aucun espace avant ? ou !, et des points de suspension … (le caractère …) à la place d'un point qui couperait la réplique en deux phrases (le point final de la réplique reste) : ces caractères coupent la parole des personnages, surtout quand ils sont deux.",
  DEFAULT_AGENTS: [
    { id: "a1", num: "1", name: "Développeur de Concept", inputs: [], context: [], dest: "none",
      desc: "Analyse une idée brute et en extrait un concept solide et vendable : thème, promesse émotionnelle, conflit moral, moteur de la série.",
      instructions: "Tu es développeur de concept pour des séries courtes. À partir de l'idée brute (DEMANDE), produis :\n1. Titre provisoire (3 propositions)\n2. Logline (1 phrase)\n3. Thème et question morale centrale\n4. Promesse émotionnelle (ce que le public ressentira)\n5. Conflit central et moteur de la série (ce qui relance chaque épisode)\n6. Protagoniste et antagoniste en une ligne chacun\n7. Ton, genre, références\n8. Pourquoi ça marche en format court vertical (accroche, addictivité)\n9. Risques et points faibles, avec une correction pour chacun." },
    { id: "a2", num: "2", name: "Bible de Série", inputs: ["a1"], context: [], dest: "bible-serie",
      desc: "Construit la bible de série complète (concept, ton, monde, thèmes, arc de saison, structure, direction visuelle).",
      instructions: "Tu es showrunner. À partir du développement de concept, écris la bible de série :\n1. Concept et logline\n2. Ton et règles du genre\n3. Le monde : époque, lieux récurrents (nom + description courte de chacun)\n4. Thèmes\n5. Arc de saison (début, milieu, fin) et nombre d'épisodes conseillé\n6. Structure type d'un épisode (accroche 2 s, conflit, retournement, cliffhanger)\n7. Direction visuelle générale\nTermine par une ligne « STYLE COMMUN (anglais) : » : 15 à 30 mots de style visuel communs à tous les plans (lumière, optique, texture, palette), sans nom de personnage." },
    { id: "a3", num: "3", name: "Bible de Personnages", inputs: ["a2"], context: ["bible"], dest: "bible-perso",
      desc: "Crée les fiches d'identité complètes des personnages principaux et secondaires (identité, psychologie, arc, identité visuelle).",
      instructions: "Tu es auteur de bibles de personnages. Pour chaque personnage principal puis secondaire, écris une fiche :\n- Nom (et surnoms)\n- Rôle dans l'histoire, âge, métier\n- Psychologie : désir, peur, blessure, secret, contradiction\n- Arc sur la saison\n- Façon de parler (2 répliques d'exemple)\n- Relations avec les autres\n- ADN (anglais) : description physique stable pour la génération d'images, en une ligne : âge, morphologie, visage, cheveux, peau, signes distinctifs, tenue par défaut. Aucune émotion ni action.\nAjoute ensuite les lieux récurrents avec, pour chacun, une ligne « ADN (anglais) : » décrivant le décor." },
    { id: "a4", num: "4", name: "Architecte d'Épisodes", inputs: ["a2", "a3"], context: [], dest: "none",
      desc: "Construit le plan des épisodes (accroche, conflit, retournement, cliffhanger).",
      instructions: "Tu es architecte d'épisodes. Pour chaque épisode (ou celui demandé) : numéro et titre, accroche des 2 premières secondes, conflit, retournement, cliffhanger, personnages présents, lieux, durée visée (60 à 90 s). Vérifie que chaque épisode relance le moteur de la série." },
    { id: "a5", num: "5", name: "Découpeur de Scènes", inputs: ["a3", "a4"], context: ["bible"], dest: "none",
      desc: "Décompose chaque épisode en scènes détaillées (lieu vécu, accessoires, ambiance, objectif émotionnel).",
      instructions: "Tu es découpeur de scènes. Pour l'épisode demandé, liste les scènes dans l'ordre : numéro, lieu (INT./EXT. – moment), personnages, accessoires importants, ambiance (lumière, son), objectif émotionnel, ce qui change à la fin de la scène, durée estimée. Un épisode court compte 4 à 8 scènes." },
    { id: "a6", num: "6", name: "Scénariste Dialoguiste", inputs: ["a3", "a5"], context: ["bible"], dest: "scenario",
      desc: "Écrit le scénario complet avec dialogues restreints et sous-texte psychologique, scène par scène.",
      instructions: "Tu es scénariste-dialoguiste. Écris le scénario de l'épisode demandé, au format que l'app sait lire :\n- En-tête de scène : INT. LIEU – MOMENT (ou EXT.)\n- Actions en paragraphes courts, au présent, visibles à l'écran (un paragraphe = un plan)\n- Réplique : NOM DU PERSONNAGE en majuscules seul sur sa ligne, didascalie éventuelle entre parenthèses sur la ligne suivante, puis la réplique\n- Transitions : FONDU AU NOIR.\nDialogues rares et courts, beaucoup de sous-texte. Utilise exactement les noms de la bible de personnages. Pas de commentaire avant ou après le scénario." },
    { id: "a7", num: "7", name: "Directeur Artistique", inputs: ["a2", "a3"], context: ["bible"], dest: "bible-serie",
      desc: "Définit l'identité visuelle globale : palette par personnage/lieu, ambiance lumineuse, prompt de l'affiche officielle.",
      instructions: "Tu es directeur artistique. Définis : palette de couleurs globale (codes hex), palette et silhouette de chaque personnage, ambiance lumineuse de chaque lieu, optique et texture d'image, règles de cadrage. Donne ensuite le prompt (anglais) de l'affiche officielle, format 3:4, sans texte. Termine par une ligne « STYLE COMMUN (anglais) : » qui résume le style visuel en 15 à 30 mots." },
    { id: "a8", num: "8", name: "Prompt Image (Agnes Image 2.5)", inputs: ["a3", "a5", "a7"], context: ["bible", "library", "skills"], dest: "lot",
      desc: "Génère les prompts d'image (portraits, plans larges, plans de scène, lieux), chacun précédé d'un libellé français clair.",
      instructions: "Tu es chef opérateur et prompt designer. Pour l'épisode demandé, écris un plan par image à générer, au format exact :\n01 — libellé français (qui / quoi / type de plan)\nIMAGE : prompt en anglais (sujet, action figée, cadrage, lumière, décor, style)\nRÉF : noms des personnages et lieux présents, tels qu'ils sont écrits dans la Bibliothèque\n\n(ligne vide entre deux plans, numéros 01, 02, 03…). Ne répète pas l'ADN complet des personnages : cite leur nom, l'app ajoute l'ADN. Pas de texte dans l'image." },
    { id: "a9", num: "9", name: "Prompt Vidéo (Agnes Video 2.5)", inputs: ["a5", "a6", "a8"], context: [], dest: "lot",
      desc: "Écrit, pour chaque image numérotée, le prompt d'animation (mouvement, caméra, durée 4–12 s).",
      instructions: "Tu es réalisateur. Pour chaque image numérotée des prompts image, écris le mouvement à animer :\n01\nVIDÉO : en anglais, ce qui bouge (geste, regard, caméra), en partant exactement de l'image ; un seul plan continu, sans coupe ni nouveau personnage ; durée conseillée entre crochets, ex. [6 s]\n\nGarde les mêmes numéros que les prompts image. Décris le mouvement, pas l'image." },
    { id: "a10", num: "10", name: "Storyboard → Le lot", inputs: ["a8", "a9"], context: ["library", "skills"], dest: "lot",
      desc: "Compile les prompts image et vidéo en un storyboard numéroté prêt pour Le lot (une carte par plan).",
      instructions: "Tu es scripte de storyboard. Fusionne les prompts image et vidéo en un seul script, sans rien inventer, au format exact :\n01 — libellé\nIMAGE : …\nVIDÉO : …\nRÉF : …\nSKILLS : … (facultatif, noms exacts des skills de l'app)\n\nUn bloc par numéro, dans l'ordre, ligne vide entre les blocs. Si un numéro n'a pas de prompt vidéo, garde seulement IMAGE. Aucun commentaire autour." },
    { id: "a11", num: "11", name: "Vidéo externe (Seedance / Veo)", inputs: ["a10"], context: [], dest: "none",
      desc: "Pour chaque plan du storyboard, deux prompts JSON prêts à l'emploi (Seedance 2.0 et Veo 3.1 Lite), ancrés sur l'image de départ.",
      instructions: "Pour chaque plan du storyboard, écris deux prompts JSON (Seedance 2.0 puis Veo 3.1 Lite) ancrés sur l'image du plan comme image de départ littérale : sujet, action, caméra, lumière et heure, durée, contraintes (pas de texte, pas de musique, pas de coupe)." },
    { id: "a12", num: "12", name: "Package de Production", inputs: ["a1", "a2", "a3", "a4", "a7"], context: [], dest: "none",
      desc: "Compile le package final (titre, logline, synopsis, casting, identité visuelle, ordre de tournage) — synthèse pure, sans nouvelle création.",
      instructions: "Compile le package de production : titre, logline, synopsis, casting complet (nom, rôle, ADN), identité visuelle, liste des épisodes, ordre de tournage recommandé (par lieu, puis par personnage). Synthèse pure : n'invente rien." },
    { id: "a13", num: "13", name: "Plan de Tournage Vidéo", inputs: ["a10"], context: [], dest: "none",
      desc: "Organise les plans en ordre de génération (regroupements ≤ 12 s, dépendances, plans à valider d'abord).",
      instructions: "À partir du storyboard, établis le plan de tournage : ordre de génération conseillé (d'abord les images qui servent de référence, puis les plans par lieu), plans qui peuvent se suivre en continuité, durée de chaque plan (4 à 12 s), points de vigilance (continuité de tenue, de lumière, de regard). Aucun calcul inutile, un tableau clair." },
    { id: "a14", num: "14", name: "Community Manager", inputs: ["a1", "a4"], context: [], dest: "publication",
      desc: "Rédige les posts de sortie d'un épisode pour TikTok, YouTube et Instagram.",
      instructions: "Tu es community manager. Pour l'épisode demandé, écris : légende TikTok, titre et description YouTube Shorts, légende Instagram Reels, chacune avec accroche et hashtags adaptés. Termine OBLIGATOIREMENT par ce bloc, une info par ligne :\nFICHE PUBLICATION\nTitre : …\nAccroche : …\nRésumé : … (sans spoiler)\nHashtags : …\nAppel à l'action : …" },
    { id: "a15", num: "15", name: "Expert Montage", inputs: ["a6", "a10"], context: [], dest: "none",
      desc: "Conseille sur l'assemblage : teaser, stratégie de coupe, raccords de regard, transitions.",
      instructions: "Tu es monteur. Conseille l'assemblage de l'épisode : place du teaser, ordre et durée des plans, où couper (plans de 4 à 12 s), raccords de regard en champ/contre-champ, transitions (cut, fondu enchaîné, fondu au noir), placement de la musique et des silences, fin sur cliffhanger." },
    { id: "a16", num: "16", name: "Directeur de plans (prompt parfait)", inputs: ["a3", "a5", "a7"], context: ["bible", "library", "skills", "storyboard"], dest: "storyboard",
      desc: "Réécrit les prompts image et vidéo des cartes du Storyboard : placement exact de chaque personnage dans l'image, angle de caméra, mentions @ et #, règles de jeu et de rendu.",
      instructions: "Tu es directeur de plans : tu écris le prompt PARFAIT de chaque carte du Storyboard (voir STORYBOARD ACTUEL), pour les cartes demandées (toutes si rien n'est précisé).\n\n" +
        "MÉTHODE, pour chaque plan :\n" +
        "1. Qui est présent, où se passe la scène, quel moment (lumière).\n" +
        "2. Choisis UN angle de caméra précis (ex. de face à travers le pare-brise, depuis la banquette arrière, contre-champ par-dessus l'épaule de X).\n" +
        "3. Place chaque personnage et chaque objet important EN POSITION DANS L'IMAGE : gauche / centre / droite de l'image, premier plan / arrière-plan, qui regarde qui. Jamais « à sa gauche » ou « côté conducteur » seuls : les modèles se trompent de côté.\n" +
        "4. France : voitures à volant à gauche, circulation à droite. Pour une voiture, utilise le skill voiture qui correspond à l'angle (#[Voiture FR — …]) et écris quand même la position de chacun dans l'image.\n" +
        "5. Jeu : humain, subtil, jamais exagéré ; celui qui parle regarde son interlocuteur (sauf si le script dit autre chose). Image nette, sans grain, sans texte ; pas de musique.\n\n" +
        "ÉCRITURE (prompts en anglais) :\n" +
        "- Personnages, lieux, objets de la Bibliothèque : écris-les @[Nom exact] (l'app coche leur image de référence et ajoute leur ADN : ne décris pas leur physique).\n" +
        "- Skills : #[Titre exact] à l'endroit où la consigne doit s'appliquer (liste SKILLS ; n'invente pas de titre).\n" +
        "- IMAGE : l'instant figé (composition, positions, cadrage, lumière, décor). VIDÉO : seulement ce qui bouge à partir de cette image (gestes, regards, caméra), un seul plan continu, sans nouveau personnage.\n\n" +
        "FORMAT EXACT (un bloc par carte, numéro de carte du Storyboard, ligne vide entre les blocs, aucun commentaire autour) :\n" +
        "PLAN 3\nIMAGE : …\nVIDÉO : …\n\nOmets IMAGE pour une carte purement vidéo, et VIDÉO pour une carte image." },
    { id: "a0", num: "0", name: "Auditeur de Continuité", inputs: ["a3", "a6", "a10"], context: ["bible", "library"], dest: "bible-perso",
      desc: "Utilitaire hors chaîne : repère tout personnage ou lieu présent dans le scénario, les dialogues ou le storyboard mais jamais fiché.",
      instructions: "Tu es auditeur de continuité. Compare le scénario et le storyboard à la bible de personnages et à la Bible de l'app. Liste : 1) personnages ou lieux présents mais jamais fichés (propose pour chacun une fiche courte avec « ADN (anglais) : »), 2) incohérences de nom, d'âge, de tenue ou de lieu, 3) noms dans RÉF : qui n'existent pas dans la Bibliothèque." }
  ],
  DESTS: { none: "—", "bible-serie": "Bible (style de la série, lieux)", "bible-perso": "Bible (fiches et ADN)", scenario: "Onglet Scénario", lot: "Le lot (script numéroté)", publication: "Publication", storyboard: "Cartes du Storyboard (prompts)" },

  mergeAgents: function (saved) {
    var def = this.DEFAULT_AGENTS;
    if (!Array.isArray(saved) || !saved.length) return JSON.parse(JSON.stringify(def));
    var out = saved.slice();
    out.forEach(function (a) { if ((a.id === "a8" || a.id === "a10") && !a.imported && Array.isArray(a.context) && a.context.indexOf("skills") === -1 && !a.skillsCtx) { a.context.push("skills"); a.skillsCtx = true; } });
    def.forEach(function (d) { if (!out.some(function (a) { return a.id === d.id; })) out.push(JSON.parse(JSON.stringify(d))); });
    return out;
  },
  saveAgents: function () { this.core.store.setKV("atelier:agents", this.agents); },
  agent: function (id) { return this.agents.find(function (a) { return a.id === id; }); },
  ordered: function () {
    return this.agents.slice().sort(function (a, b) { var x = +a.num, y = +b.num; return (x === 0 ? 99 : x) - (y === 0 ? 99 : y); });
  },

  // =========================================================
  // FOURNISSEURS (tous au format OpenAI « chat/completions »)
  // =========================================================
  PROVIDERS: {
    agnes: { label: "Agnes AI", base: "https://apihub.agnes-ai.com/v1", keyUrl: "", gap: 3100, appKey: true,
      def: "agnes-2.5-flash", models: ["agnes-2.5-flash", "agnes-3.0-flash", "agnes-2.0-flash", "agnes-2.5-pro-alpha"],
      note: "Votre clé Agnes (celle des réglages ⚙) suffit. Offre gratuite : 20 requêtes/min en texte. agnes-2.5-pro-alpha est payant" },
    gemini: { label: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", keyUrl: "https://aistudio.google.com/apikey", gap: 4500,
      def: "gemini-2.5-flash", models: ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
      note: "Clé Google AI Studio, sans carte. Grand contexte. Flash-Lite : le plus de requêtes gratuites par jour" },
    groq: { label: "Groq", base: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys", gap: 2200,
      def: "openai/gpt-oss-120b", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.1-8b-instant"],
      note: "Sans carte, très rapide. Environ 30 requêtes/min et 1 000/jour par modèle ; peu de tokens par minute" },
    openrouter: { label: "OpenRouter", base: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", gap: 3200,
      def: "", models: [], note: "Modèles « :free » : 20 requêtes/min, 50/jour sans crédits achetés. Choisissez un modèle se terminant par :free" },
    mistral: { label: "Mistral", base: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai", gap: 1300,
      def: "mistral-small-latest", models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
      note: "Mode gratuit limité par modèle, crédits API mensuels" },
    custom: { label: "Autre (compatible OpenAI)", base: "", keyUrl: "", gap: 1500, def: "", models: [],
      note: "Adresse de base d'une API compatible OpenAI (…/v1)" }
  },
  keyOf: function (id) {
    var k = this.cfg.keys && this.cfg.keys[id];
    if (!k && this.PROVIDERS[id].appKey) k = window.AgnesApp.settings.apiKey || "";
    return k;
  },
  configured: function () {
    var c = this.cfg, self = this;
    return Object.keys(this.PROVIDERS).filter(function (id) { return self.keyOf(id) && (id !== "custom" || c.customBase) && (c.models[id] || self.PROVIDERS[id].def); });
  },
  baseOf: function (id) {
    if (id === "custom") return this.cfg.customBase.replace(/\/$/, "");
    if (id === "agnes") { var b = window.AgnesApp.settings.baseUrl; if (/agnes/.test(b || "")) return b.replace(/\/$/, ""); }
    return this.PROVIDERS[id].base.replace(/\/$/, "");
  },
  // « groq:openai/gpt-oss-20b » → groq ; sans préfixe, déduit du nom (gemini-…, mistral-…) ; sinon le principal
  resolveModel: function (spec) {
    var ids = Object.keys(this.PROVIDERS), m = String(spec || "").trim(), prov = null;
    var pre = m.match(/^([a-z]+):(.+)$/); if (pre && ids.indexOf(pre[1]) !== -1) { prov = pre[1]; m = pre[2]; }
    if (!prov && m) {
      if (/^agnes-/i.test(m)) prov = "agnes";
      else if (/^gemini|^gemma/i.test(m)) prov = "gemini";
      else if (/^(mistral|magistral|codestral|pixtral|ministral|devstral|open-mistral)/i.test(m)) prov = "mistral";
      else if (/:free$/.test(m)) prov = "openrouter";
      else if (/^(openai\/gpt-oss|llama|meta-llama\/|qwen\/|moonshotai\/)/i.test(m)) prov = "groq";
    }
    // Fournisseur non configuré (ex. agent RMAOPN réglé sur un modèle Mistral) : on garde le principal et son modèle
    if (!prov || this.configured().indexOf(prov) === -1) return { provider: this.cfg.primary, model: this.cfg.models[this.cfg.primary] || this.PROVIDERS[this.cfg.primary].def, fallbackOnly: !!m };
    return { provider: prov, model: m };
  },
  fillModelList: function () {
    var self = this, dl = document.getElementById("atModels"); if (!dl) return;
    dl.innerHTML = this.configured().map(function (id) {
      var list = self.PROVIDERS[id].models.slice(); var d = self.cfg.models[id]; if (d && list.indexOf(d) === -1) list.unshift(d);
      return list.map(function (m) { return '<option value="' + id + ":" + m + '">' + self.PROVIDERS[id].label + '</option>'; }).join("");
    }).join("");
  },

  // File séquentielle par fournisseur (chaque offre gratuite a son propre rythme)
  _queues: {}, _last: {},
  chat: function (messages, extra) {
    var self = this; extra = Object.assign({}, extra || {});
    if (!this.configured().length) return Promise.reject({ display: "Ajoutez au moins une clé API (Atelier IA → Connexion aux IA)." });
    var first = this.resolveModel(extra.model); delete extra.model;
    var noRetry = !!extra._noRetry, single = !!extra._single;
    var order = [first].concat(this.cfg.fallback !== false && !single ? this.configured().filter(function (id) { return id !== first.provider; })
      .map(function (id) { return { provider: id, model: self.cfg.models[id] || self.PROVIDERS[id].def }; }) : []);
    var errors = [];
    function attempt(i) {
      if (i >= order.length) {
        throw { display: errors.length > 1 ? "Tous les fournisseurs ont refusé : " + errors.join(" · ") : errors[0], rate: true };
      }
      var o = order[i];
      return self._enqueue(o.provider, function () { return self._post(o.provider, o.model, messages, Object.assign({}, extra), 0, noRetry); })
        .then(function (m) { m._provider = o.provider; m._model = o.model; if (i > 0) self.core.toast("Relais : " + self.PROVIDERS[o.provider].label + " a pris le relais.", "ok"); return m; },
          function (e) {
            errors.push(self.PROVIDERS[o.provider].label + " — " + (e.short || e.display || e.message || e));
            // on ne passe au suivant que pour une limite, une surcharge ou un modèle indisponible
            if ((e.rate || e.limit0 || e.server || e.model) && i + 1 < order.length) { self.core.toast(self.PROVIDERS[o.provider].label + " indisponible, essai avec " + self.PROVIDERS[order[i + 1].provider].label + "…"); return attempt(i + 1); }
            if (i === 0 && !(e.rate || e.limit0 || e.server || e.model)) throw e;
            return attempt(order.length);
          });
    }
    return attempt(0);
  },
  _enqueue: function (prov, fn) {
    var self = this, gap = this.PROVIDERS[prov].gap;
    var run = function () {
      var wait = Math.max(0, gap - (Date.now() - (self._last[prov] || 0)));
      return new Promise(function (r) { setTimeout(r, wait); }).then(fn);
    };
    var q = this._queues[prov] || Promise.resolve(), p = q.then(run, run);
    this._queues[prov] = p.catch(function () { });
    return p;
  },
  _post: function (prov, model, messages, extra, tries, noRetry) {
    var self = this, P = this.PROVIDERS[prov], name = P.label, key = this.keyOf(prov);
    delete extra._noRetry; delete extra._single;
    var body = Object.assign({ model: model, messages: messages, temperature: Number(this.cfg.temperature) }, extra);
    var headers = { "Authorization": "Bearer " + key, "Content-Type": "application/json" };
    if (prov === "openrouter") headers["X-Title"] = "Agnes Studio Pro";
    this._last[prov] = Date.now();
    return fetch(this.baseOf(prov) + "/chat/completions", { method: "POST", headers: headers, body: JSON.stringify(body) }).then(function (r) {
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 500) }; }
        if (Array.isArray(j)) j = j[0] || {};
        var err = j.error && typeof j.error === "object" ? j.error : j;
        var msg = err.message || j.message || j.detail || (typeof j.error === "string" ? j.error : "") || ("HTTP " + r.status);
        if (typeof msg !== "string") msg = JSON.stringify(msg);
        if (r.status === 429) {
          var after = parseFloat(r.headers.get("retry-after"));
          var daily = /day|quota|per.?day|RPD|exhaust/i.test(msg);
          if (!noRetry && !daily && tries < 2) {
            var wait = !isNaN(after) && after > 0 && after < 90 ? after * 1000 : [8000, 20000][tries];
            self.core.toast(name + " demande de ralentir : nouvel essai dans " + Math.round(wait / 1000) + " s…");
            return new Promise(function (res) { setTimeout(res, wait); }).then(function () { return self._post(prov, model, messages, extra, tries + 1, noRetry); });
          }
          throw { display: name + " : limite atteinte (429" + (daily ? ", quota du jour épuisé" : "") + "). " + msg.slice(0, 200), short: "limite atteinte" + (daily ? " (quota du jour)" : ""), rate: true };
        }
        if (r.status === 401 || r.status === 403) throw { display: name + " : clé refusée (" + r.status + "). Recopiez-la depuis le site du fournisseur. " + msg.slice(0, 160), short: "clé refusée (" + r.status + ")" };
        if (r.status === 404 || (r.status === 400 && /model/i.test(msg) && /not|unknown|invalid|exist|support|found/i.test(msg)))
          throw { display: name + " : modèle « " + model + " » indisponible. " + msg.slice(0, 160), short: "modèle « " + model + " » indisponible", model: true };
        if (r.status >= 500) throw { display: name + " : erreur du serveur (" + r.status + "). " + msg.slice(0, 160), short: "serveur " + r.status, server: true };
        if (!r.ok) throw { display: name + " : " + msg.slice(0, 300), short: msg.slice(0, 80), status: r.status };
        var m = j.choices && j.choices[0] && j.choices[0].message;
        if (!m) throw { display: name + " : réponse inattendue.", short: "réponse inattendue" };
        return m;
      });
    }, function (e) {
      throw { display: name + " injoignable depuis la page (" + (e.message || e) + "). Si c'est systématique, le navigateur bloque peut-être l'appel (CORS).", short: "injoignable", server: true };
    });
  },
  // Test : chaque fournisseur configuré, un seul essai, et la liste de ses modèles
  testAll: function () {
    var self = this, out = document.getElementById("atTestOut"), ids = this.configured(), lines = [];
    out.style.display = "block";
    if (!ids.length) { out.textContent = "Aucune clé renseignée."; return; }
    function log(t) { lines.push(t); out.textContent = lines.join("\n"); }
    log("Test de " + ids.length + " fournisseur(s)…");
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        var model = self.cfg.models[id] || self.PROVIDERS[id].def;
        return self._enqueue(id, function () { return self._post(id, model, [{ role: "user", content: "Réponds uniquement : OK" }], { max_tokens: 8 }, 0, true); })
          .then(function () { log("✅ " + self.PROVIDERS[id].label + " — " + model + " répond."); }, function (e) { log("❌ " + (e.display || e.message || e)); })
          .then(function () {
            return fetch(self.baseOf(id) + "/models", { headers: { "Authorization": "Bearer " + self.keyOf(id) } }).then(function (r) { return r.ok ? r.json() : null; })
              .then(function (j) {
                var list = j && (j.data || j.models) || [];
                var names = list.map(function (x) { return String(x.id || x.name || "").replace(/^models\//, ""); }).filter(Boolean);
                if (id === "openrouter") names = names.filter(function (n) { return /:free$/.test(n); });
                if (id === "agnes") names = names.filter(function (n) { return !/image|video/i.test(n); });
                if (names.length) { self.PROVIDERS[id].models = names.slice(0, 60); log("   " + names.length + " modèle(s) disponible(s)" + (id === "openrouter" ? " gratuits" : "") + " — listés dans le champ Modèle."); }
              }, function () { });
          });
      });
    });
    chain.then(function () {
      var dl = document.getElementById("atModels_" + ids[0]);
      ids.forEach(function (id) { var d = document.getElementById("atModels_" + id); if (d) d.innerHTML = self.PROVIDERS[id].models.map(function (m) { return '<option value="' + m + '">'; }).join(""); });
      self.fillModelList(); log("Terminé.");
    });
  },

  // =========================================================
  // CONTEXTE DE L'APP (Bible, Bibliothèque)
  // =========================================================
  bibleText: function () {
    var B = window.AgnesPlugins && AgnesPlugins.get("bible"), s = B && B.series && B.series();
    if (!s) return "(Bible de l'app : vide ou extension inactive)";
    return "Série « " + s.name + " »" + (s.style ? " — style commun : " + s.style : "") + "\n" +
      (s.entries.length ? s.entries.map(function (e) { return "- " + e.name + " (" + e.kind + ")" + (e.dna ? " — ADN : " + e.dna : " — ADN à compléter"); }).join("\n") : "(aucune fiche)");
  },
  libraryText: function () {
    var p = this.core.getProject(), lib = (p && p.library || []).filter(function (l) { return l.kind !== "source"; });
    return lib.length ? lib.map(function (l) { return "- " + l.name + " (" + l.kind + ")"; }).join("\n") : "(Bibliothèque vide)";
  },
  skillsText: function () {
    var by = {};
    (window.AgnesApp.db.skills || []).forEach(function (s) { var c = (s.categories && s.categories[0]) || "Autres"; (by[c] = by[c] || []).push(s.title); });
    return Object.keys(by).sort().map(function (c) { return "- " + c + " : " + by[c].join(" · "); }).join("\n");
  },
  // Cartes du Storyboard : numéro affiché (#N), mode, format, prompts actuels, références et skills cochés
  storyboardText: function () {
    var A = window.AgnesApp, p = this.core.getProject(), shots = A.sortedShots(p);
    if (!shots.length) return "(Storyboard vide)";
    var name = function (id) { var l = p.library.find(function (x) { return x.id === id; }); return l ? l.name : null; };
    var skill = function (id) { var s = A.db.skills.find(function (x) { return x.id === id; }); return s ? s.title : null; };
    return shots.map(function (s, i) {
      var two = A.isTwoStep(s) || s.mode === "t2v";
      return "PLAN " + (i + 1) + " — " + A.MODE_LABEL(s) + " · " + (s.aspect || p.aspect) + (A.modeKind(s.mode) === "video" ? " · " + s.duration + " s" : "") + "\n" +
        (two ? "IMAGE actuelle : " + (s.imagePrompt || "(vide)") + "\nVIDÉO actuelle : " + (s.prompt || "(vide)")
          : (A.modeKind(s.mode) === "image" ? "IMAGE actuelle : " : "VIDÉO actuelle : ") + (s.prompt || "(vide)")) +
        "\nRéférences cochées : " + ((s.ingredients || []).map(name).filter(Boolean).join(", ") || "aucune") +
        "\nSkills cochés : " + ((s.skills || []).map(skill).filter(Boolean).join(", ") || "aucun");
    }).join("\n\n");
  },
  // Blocs « PLAN n / IMAGE : / VIDÉO : » → [{ plan, image, video }]
  parsePlans: function (text) {
    var out = [];
    String(text || "").replace(/\r/g, "").split(/\n(?=[ \t*#]*plan\s*#?\s*\d+)/i).forEach(function (b) {
      var m = b.match(/^[ \t*#]*plan\s*#?\s*(\d+)/i); if (!m) return;
      var x = { plan: +m[1] }, cur = null;
      b.split("\n").slice(1).forEach(function (line) {
        var h = line.match(/^[ \t*]*(IMAGE|VID[ÉE]O)[ \t*]*:[ \t]*(.*)$/i);
        if (h) { cur = /^image$/i.test(h[1]) ? "image" : "video"; x[cur] = h[2]; }
        else if (cur) x[cur] += "\n" + line;
      });
      ["image", "video"].forEach(function (k) { if (x[k] != null) x[k] = x[k].trim(); });
      if (x.image || x.video) out.push(x);
    });
    return out;
  },
  // Blocs d'un script numéroté « 01 — libellé / IMAGE : / VIDÉO : » (section LOT d'un document si elle existe) → [{ image, video }]
  parseLot: function (text) {
    var t = String(text || "").replace(/\r/g, ""), out = [], i = t.search(/^#+[ \t]*LOT\b/m);
    if (i !== -1) { t = t.slice(i).replace(/^[^\n]*\n/, ""); var fin = t.search(/^#+[ \t]/m); if (fin !== -1) t = t.slice(0, fin); }
    t.replace(/```[a-z]*/gi, "").split(/\n(?=[ \t]*\d{1,4}[ \t]*[—–-])/).forEach(function (b) {
      b = b.replace(/^\n+/, "");
      if (!/^[ \t]*\d{1,4}[ \t]*[—–-]/.test(b)) return;
      var x = {}, cur = null;
      b.split("\n").slice(1).forEach(function (line) {
        var h = line.match(/^[ \t*]*(IMAGE|VID[ÉE]O|R[ÉE]F)[ \t*]*:[ \t]*(.*)$/i);
        if (h) { cur = /^image$/i.test(h[1]) ? "image" : /^r/i.test(h[1]) ? null : "video"; if (cur) x[cur] = h[2]; }
        else if (cur && line.trim()) x[cur] += "\n" + line;
      });
      if (x.image || x.video) out.push({ image: (x.image || "").trim() || null, video: (x.video || "").trim() || null });
    });
    return out;
  },
  // Journée renvoyée : les blocs du LOT d'un document remplacent, dans l'ordre, les prompts des cartes EXISTANTES indiquées
  // (aucune carte créée ; les prompts ne passent pas par le modèle, donc aucune réplique reformulée)
  applyLotToCards: function (name, cartes) {
    var q = String(name || "").toLowerCase(), docs = this.project().docs || [];
    var d = docs.find(function (x) { return x.name.toLowerCase() === q; }) || docs.find(function (x) { return x.name.toLowerCase().indexOf(q) !== -1; });
    if (!d) throw { display: "Document « " + name + " » introuvable." };
    var blocs = this.parseLot(d.content), nums = (cartes || []).map(Number).filter(function (n) { return n > 0; });
    if (!blocs.length) throw { display: "Aucun bloc « 01 — … / IMAGE : / VIDÉO : » dans « " + d.name + " »." };
    if (nums.length !== blocs.length) throw { display: "Le LOT de « " + d.name + " » a " + blocs.length + " bloc(s) mais " + nums.length + " carte(s) indiquée(s) : donne un numéro de carte par bloc (get_storyboard)." };
    var out = this.applyPlans(blocs.map(function (b, i) { return { plan: nums[i], image: b.image, video: b.video }; }));
    if (this.cardNotesOf(d.content).length) out += " " + this.applyCardNotes(d.name, nums);
    return out;
  },
  // 29/09 — sections « ### Carte NN » d'un livrable marketing : réplique, montage, carton de fin, publication, description, hashtags
  cardNotesOf: function (content) {
    var t = String(content || "").replace(/\r/g, ""), out = [];
    t.split(/\n(?=###\s+Carte\s+\d+)/).forEach(function (b) {
      if (!/^###\s+Carte\s+\d+/.test(b)) return;
      out.push(b.split(/\n(?=##\s)/)[0].replace(/^###\s+/, "").trim());
    });
    return out;
  },
  applyCardNotes: function (name, cartes) {
    var q = String(name || "").toLowerCase(), docs = this.project().docs || [];
    var d = docs.find(function (x) { return x.name.toLowerCase() === q; }) || docs.find(function (x) { return x.name.toLowerCase().indexOf(q) !== -1; });
    if (!d) throw { display: "Document « " + name + " » introuvable." };
    var notes = this.cardNotesOf(d.content), nums = (cartes || []).map(Number).filter(function (n) { return n > 0; });
    if (!notes.length) throw { display: "Aucune section « ### Carte NN » dans « " + d.name + " »." };
    var A = window.AgnesApp, p = this.core.getProject(), shots = A.sortedShots(p), done = [];
    nums.forEach(function (n, i) { var s = shots[n - 1]; if (s && notes[i]) { s.notes = notes[i] + "\n\n(source : " + d.name + ")"; done.push(n); } });
    if (!done.length) throw { display: "Aucune carte trouvée parmi " + nums.join(", ") + "." };
    this.core.saveProject(); if (A.renderShots) A.renderShots();
    return "Notes (réplique, carton de fin, description, hashtags) recopiées sur les cartes " + done.map(function (n) { return "#" + n; }).join(", ") + " : « Plus d'options → Notes ».";
  },
  fichePreview: function (slug) {
    return this.marketingCall("GET", "/marketing/fiche?fiche=" + encodeURIComponent(slug || "")).then(function (f) {
      return "Fiche « " + f.titre + " » (" + f.fiche + ") — statut " + f.statut + (f.peut_valider ? "" : " — BLOQUÉE par le garde-fou") + "\n" +
        (f.resume ? f.resume + "\n" : "") + "\nNOTIONS (ce qu'Anthony pourra dire) :\n" +
        f.notions.map(function (n, i) { return (i + 1) + ". " + n.label + " — problème : " + n.probleme + " → solution : " + n.solution + " → bénéfice : " + n.benefice + (n.mode === "decryptage" ? " [décryptage]" : ""); }).join("\n") +
        (f.blocages.length ? "\n\nBLOCAGES :\n- " + f.blocages.join("\n- ") : "") +
        (f.sources.length ? "\n\nSOURCES :\n- " + f.sources.join("\n- ") : "") +
        "\n\nFICHIER :\n`" + f.fichier + "`\n\nCOMMANDE (terminal) pour valider :\n```bash\n" + f.commandes.valider + "\n```\npour rejeter :\n```bash\n" + f.commandes.rejeter + "\n```";
    });
  },
  // Écrit les prompts dans les cartes (numéros du Storyboard) ; les mentions @[Nom] cochent les références
  applyPlans: function (plans) {
    var A = window.AgnesApp, p = this.core.getProject(), shots = A.sortedShots(p), done = [], miss = [];
    (plans || []).forEach(function (x) {
      var s = shots[(+x.plan || 0) - 1]; if (!s) { miss.push(x.plan); return; }
      var img = x.image != null ? x.image : x.image_prompt, vid = x.video != null ? x.video : x.video_prompt;
      if (A.modeKind(s.mode) === "image") { if (img) s.prompt = img; }
      else {
        if (vid) s.prompt = vid;
        if (img) { if (s.mode === "t2v") s.imagePrompt = img; else if (!vid) s.prompt = img; }
      }
      if (A.syncMentions) A.syncMentions(s, p);
      done.push(x.plan);
    });
    if (!done.length) throw { display: "Aucune carte mise à jour" + (miss.length ? " (plans inexistants : " + miss.join(", ") + ")" : "") + "." };
    this.core.saveProject(); A.renderShots();
    return "Prompts écrits dans " + done.length + " carte(s) du Storyboard : " + done.join(", ") + (miss.length ? " — plans inexistants : " + miss.join(", ") : "") + ". Références mentionnées cochées.";
  },
  // Nouvel agent créé par le chef : identifiant et numéro libres
  createAgent: function (a) {
    var self = this, ids = this.agents.map(function (x) { return x.id; });
    if (!a || !String(a.name || "").trim() || !String(a.instructions || "").trim()) throw { display: "Il faut au moins un nom et des consignes." };
    var num = this.agents.reduce(function (m, x) { return Math.max(m, +x.num || 0); }, 0) + 1;
    var ag = { id: "c" + window.AgnesApp.uid().slice(0, 8), num: String(num), name: String(a.name).trim(), desc: String(a.desc || "").trim(),
      instructions: String(a.instructions).trim(), inputs: (a.inputs || []).filter(function (x) { return ids.indexOf(x) !== -1; }),
      context: (a.context || []).filter(function (x) { return ["bible", "library", "skills", "storyboard"].indexOf(x) !== -1; }),
      dest: self.DESTS[a.dest] ? a.dest : "none", created: true };
    this.agents.push(ag); this.saveAgents(); this.renderAll();
    return "Agent créé : " + ag.id + " — " + ag.num + ". " + ag.name + ". Il est dans la liste de l'équipe, modifiable comme les autres.";
  },
  outputOf: function (id) { var st = this.project(); return st && st.outputs[id] && st.outputs[id].text || ""; },

  buildUserMessage: function (a, request) {
    var self = this, parts = [];
    (a.inputs || []).forEach(function (id) {
      var src = self.agent(id), t = self.outputOf(id);
      parts.push("### ENTRÉE — " + (src ? src.num + ". " + src.name : id) + "\n" + (t || "(pas encore produite)"));
    });
    if ((a.context || []).indexOf("bible") !== -1) parts.push("### BIBLE DE L'APP (fiches existantes)\n" + this.bibleText());
    if ((a.context || []).indexOf("library") !== -1) parts.push("### NOMS DANS LA BIBLIOTHÈQUE (à utiliser tels quels dans RÉF :)\n" + this.libraryText());
    if ((a.context || []).indexOf("storyboard") !== -1) parts.push("### STORYBOARD ACTUEL (numéros des cartes)\n" + this.storyboardText());
    if ((a.context || []).indexOf("skills") !== -1) parts.push("### SKILLS DE L'APP (facultatif)\nTu peux ajouter à chaque bloc une ligne « SKILLS : » avec 1 à 3 noms EXACTS de cette liste (position, style, cadrage, mouvement…), séparés par des virgules. L'app ajoute alors leur texte au prompt : ne le répète pas dans IMAGE ni VIDÉO.\n" + this.skillsText());
    var docs = this.docsFor(a.id);
    if (docs) parts.push(docs);
    parts.push("### DEMANDE\n" + (request || "Fais ton travail à partir des entrées ci-dessus."));
    return parts.join("\n\n");
  },
  runAgent: function (id, request) {
    var self = this, a = this.agent(id), st = this.project();
    if (!a) return Promise.reject({ display: "Agent inconnu : " + id });
    var messages = [{ role: "system", content: a.instructions + "\n\n" + this.common() }, { role: "user", content: this.buildUserMessage(a, request) }];
    var extra = {};
    if (a.model) extra.model = a.model;
    if (a.temperature != null && a.temperature !== "") extra.temperature = Number(a.temperature);
    if (a.maxTokens) extra.max_tokens = Number(a.maxTokens);
    a._running = true; this.renderAll();
    return this.chat(messages, extra).then(function (m) {
      st.outputs[id] = { text: String(m.content || "").trim(), at: Date.now(), request: request || "" };
      self.core.saveProject(); return st.outputs[id].text;
    }).finally(function () { a._running = false; self.renderAll(); });
  },

  // =========================================================
  // RANGEMENT DANS L'APP
  // =========================================================
  bibleUpsert: function (entries, style) {
    var B = window.AgnesPlugins && AgnesPlugins.get("bible");
    if (!B || !B.ensureEntries) throw { display: "Activez l'extension Bible de continuité (⚙) pour ranger personnages et lieux." };
    var proj = this.core.getProject(), done = [];
    B.ensureEntries([], "personnage");
    var s = B.series();
    if (style) { s.style = String(style).trim(); done.push("style commun de la série"); }
    (entries || []).forEach(function (x) {
      if (!x || !x.name) return;
      var kind = /lieu|d[ée]cor|place|location/i.test(x.kind || "") ? "lieu" : /objet|accessoire|prop/i.test(x.kind || "") ? "objet" : /costume|look/i.test(x.kind || "") ? "costume" : "personnage";
      var nouveau = !B.series().entries.some(function (y) { return y.name.toLowerCase() === String(x.name).trim().toLowerCase(); });
      var e = B.addEntry(String(x.name).trim(), kind);
      // 02/10 — une tenue ou un lieu NOUVEAU ne s'ajoute pas tout seul aux prompts qui citent son nom (« Café », « Studio »…) :
      // il s'applique quand sa référence est cochée sur la carte (tenue du jour, lieu de la scène). Les fiches existantes
      // gardent leur réglage ; « auto » explicite l'emporte.
      if (x.auto !== undefined) e.auto = !!x.auto; else if (nouveau && (kind === "costume" || kind === "lieu")) e.auto = false;
      if (x.dna) e.dna = String(x.dna).trim();
      if (x.aliases) e.aliases = String(x.aliases).trim();
      if (x.episode_note) { e.byProject = e.byProject || {}; e.byProject[proj.id] = String(x.episode_note).trim(); }
      done.push(e.name);
    });
    B.persist();
    return done.length ? "Bible mise à jour : " + done.join(", ") + "." : "Rien à ranger.";
  },
  // 01/10 — Studio : image validée d'une fiche → fiche de la Bible + Bibliothèque (outil bible_attacher_image, avec autorisation)
  avatarNom: function (id) {
    var V = window.AgnesPlugins && AgnesPlugins.isLoaded && AgnesPlugins.isLoaded("avatar") ? AgnesPlugins.get("avatar") : null, f = V && V.fiche ? V.fiche(id) : null;
    return f ? f.nom : "";
  },
  bibleAttacherImage: function (fiche, nom) {
    var P = window.AgnesPlugins, V = P && P.isLoaded && P.isLoaded("avatar") ? P.get("avatar") : null, B = P && P.isLoaded && P.isLoaded("bible") ? P.get("bible") : null;
    if (!V) throw { display: "Activez l'extension Studio (⚙ → Extensions)." };
    if (!B || !B.attacherImage) throw { display: "Activez l'extension Bible de continuité (⚙) pour rattacher l'image." };
    var f = V.fiche(fiche); if (!f) throw { display: "Fiche « " + fiche + " » introuvable dans le Studio." };
    return V.imageValidee(fiche).then(function (blob) {
      if (!blob) throw { display: "La fiche « " + f.nom + " » n'a pas d'image validée : l'utilisatrice doit en valider une dans le Studio." };
      return B.attacherImage(nom || f.nom, blob);
    }).then(function (e) { return "Image de « " + f.nom + " » rattachée à la fiche « " + e.name + " » de la Bible et rangée dans la Bibliothèque."; });
  },
  toScenario: function (text) {
    var S = window.AgnesPlugins && AgnesPlugins.get("scenario"), ta = document.getElementById("scText");
    if (!S || !ta) throw { display: "Activez l'extension Import de scénario (⚙)." };
    ta.value = text; window.AgnesApp.showView("view_scenario");
    var btn = document.getElementById("scParse"); if (btn) btn.click();
    return "Scénario placé dans l'onglet Scénario et analysé : vérifiez l'aperçu puis « Créer les plans ».";
  },
  toLot: function (script) {
    var ta = document.getElementById("batchScript"), op = document.getElementById("batchOp");
    if (!ta || !op) throw { display: "Onglet Le lot introuvable." };
    op.value = "script"; op.dispatchEvent(new Event("change"));
    ta.value = script; ta.dispatchEvent(new Event("input"));
    window.AgnesApp.showView("viewBatch");
    return "Script placé dans Le lot (mode Script numéroté) : vérifiez la liste, les références, puis « Créer les plans ».";
  },
  toPublication: function (f) {
    var p = this.core.getProject();
    if (!p.publish) p.publish = { serie: p.name, ep: 1, titre: "", hook: "", resume: "", tags: "", cta: "", date: "", texts: {}, cover: {} };
    var map = { serie: "serie", episode: "ep", titre: "titre", accroche: "hook", resume: "resume", hashtags: "tags", appel: "cta" }, done = [];
    Object.keys(map).forEach(function (k) { if (f[k] != null && f[k] !== "") { p.publish[map[k]] = k === "episode" ? Number(f[k]) || 1 : String(f[k]).trim(); done.push(k); } });
    this.core.saveProject();
    return done.length ? "Fiche Publication remplie (" + done.join(", ") + ")." : "Aucun champ à remplir.";
  },
  // Lecture de la fiche « FICHE PUBLICATION » écrite par le Community Manager
  parsePublication: function (text) {
    var f = {}, m = String(text).split(/FICHE PUBLICATION/i)[1] || text;
    [["titre", /^\s*titre\s*:\s*(.+)$/im], ["accroche", /^\s*accroche\s*:\s*(.+)$/im], ["resume", /^\s*r[ée]sum[ée]\s*:\s*(.+)$/im],
      ["hashtags", /^\s*hashtags?\s*:\s*(.+)$/im], ["appel", /^\s*appel [àa] l'action\s*:\s*(.+)$/im]].forEach(function (x) { var r = m.match(x[1]); if (r) f[x[0]] = r[1].replace(/\*\*/g, "").trim(); });
    return f;
  },
  // Extraction structurée (JSON) des fiches depuis un texte d'agent, pour la Bible
  extractBible: function (text) {
    var sys = "Extrais du texte les personnages, lieux et objets récurrents avec leur ADN visuel en anglais (description physique stable, sans émotion ni action). " +
      "Si le texte contient une ligne « STYLE COMMUN (anglais) : », recopie-la dans style. Réponds UNIQUEMENT en JSON : " +
      "{\"style\":\"…ou vide\",\"entries\":[{\"name\":\"…\",\"kind\":\"personnage|lieu|objet\",\"aliases\":\"…\",\"dna\":\"…\"}]}";
    var self = this, msgs = [{ role: "system", content: sys }, { role: "user", content: text.slice(0, 60000) }];
    return this.chat(msgs, { response_format: { type: "json_object" }, temperature: 0.1 })
      .catch(function (e) { if (e.status === 400) return self.chat(msgs, { temperature: 0.1 }); throw e; })
      .then(function (m) {
        var s = String(m.content || "").replace(/```json|```/g, "").trim(), j;
        var brace = s.indexOf("{"); if (brace > 0) s = s.slice(brace, s.lastIndexOf("}") + 1);
        try { j = JSON.parse(s); } catch (e) { throw { display: "Extraction illisible, réessayez." }; }
        return { style: j.style || "", entries: Array.isArray(j.entries) ? j.entries : [] };
      });
  },

  // =========================================================
  // CHEF DE PRODUCTION (appel d'outils + autorisation)
  // =========================================================
  TOOLS: [
    { type: "function", function: { name: "run_agent", description: "Lance un agent de l'équipe et enregistre son travail. Nécessite l'autorisation de l'utilisateur (sauf réglage contraire).",
      parameters: { type: "object", properties: { agent_id: { type: "string", description: "Identifiant, ex. a1, a2… a15, a0" }, request: { type: "string", description: "Consigne précise pour cet agent (épisode visé, contraintes, idée de l'utilisateur)" } }, required: ["agent_id", "request"] } } },
    { type: "function", function: { name: "get_output", description: "Lit le travail complet déjà produit par un agent (lecture seule, sans autorisation).",
      parameters: { type: "object", properties: { agent_id: { type: "string" } }, required: ["agent_id"] } } },
    { type: "function", function: { name: "get_document", description: "Lit un document fourni par l'utilisateur (lecture seule, sans autorisation).",
      parameters: { type: "object", properties: { name: { type: "string", description: "Nom du document, tel qu'il apparaît dans la liste" } }, required: ["name"] } } },
    { type: "function", function: { name: "bible_upsert", description: "Crée ou met à jour des fiches de la Bible de l'app (personnages, lieux, objets) avec leur ADN visuel en anglais, et éventuellement le style commun de la série. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { series_style: { type: "string", description: "Style visuel commun en anglais (facultatif)" },
        entries: { type: "array", items: { type: "object", properties: { name: { type: "string" }, kind: { type: "string", enum: ["personnage", "lieu", "objet", "costume"] }, aliases: { type: "string" }, dna: { type: "string", description: "ADN visuel en anglais" }, episode_note: { type: "string", description: "Changement propre à cet épisode (facultatif)" }, auto: { type: "boolean", description: "ajouter l'ADN quand le nom est cité dans un prompt (défaut : oui pour un personnage, non pour une nouvelle tenue ou un nouveau lieu)" } }, required: ["name", "kind"] } } } } } },
    { type: "function", function: { name: "bible_attacher_image", description: "Studio : rattache l'image VALIDÉE d'une fiche de l'onglet Studio (identifiant av…) à la fiche de la Bible du même nom, et la range dans la Bibliothèque de l'épisode. À appeler après bible_upsert, quand le document « Studio — … » indique une image validée. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { fiche: { type: "string", description: "Identifiant de la fiche Studio (av…), indiqué dans le document" }, nom: { type: "string", description: "Nom de la fiche de la Bible à laquelle rattacher l'image" } }, required: ["fiche", "nom"] } } },
    { type: "function", function: { name: "send_to_scenario", description: "Place un scénario (format INT./EXT., NOM en majuscules, répliques) dans l'onglet Scénario et lance l'analyse. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
    { type: "function", function: { name: "send_to_lot", description: "Place un script numéroté (01 — libellé / IMAGE : / VIDÉO : / RÉF :) dans Le lot pour créer les cartes du Storyboard. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { script: { type: "string" } }, required: ["script"] } } },
    { type: "function", function: { name: "get_storyboard", description: "Lit les cartes du Storyboard : numéro, mode, format, prompts actuels, références et skills cochés (lecture seule, sans autorisation).",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "update_shots", description: "Écrit les prompts dans les cartes du Storyboard. Le plus sûr : agent_id = l'agent qui a produit des blocs « PLAN n / IMAGE : / VIDÉO : » (ex. a16), appliqués tels quels. Journée ou lot RENVOYÉ dont les cartes existent déjà : document + cartes (blocs 01, 02… du LOT du document appliqués tels quels aux cartes indiquées, dans l'ordre, sans en créer). Sinon plans = liste explicite. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { agent_id: { type: "string", description: "Agent dont le travail contient les blocs PLAN (ex. a16)" },
        document: { type: "string", description: "Nom du document dont le LOT (blocs « 01 — … / IMAGE : / VIDÉO : ») remplace les prompts des cartes existantes" },
        cartes: { type: "array", items: { type: "number" }, description: "Numéros des cartes existantes à mettre à jour, dans l'ordre des blocs du LOT (ex. [4, 5, 6])" },
        plans: { type: "array", items: { type: "object", properties: { plan: { type: "number", description: "Numéro de la carte (#N)" }, image_prompt: { type: "string" }, video_prompt: { type: "string" } }, required: ["plan"] } } } } } },
    { type: "function", function: { name: "create_agent", description: "Crée un nouvel agent dans l'équipe quand aucun agent existant ne convient. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { name: { type: "string" }, desc: { type: "string", description: "Rôle en une phrase" },
        instructions: { type: "string", description: "Consignes complètes : rôle, méthode, format de sortie exact" },
        inputs: { type: "array", items: { type: "string" }, description: "Identifiants des agents dont il lit le travail (ex. a3, a5)" },
        context: { type: "array", items: { type: "string", enum: ["bible", "library", "skills", "storyboard"] } },
        dest: { type: "string", enum: ["none", "bible-serie", "bible-perso", "scenario", "lot", "publication", "storyboard"] } }, required: ["name", "desc", "instructions"] } } },
    { type: "function", function: { name: "set_publication", description: "Remplit la fiche de l'onglet Publication. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { serie: { type: "string" }, episode: { type: "number" }, titre: { type: "string" }, accroche: { type: "string" }, resume: { type: "string" }, hashtags: { type: "string" }, appel: { type: "string" } } } } },
    { type: "function", function: { name: "generate_shots", description: "Lance la génération de cartes du Storyboard (image ou vidéo) avec les moteurs réglés dans ⚙ → Moteurs. Consomme des quotas : numéros exacts (get_storyboard), une carte d'abord pour un nouveau style. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { plans: { type: "array", items: { type: "number" }, description: "Numéros des cartes (#N du Storyboard)" },
        etape: { type: "string", enum: ["image", "video", "auto"], description: "image : image de départ ; video : animer l'image validée ; auto : selon la carte" } }, required: ["plans", "etape"] } } },
    { type: "function", function: { name: "marketing_state", description: "Agent Marketing (vidéos d'avatar pour les réseaux, via le pont local) : fiches méthodes disponibles (AIDA, PAS…), prochaines vidéos, veille non utilisée, journées préparées, identité de l'avatar à compléter. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "marketing_veille", description: "Agent Marketing : veille internet (actualités avatar IA, vidéo courte, marketing) ; renvoie les pistes avec leur numéro. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { max: { type: "number", description: "Articles lus par flux (facultatif)" } } } } },
    { type: "function", function: { name: "marketing_generate_day", description: "Agent Marketing : prépare une journée de 3 vidéos d'avatar de 10 s (éducative, problème-solution, démonstration), validées, et ajoute le livrable « Marketing — date » aux documents de l'Atelier. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { methode: { type: "string", description: "Fiche méthode du jour choisie par l'utilisateur : identifiant donné par marketing_state (ex. aida, pas, avant-apres, conseil-express)" },
        date: { type: "string", description: "AAAA-MM-JJ (défaut : aujourd'hui)" }, topic: { type: "string" }, audience: { type: "string" }, offer: { type: "string" }, objective: { type: "string" },
        trend: { type: "number", description: "Numéro d'une piste de veille (facultatif)" }, pillar: { type: "string" }, cluster: { type: "string" }, environment: { type: "string" },
        garder: { type: "string", description: "Journée RÉÉCRITE en partie : vidéos déjà publiées à garder telles quelles (educatif, probleme_solution, demonstration ou matin, midi, soir, séparées par des virgules). Les autres sont réécrites avec le procédé actuel, même sujet et même méthode." },
        notions: { type: "string", description: "Notion imposée par créneau, ex. « midi=mot_peut_etre, soir=mot_imaginez » (série AIDA : une lettre par vidéo). Notions : marketing_fiche." },
        suite_demain: { type: "boolean", description: "La série continue le lendemain : carton du soir « La suite demain à 8 h »." },
        appel: { type: "string", enum: ["carton", "parle"], description: "Appel à l'action du jour, choisi par l'utilisatrice : « carton » (affiché sur le carton de fin, Anthony ne le dit pas) ou « parle » (Anthony le dit en dernier dans la vidéo). Ne rien mettre = réglage habituel de l'agent." } } } } },
    { type: "function", function: { name: "marketing_get_day", description: "Agent Marketing : (re)met le livrable d'une journée déjà préparée dans les documents de l'Atelier. Sans autorisation.",
      parameters: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } } },
    { type: "function", function: { name: "marketing_validate", description: "Agent Marketing : revalide les 3 vidéos d'une journée (durée, CTA, doublons…). Lecture et contrôle, sans autorisation.",
      parameters: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } } },
    { type: "function", function: { name: "marketing_ressources", description: "Agent Marketing : formations enregistrées sur l'ordinateur (ressources locales), statut de leur fiche, vidéos disponibles ; « à transcrire » = trop peu de texte mais des vidéos. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: { seulement_a_transcrire: { type: "boolean" } } } } },
    { type: "function", function: { name: "transcrire_ressource", description: "Transcrit la vidéo n°i d'une formation avec l'extension Extraire (Whisper), puis l'agent Marketing CONTRÔLE la sortie (orthographe, mots mal entendus, noms propres ; version brute gardée) et l'ajoute à la fiche. Le texte contrôlé est aussi rangé dans les documents de l'Atelier. Nécessite l'autorisation et l'extension Extraire.",
      parameters: { type: "object", properties: { fiche: { type: "string", description: "identifiant de la formation (marketing_ressources)" }, video: { type: "number", description: "numéro i de la vidéo (0 = première)" } }, required: ["fiche"] } } },
    { type: "function", function: { name: "marketing_recherche_sujet", description: "Agent Marketing : cherche sur internet un sujet absent des ressources locales et de la veille (recherche web de Codex, Hacker News, Reddit ; pages hors sujet écartées), crée la fiche « web-… » et en extrait les notions. La fiche reste « à valider » par l'utilisatrice. Prend 1 à 3 minutes. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { sujet: { type: "string" }, forums: { type: "boolean", description: "inclure Hacker News et Reddit (témoignages) ; défaut oui" } }, required: ["sujet"] } } },
    { type: "function", function: { name: "mesurer_replique", description: "Mesure une ou plusieurs répliques (une par ligne, « NOM : texte » accepté) avec le Calculateur de répliques : caractères espaces compris, mots, durée estimée, et combien de caractères ajouter ou retirer pour tenir le réglage (anthony = TikTok 10 s, serie, court, voixoff, ou un réglage de l'utilisateur). À utiliser AVANT de proposer ou valider une réplique. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: { texte: { type: "string" }, reglage: { type: "string", description: "vide = réglage du projet (selon son style) ; sinon anthony, serie, court, voixoff, ou l'identifiant d'un réglage de l'utilisateur" } }, required: ["texte"] } } },
    { type: "function", function: { name: "set_replique", description: "Remplace la réplique entre guillemets (« … ») du prompt d'une carte du Storyboard par une nouvelle version, sans toucher au reste du prompt. Mesure-la d'abord avec mesurer_replique. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { carte: { type: "number", description: "Numéro de la carte (#N)" }, replique: { type: "string", description: "Nouvelle réplique, sans guillemets" }, index: { type: "number", description: "N-ième réplique du prompt (1 par défaut)" } }, required: ["carte", "replique"] } } },
    { type: "function", function: { name: "marketing_fiches", description: "Agent Marketing : liste des fiches connaissances (statut, notions, blocages) avec l'ADRESSE de chaque fichier sur l'ordinateur et celle du dossier. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "marketing_fiche", description: "Agent Marketing : une fiche connaissance en clair (notions : problème → solution → bénéfice, blocages du garde-fou, sources), son ADRESSE et les COMMANDES terminal (montrer, valider, rejeter). Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: { fiche: { type: "string" } }, required: ["fiche"] } } },
    { type: "function", function: { name: "marketing_decider_fiche", description: "Valide ou rejette une fiche connaissance. L'utilisatrice voit les notions dans la demande d'autorisation : SON clic « Autoriser » est sa décision. Ne l'utilise que si elle a demandé de valider ou rejeter cette fiche. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { fiche: { type: "string" }, decision: { type: "string", enum: ["valider", "rejeter"] } }, required: ["fiche", "decision"] } } },
    { type: "function", function: { name: "marketing_notes_cartes", description: "Recopie sur les cartes du Storyboard la fiche de chaque vidéo d'un document « Marketing — date » (réplique, montage, CARTON DE FIN, publication, description, hashtags), dans « Notes » de la carte. Les prompts ne changent pas. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { document: { type: "string" }, cartes: { type: "array", items: { type: "number" }, description: "Numéros des cartes, dans l'ordre des vidéos 01, 02, 03" } }, required: ["document", "cartes"] } } },
    { type: "function", function: { name: "marketing_extraire_fiche", description: "Agent Marketing : extrait les notions d'une formation (documents + transcriptions). La fiche passe « à valider » : seule l'utilisatrice la valide. Refusé si la fiche a déjà des notions, sauf ecraser (copie gardée). Nécessite l'autorisation.",
      parameters: { type: "object", properties: { fiche: { type: "string" }, ecraser: { type: "boolean" } }, required: ["fiche"] } } },
    // Montage (01/10, étape 5) : mêmes fonctions que les boutons de l'extension Montage (si elle est active)
    { type: "function", function: { name: "montage_etat", description: "Montage : état du montage des cartes (vidéo classée ou non, texte du carton, appel de fin, voix-off prête ou non, pauses resserrées, sous-titres karaoké, vidéo finale déjà faite), modèle et réglages du projet. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "montage_modeles", description: "Montage : modèles de montage et de carton enregistrés (favoris en tête) et ceux du projet. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "monter_cartes", description: "Montage : fabrique la vidéo finale de cartes (voix au maximum, vitesse, carton, sous-titres karaoké, pauses resserrées), dans le dossier Final de la journée. Ne génère aucune voix-off : une carte « Carton + voix-off » sans voix-off est refusée (l'utilisatrice la fait d'un clic). À utiliser seulement quand l'utilisatrice demande le montage. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { cartes: { type: "array", items: { type: "number" }, description: "Numéros des cartes (#N) ; vide = toutes les cartes classées" },
        modele: { type: "string", description: "Nom d'un modèle de montage ou de carton à appliquer d'abord au projet (montage_modeles)" },
        resserrer: { type: "boolean", description: "Resserrer les pauses sur ces cartes" }, karaoke: { type: "boolean", description: "Sous-titres karaoké sur ces cartes" },
        appel: { type: "string", enum: ["carton", "voixoff", "aucun"], description: "Appel de fin de ces cartes : carton, carton + voix-off (voix-off déjà faite), ou pas de carton" } } } } },
    { type: "function", function: { name: "compiler_finales", description: "Montage : met bout à bout les vidéos finales de cartes déjà montées (ordre du storyboard), avec coupe franche, fondu enchaîné ou fondu au noir ; sous-titres .srt recalés ; sortie dans Final. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { cartes: { type: "array", items: { type: "number" }, description: "Numéros des cartes ; vide = toutes les cartes montées" },
        transition: { type: "string", enum: ["cut", "fondu", "noir"] }, duree_transition: { type: "number", description: "secondes (0,2 à 1,5)" }, nom: { type: "string", description: "nom du fichier, facultatif" } } } } },
    { type: "function", function: { name: "rendre_episode", description: "Montage : rend l'épisode de série à partir des plans cochés de l'Assemblage (ordre, début/fin, images fixes, transitions par plan, étalonnage, cartons de l'extension Épisodes), son réglé une seule fois sur tout l'épisode, sous-titres karaoké et carton de fin au choix ; sortie dans Final. Les voix attachées et la musique de l'onglet Son ne sont pas reprises. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { lufs: { type: "number", enum: [-14, -16, -23], description: "-14 réseaux, -16 plateformes, -23 télévision" },
        karaoke: { type: "boolean" }, carton: { type: "string", description: "texte du carton de fin (vide = pas de carton)" }, sous_texte: { type: "string" }, nom: { type: "string" } } } } },
    // 02/10 — Studio (fiches d'avatar, tenue, lieu, objet), Styles de prompt, Classement
    { type: "function", function: { name: "studio_fiches", description: "Studio : liste des fiches (avatar, personnage, tenue, lieu, objet) avec identifiant, nom, collection, image validée, envoyée ou non. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: { type: { type: "string", enum: ["avatar", "personnage", "tenue", "lieu", "objet"], description: "facultatif : un seul type" } } } } },
    { type: "function", function: { name: "studio_fiche", description: "Studio : une fiche complète (ADN anglais, prompt d'aperçu, liens, combinaisons). Lecture seule, sans autorisation. La Bible reste à toi : recopie l'ADN tel quel avec bible_upsert.",
      parameters: { type: "object", properties: { fiche: { type: "string", description: "identifiant av… ou nom de la fiche" } }, required: ["fiche"] } } },
    { type: "function", function: { name: "style_projet", description: "Style des prompts du projet (onglet Projet) : règles ajoutées aux prompts, textes écrits permis ou non, musique, réglage du compteur de répliques, et liste des styles. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "choisir_style", description: "Choisit le style des prompts du projet (ex. « Série réaliste », « Cartoon / satire », « Réaliste — Marketing (avatar) »). Le compteur de répliques suit le style. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { style: { type: "string", description: "nom ou identifiant du style" } }, required: ["style"] } } },
    { type: "function", function: { name: "classer_cartes", description: "Classement : copie l'image, la vidéo et la fiche des cartes dans Production\\<Thématique>\\… sur l'ordinateur (via le pont), comme le bouton Classer en mode local. Rien n'est supprimé d'Agnes. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { cartes: { type: "array", items: { type: "number" }, description: "numéros des cartes ; vide = toutes" }, thematique: { type: "string", description: "Serie, Film, Marketing, Court_metrage… (vide = celle du projet)" },
        nom: { type: "string", description: "série / campagne / titre (vide = celui du projet)" }, episode: { type: "number" }, date: { type: "string", description: "AAAAMMJJ (marketing)" }, sujet: { type: "string" } } } } },
    // 02/10 — Voix, Son, Étalonnage, AutoCaption
    { type: "function", function: { name: "voix_etat", description: "Voix (onglet Voix) : pour chaque carte, texte de la voix (dialogue ou voix-off), voix générée ou non. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "voix_generer", description: "Voix : génère la voix des cartes (ElevenLabs / OpenAI de l'onglet Voix, PAYANT) et l'attache à la carte. Texte : celui donné, sinon celui déjà écrit dans l'onglet Voix. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { cartes: { type: "array", items: { type: "number" } }, texte: { type: "string", description: "facultatif, une seule carte : « NOM : réplique » par ligne, ou voix-off" } }, required: ["cartes"] } } },
    { type: "function", function: { name: "son_pistes", description: "Son (onglet Son) : pistes de musique, d'ambiance et de bruitage du projet. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "son_generer", description: "Son : génère une musique, une ambiance ou un bruitage (ElevenLabs, PAYANT) et l'ajoute aux pistes de l'onglet Son. Respecte le style du projet (pas de musique s'il l'interdit, sauf demande explicite). Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { type: { type: "string", enum: ["musique", "ambiance", "bruitage"] }, prompt: { type: "string", description: "description en anglais" }, duree: { type: "number", description: "secondes (musique 10 à 300, autres 0,5 à 30)" }, instrumental: { type: "boolean" }, nom: { type: "string" } }, required: ["type", "prompt", "duree"] } } },
    { type: "function", function: { name: "etalonnage_etat", description: "Étalonnage : look du projet (préréglage, actif ou non) et préréglages disponibles. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "etalonnage_regler", description: "Étalonnage : choisit le préréglage du look et l'active ou non pour l'Assemblage et le kit FFmpeg. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { preset: { type: "string", description: "identifiant d'un préréglage (voir etalonnage_etat)" }, actif: { type: "boolean" } } } } },
    { type: "function", function: { name: "soustitres_modeles", description: "AutoCaption : modèles de sous-titres (favoris en tête) et modèle utilisé. Lecture seule, sans autorisation.",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "soustitres_appliquer", description: "AutoCaption : applique un modèle de sous-titres au projet. Seulement à la demande de l'utilisatrice. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { modele: { type: "string", description: "identifiant ou nom du modèle" } }, required: ["modele"] } } }
  ],
  // 01/10 — Style du projet (extension Styles de prompt) : null sans l'extension
  styleProjet: function () {
    var P = window.AgnesPlugins, S = P && P.isLoaded && P.isLoaded("styles") ? P.get("styles") : null;
    return S && S.courant ? S.courant(this.core.getProject()) : null;
  },
  // Consignes communes des agents, adaptées au style du projet : textes écrits, musique et jeu ne sont plus imposés à tous
  // les projets (règles d'Anthony) ; sans l'extension Styles, COMMON d'origine mot pour mot
  common: function () {
    var ST = this.styleProjet(), c = this.COMMON;
    if (!ST) return c;
    var txt = "Pas de sous-titres dans les prompts. " +
      (ST.texteEcran ? "Textes écrits dans l'image (tasse, écran, panneau, bouton) permis : en MAJUSCULES entre apostrophes droites après reads ou labeled, par exemple a mug that reads 'TOUT VA BIEN' ; jamais entre « » (réservés aux répliques). "
        : "Aucun texte écrit dans l'image. ") +
      (ST.musique ? "Musique, jingles et bruitages permis : décrits en anglais, sans guillemets (a loud bell DING sound). "
        : "Pas de musique (dialogues, musique et titres sont gérés à part). ");
    c = c.replace("Pas de texte, sous-titres ni musique dans les prompts d'image ou de vidéo (dialogues, musique et titres sont gérés à part). ", txt);
    c = c.replace("Jeu humain et subtil ; celui qui parle regarde son interlocuteur. ",
      /subtle/i.test(ST.video || "") ? "Jeu humain et subtil ; celui qui parle regarde son interlocuteur. "
        : "Jeu d'acteur selon le style du projet" + (ST.video ? " (" + ST.video + ")" : "") + " ; celui qui parle regarde son interlocuteur. ");
    return c + "\nSTYLE DU PROJET : « " + ST.nom + " »" + (ST.note ? " — " + String(ST.note).replace(/[.\s]+$/, "") : "") + ". L'app ajoute elle-même ses règles à chaque prompt : ne les recopie pas.";
  },
  managerSystem: function () {
    var self = this, st = this.project();
    var team = this.ordered().map(function (a) {
      var o = st.outputs[a.id];
      return a.id + " — " + a.num + ". " + a.name + " : " + a.desc + " | entrées : " + ((a.inputs || []).join(", ") || "idée de l'utilisateur") +
        " | destination : " + (self.DESTS[a.dest] || "—") + " | état : " + (o && o.text ? "fait (" + o.text.length + " car." + (o.ok ? ", validé" : "") + ")" : "à faire");
    }).join("\n");
    var p = this.core.getProject();
    return "Tu es le CHEF DE PRODUCTION d'Agnes Studio Pro. Tu coordonnes une équipe d'agents d'écriture et tu fais le lien avec l'app. " +
      "Tu parles français, brièvement, comme un directeur de production : tu annonces ce que tu vas faire, pourquoi, puis tu le fais avec les outils.\n\n" +
      "CLARTÉ POUR L'UTILISATEUR (il ne programme pas)\n- Ne lui parle jamais en noms d'outils (marketing_fiche, update_shots…) : dis ce que tu fais en mots simples (« je lis la fiche », « je mets à jour les cartes 4 à 6 »).\n" +
      "- Donne toujours l'ADRESSE COMPLÈTE d'un fichier ou d'un dossier de l'ordinateur, entre accents graves : `D:\\dossier\\fiche.yaml` (elle devient cliquable et s'ouvre dans l'Explorateur).\n" +
      "- Quand une action se fait aussi dans un terminal, donne la commande prête à coller dans un bloc ```bash, avec le cd vers le bon dossier : un bouton Copier apparaît.\n" +
      "- Dans l'app, indique où cliquer (onglet → bouton).\n" +
      "- Répliques : avant de proposer, corriger ou valider une réplique (marketing, série, court métrage), mesure-la avec mesurer_replique et donne le nombre de caractères et la durée ; propose une version qui tient le réglage. Pour remplacer une réplique dans une carte, appelle directement set_replique : sa demande d'autorisation montre le texte exact, ne demande pas de confirmation par écrit avant.\n" +
      (function (ST) {   // 01/10 — style du projet (extension Styles de prompt)
        return ST ? "- STYLE DU PROJET : « " + ST.nom + " » (onglet Projet → Style des prompts) : textes écrits dans l'image " + (ST.texteEcran ? "permis" : "interdits") +
          ", musique " + (ST.musique ? "permise" : "interdite") + ", compteur de répliques « " + ST.repliques + " ». Mesure les répliques avec le réglage du projet (mesurer_replique sans reglage). " +
          "Dans les prompts : répliques entre « … » après un verbe de parole ; textes écrits entre apostrophes 'TOUT VA BIEN' après reads ou labeled ; bruitages sans guillemets.\n\n" : "\n";
      })(this.styleProjet()) +
      "RÈGLES\n- Tu n'écris pas toi-même le contenu créatif : tu le confies à l'agent compétent (run_agent), avec une consigne précise.\n" +
      "- Respecte l'ordre de la chaîne : un agent ne travaille que si ses entrées existent. Propose l'étape suivante logique.\n" +
      "- Pour ranger dans l'app, lis d'abord le travail (get_output), puis utilise l'outil de destination avec le contenu exact, sans le réécrire (sauf pour extraire les fiches de la Bible).\n" +
      "- Un document « Studio — … » vient de l'utilisatrice (onglet Studio) : lis-le avec get_document ; son ADN (anglais, une ligne) se recopie MOT POUR MOT dans bible_upsert, sans le réécrire. Toi seul écris la Bible. Les tenues et les lieux d'un avatar sont des entrées SÉPARÉES (costume, lieu) : la tenue du jour et le lieu de chaque scène se choisissent parmi elles. Si une image est validée, rattache-la avec bible_attacher_image (identifiant de fiche du document). Ne crée aucune carte : les cartes restent créées par l'utilisatrice ou par Claude.\n" +
      "- Studio : studio_fiches et studio_fiche te montrent les fiches (lecture seule) ; la tenue du jour et le lieu de chaque scène viennent des fiches liées à l'avatar. Style des prompts : style_projet (lecture) ; choisir_style seulement si l'utilisatrice le demande. Classement : classer_cartes copie les cartes terminées dans Production\\<Thématique>\\…, seulement à sa demande.\n" +
      "- Voix, Son, Étalonnage, Sous-titres : voix_etat, son_pistes, etalonnage_etat, soustitres_modeles (lecture) ; voix_generer et son_generer sont PAYANTS (ElevenLabs) : seulement à sa demande, en le disant ; etalonnage_regler et soustitres_appliquer seulement à sa demande. Épisodes (récap, cartons), Planning et Stills → Clip se font dans leur onglet : indique-lui où cliquer.\n" +
      "- Chaque action qui modifie l'app est soumise à l'autorisation de l'utilisateur : ne la présente jamais comme déjà faite avant le résultat de l'outil.\n" +
      "- Un seul épisode à la fois pour les étapes 5 à 15, sauf demande contraire.\n" +
      "- Quand l'utilisateur parle d'un document, lis-le avec get_document avant de décider. Pour qu'un agent le lise, il suffit qu'il soit destiné à cet agent ou à « tous » ; sinon cite l'essentiel dans la consigne de run_agent.\n" +
      "- Les messages « ▸ N. Agent a terminé » viennent d'appels directs de l'utilisateur (@N) : tiens-en compte.\n" +
      "- Prompts des cartes du Storyboard (« prompt parfait », placement des personnages, angle, voiture…) : confie-les à a16 (Directeur de plans) en précisant les numéros de cartes et la demande de l'utilisateur, puis applique son travail avec update_shots en donnant agent_id \"a16\" (sans recopier les prompts).\n" +
      "- Si aucun agent ne convient à la demande, propose d'en créer un avec create_agent (consignes complètes, format de sortie, entrées et contexte utiles), puis lance-le. N'en crée pas un qui double un agent existant.\n" +
      "- Générations (generate_shots) : annonce le nombre de cartes, l'étape et les moteurs (quotas) ; une carte d'abord pour un nouveau style ou personnage, fais valider, puis les autres ; vidéos seulement quand les images sont validées. Grok et Flow servent uniquement à la vidéo (Flow consomme les crédits Google) ; si Grok ou Flow est bloqué, arrête et préviens l'utilisateur.\n" +
      "- Vidéos d'avatar pour les réseaux (marketing) : utilise les outils marketing_* (agent Marketing branché par le pont local). Avant marketing_generate_day, si l'utilisateur n'a pas choisi la méthode du jour, lis marketing_state et demande-lui : « Qu'est-ce qu'on fait aujourd'hui : AIDA, PAS… ? » en citant les fiches actives. Dans la même question, demande l'appel à l'action du jour (au choix, jamais imposé) : « sur le carton » (Anthony ne le dit pas) ou « Anthony le dit » ; passe sa réponse dans « appel » (carton ou parle). marketing_generate_day dépose un document « Marketing — date » : lis-le avec get_document et suis ses CONSIGNES POUR LE CHEF dans l'ordre, une étape à la fois. Ne reformule jamais les répliques d'un livrable marketing. " +
      "Une journée peut être RENVOYÉE après réécriture (même nom de document) : la dernière version remplace entièrement la précédente. " +
      "Si les cartes de cette journée existent déjà dans le Storyboard (la consigne donne leurs numéros ; sinon get_storyboard), N'UTILISE PAS send_to_lot, qui créerait des cartes en double : " +
      "l'étape Le lot devient update_shots avec document (nom du document) et cartes (leurs numéros, dans l'ordre 01, 02, 03). Ne crée de nouvelles cartes qu'avec l'accord explicite de l'utilisateur. " +
      "Ressources locales (formations sur l'ordinateur) : marketing_ressources pour voir les formations « à transcrire », transcrire_ressource (une vidéo à la fois : Extraire → Whisper, puis contrôle de la sortie par l'agent Marketing), puis marketing_extraire_fiche ; ne valide jamais une fiche toi-même : c'est l'utilisateur qui valide. " +
      "Sujet absent des ressources et de la veille : marketing_recherche_sujet (internet, forums = témoignages, fiche à valider). " +
      "Montage (si l'extension Montage est active) : montage_etat pour voir où en sont les cartes ; monter_cartes, compiler_finales et rendre_episode (série : plans de l'Assemblage, son réglé sur tout l'épisode) seulement quand l'utilisatrice demande le montage ou la compilation ; tu ne génères jamais de voix-off : si une carte en attend une, dis-lui de cliquer « Faire la voix-off » dans Montage → Par carte. " +
      "Fiches à valider : quand l'utilisateur veut valider ou rejeter une fiche, lis-la (marketing_fiche), résume ses notions en clair, donne l'adresse du fichier et la commande, puis marketing_decider_fiche : il voit les notions dans l'autorisation et décide en cliquant. Ne le propose jamais sans sa demande. " +
      "Journée déjà publiée en partie mais écrite avec l'ancien procédé : marketing_generate_day avec la même date et garder (ex. « educatif »), puis update_shots document + cartes pour les cartes existantes. " +
      "Après la création des cartes d'une journée (ou update_shots document), marketing_notes_cartes recopie réplique, carton de fin, description et hashtags sur les cartes. " +
      "Avant chaque étape (Bible, Le lot, publication, générations), relis le document avec get_document et ne reprends JAMAIS un sujet, un lieu, " +
      "une tenue ou une réplique d'une version lue plus tôt dans la conversation ; en cas de doute, relis-le et cite le sujet et les lieux lus.\n\n" +
      "ÉQUIPE ET ÉTAT\n" + team + "\n\nAPP\nProjet : " + (p ? p.name : "?") + " · " + (p ? p.shots.length : 0) + " plan(s) dans le Storyboard\n" +
      "Bible :\n" + this.bibleText() + "\nBibliothèque :\n" + this.libraryText() +
      "\n\nDOCUMENTS FOURNIS PAR L'UTILISATEUR (lecture avec get_document ; ils sont aussi transmis automatiquement aux agents indiqués)\n" + this.docsIndex();
  },
  // Garde les ~40 derniers messages en coupant uniquement avant un message utilisateur (les appels d'outils restent appariés)
  trimmed: function (chat) {
    if (chat.length <= 40) return chat.slice();
    for (var i = chat.length - 40; i < chat.length; i++) if (chat[i].role === "user") return chat.slice(i);
    return chat.slice(-10);
  },
  // 30/09 — demande envoyée au Chef par une autre extension (ex. compteur de répliques d'une carte)
  ask: function (text) {
    if (this.busy) { this.core.toast("Le chef travaille déjà : réessayez dans un instant.", "err"); return false; }
    if (this.pending) { this.core.toast("Répondez d'abord à la demande d'autorisation en attente (Atelier IA).", "err"); return false; }
    var st = this.project(); st.chat.push({ role: "user", content: text }); this.core.saveProject(); this.renderChat();
    if (window.AgnesApp.showView) window.AgnesApp.showView("view_atelier");
    this.managerStep(0); return true;
  },
  // 30/09 — garde-fou : une réplique proposée par le Chef qui ne tient pas le réglage du projet (Calculateur de répliques)
  // ne vous est pas présentée ; elle lui revient avec la raison. Sans l'extension, pas de contrôle (rien ne bloque).
  repliqueHorsReglage: function (a) {
    var rp = window.AgnesPlugins && AgnesPlugins.get("repliques"); if (!rp || !rp.mesurer) return "";
    var texte = String(a.replique || "").replace(/[«»"“”]/g, "").trim(), id = rp.reglageProjet ? rp.reglageProjet() : undefined;
    var x = rp.mesurer(texte, id).repliques[0], r = rp.get(id) || {};
    if (!x) return "REFUSÉ avant de la montrer à l'utilisateur : réplique vide.";
    var raisons = x.statut === "ok" ? [] : x.alertes.filter(function (t) { return !/^phrase longue/.test(t); });
    if (/[:;]/.test(texte)) raisons.push("deux-points ou point-virgule interdits (la voix les lit mal) : écris « par exemple, » au lieu de « ex: »");
    if (!raisons.length) return "";
    return "REFUSÉ avant de la montrer à l'utilisateur : « " + texte + " » fait " + x.caracteres + " caractères (réglage « " + r.nom + " » : " + (r.min || 0) + " à " + (r.max || "∞") +
      ") — " + raisons.join(" ; ") + ". Écris une autre version, mesure-la avec mesurer_replique et attends le résultat, puis rappelle set_replique.";
  },
  // Remplace la n-ième réplique entre guillemets (« … » ou " … ") du prompt d'une carte, sans toucher au reste
  setReplique: function (carte, texte, index) {
    var A = window.AgnesApp, p = this.core.getProject(), s = A.sortedShots(p)[(+carte || 0) - 1];
    if (!s) throw { display: "Carte #" + carte + " introuvable." };
    var n = Math.max(0, (+index || 1) - 1), i = -1, done = false, clean = String(texte || "").replace(/[«»"“”]/g, "").trim();
    if (!clean) throw { display: "Réplique vide." };
    s.prompt = String(s.prompt || "").replace(/«\s*([^»]*?)\s*»|“([^”]*)”|"([^"]*)"/g, function (all, a, b, c, at, tout) {
      // 01/10 — les textes écrits et bruitages entre guillemets ne comptent pas comme répliques
      if (window.AgnesDialogue && AgnesDialogue.estReplique && !AgnesDialogue.estReplique(tout, at, all.charAt(0))) return all;
      i++; if (i !== n) return all; done = true;
      return all.charAt(0) === "«" ? "« " + clean + " »" : all.charAt(0) === "“" ? "“" + clean + "”" : '"' + clean + '"';
    });
    if (!done) throw { display: "La carte #" + carte + " n'a pas de réplique n°" + (n + 1) + " entre guillemets." };
    this.core.saveProject(); if (A.renderShots) A.renderShots();
    return "Réplique " + (n + 1) + " de la carte #" + carte + " remplacée (" + clean.length + " caractères) : « " + clean + " »";
  },
  managerSend: function () {
    var st = this.project(), ta = document.getElementById("atInput"), text = ta.value.trim();
    if (!text || this.busy) return;
    if (this.pending) { this.core.toast("Répondez d'abord à la demande d'autorisation en attente.", "err"); return; }
    var mention = this.findMention(text);
    ta.value = ""; this.hideMentions(); st.chat.push({ role: "user", content: text }); this.core.saveProject(); this.renderChat();
    if (mention) { this.directRun(mention.agent, mention.rest); return; }
    this.managerStep(0);
  },
  // « @6 … », « @a6 … » ou « @Scénariste … » en début de message
  findMention: function (text) {
    var m = String(text).match(/^\s*@(\S+)\s*([\s\S]*)$/); if (!m) return null;
    var key = m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), ag = this.agent(key) || this.agents.find(function (a) { return a.num === m[1] || a.num === m[1].replace(/^0+(?=\d)/, ""); });
    if (!ag) ag = this.agents.find(function (a) { return a.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").indexOf(key.replace(/[-_]/g, "")) === 0; });
    return ag ? { agent: ag, rest: m[2].trim() } : null;
  },
  directRun: function (a, request) {
    var self = this, st = this.project();
    this.setBusy("« " + a.name + " » travaille…");
    this.runAgent(a.id, request).then(function (t) {
      st.chat.push({ role: "assistant", agent: a.id, content: "▸ " + a.num + ". " + a.name + " a terminé (" + t.length + " caractères). Résultat dans la chaîne de production, à relire." });
      self.sel = a.id;
    }, function (e) { st.chat.push({ role: "assistant", content: "⚠ " + (e.display || e.message || e), local: true }); })
      .then(function () { self.core.saveProject(); self.setBusy(""); self.renderAll(); });
  },
  mentionList: function (q) {
    q = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return this.ordered().filter(function (a) {
      var t = (a.num + " " + a.name + " " + a.desc).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return !q || a.num.indexOf(q) === 0 || t.indexOf(q) !== -1;
    }).slice(0, 8);
  },
  showMentions: function () {
    var self = this, ta = document.getElementById("atInput"), pop = document.getElementById("atMention"), esc = window.AgnesApp.esc;
    var m = ta.value.slice(0, ta.selectionStart).match(/(?:\s|^)@([^\s]*)$/);
    if (!m) { this.hideMentions(); return; }
    var list = this.mentionList(m[1]); if (!list.length) { this.hideMentions(); return; }
    pop.innerHTML = list.map(function (a) { return '<div class="at-mi" data-mi="' + a.id + '"><b>' + esc(a.num + ". " + a.name) + '</b><span>' + esc(a.desc.slice(0, 90)) + '</span></div>'; }).join("");
    pop.style.display = "block";
    pop.querySelectorAll("[data-mi]").forEach(function (el) {
      el.onmousedown = function (e) {
        e.preventDefault(); var a = self.agent(el.getAttribute("data-mi")), pos = ta.selectionStart;
        var before = ta.value.slice(0, pos).replace(/@([^\s]*)$/, "@" + a.num + " ");
        ta.value = before + ta.value.slice(pos); ta.selectionStart = ta.selectionEnd = before.length; self.hideMentions(); ta.focus();
      };
    });
  },
  hideMentions: function () { var p = document.getElementById("atMention"); if (p) p.style.display = "none"; },
  managerStep: function (depth) {
    var self = this, st = this.project();
    if (depth > 8) { st.chat.push({ role: "assistant", content: "(J'arrête ici pour cette demande : dites-moi comment continuer.)" }); this.renderChat(); return; }
    this.setBusy("Le chef de production réfléchit…");
    var msgs = [{ role: "system", content: this.managerSystem() }].concat(this.trimmed(st.chat).map(function (m) {
      var x = { role: m.role, content: m.content || "" }; if (m.tool_calls) x.tool_calls = m.tool_calls; if (m.tool_call_id) { x.tool_call_id = m.tool_call_id; x.name = m.name; } return x;
    }));
    this.chat(msgs, { tools: this.TOOLS, tool_choice: "auto" }).then(function (m) {
      var calls = (m.tool_calls || []).map(function (c) {
        var args = c.function && c.function.arguments; if (typeof args === "string") { try { args = JSON.parse(args); } catch (e) { args = {}; } }
        return { id: c.id, name: c.function.name, args: args || {} };
      });
      st.chat.push({ role: "assistant", content: m.content || "", tool_calls: m.tool_calls && m.tool_calls.length ? m.tool_calls : undefined });
      self.core.saveProject(); self.renderChat();
      if (!calls.length) { self.setBusy(""); return; }
      self.handleCalls(calls, depth);
    }).catch(function (e) {
      st.chat.push({ role: "assistant", content: "⚠ " + (e.display || e.message || e), local: true }); self.core.saveProject(); self.renderChat(); self.setBusy("");
    });
  },
  NEEDS_AUTH: { run_agent: true, bible_upsert: true, send_to_scenario: true, send_to_lot: true, set_publication: true, update_shots: true, create_agent: true,
    generate_shots: true, bible_attacher_image: true, marketing_veille: true, marketing_generate_day: true, transcrire_ressource: true, marketing_extraire_fiche: true, marketing_recherche_sujet: true,
    marketing_decider_fiche: true, marketing_notes_cartes: true, set_replique: true, monter_cartes: true, compiler_finales: true, rendre_episode: true, choisir_style: true, classer_cartes: true,
    voix_generer: true, son_generer: true, etalonnage_regler: true, soustitres_appliquer: true },
  handleCalls: function (calls, depth) {
    var self = this, st = this.project(), results = [];
    function next(i) {
      if (i >= calls.length) {
        results.forEach(function (r) { st.chat.push({ role: "tool", tool_call_id: r.id, name: r.name, content: r.content }); });
        self.core.saveProject(); self.renderChat(); self.managerStep(depth + 1); return;
      }
      var c = calls[i], auto = c.name === "get_output" || c.name === "get_document" || c.name === "get_storyboard" || (c.name === "run_agent" && self.cfg.autoRun);
      var go = function (ok) {
        if (!ok) { results.push({ id: c.id, name: c.name, content: "REFUSÉ par l'utilisateur. Ne recommence pas sans lui demander." }); next(i + 1); return; }
        self.setBusy(self.describe(c) + "…");
        Promise.resolve().then(function () { return self.execTool(c); }).then(function (out) {
          results.push({ id: c.id, name: c.name, content: String(out).slice(0, 20000) }); next(i + 1);
        }, function (e) { results.push({ id: c.id, name: c.name, content: "ÉCHEC : " + (e.display || e.message || e) }); next(i + 1); });
      };
      var refus = c.name === "set_replique" ? self.repliqueHorsReglage(c.args || {}) : "";
      if (refus) { results.push({ id: c.id, name: c.name, content: refus }); next(i + 1); }   // 30/09 : garde-fou avant l'autorisation
      else if (auto || !self.NEEDS_AUTH[c.name]) go(true);
      else if (c.name === "marketing_decider_fiche") self.fichePreview(c.args.fiche).then(function (t) { c.preview = t; }, function (e) { c.preview = "Fiche illisible : " + (e.message || e); })
        .then(function () { self.pending = { call: c, go: go }; self.setBusy("En attente de votre autorisation"); self.renderChat(); });
      else { self.pending = { call: c, go: go }; self.setBusy("En attente de votre autorisation"); self.renderChat(); }
    }
    next(0);
  },
  resolvePending: function (answer) {
    var p = this.pending; this.pending = null; this.renderChat(); p.go(answer === "yes");
  },
  describe: function (c) {
    var a = c.args || {}, ag = a.agent_id && this.agent(a.agent_id);
    switch (c.name) {
      case "run_agent": return "Lancer « " + (ag ? ag.num + ". " + ag.name : a.agent_id) + " »";
      case "get_output": return "Lire le travail de « " + (ag ? ag.name : a.agent_id) + " »";
      case "get_document": return "Lire le document « " + (a.name || "") + " »";
      case "bible_upsert": return "Ranger dans la Bible : " + ((a.entries || []).map(function (e) { return e.name; }).join(", ") || "") + (a.series_style ? (a.entries && a.entries.length ? " + " : "") + "style commun" : "");
      case "bible_attacher_image": return "Rattacher l'image validée de la fiche " + (this.avatarNom(a.fiche) || a.fiche || "?") + " à la Bible (« " + (a.nom || "?") + " ») et la ranger dans la Bibliothèque";
      case "send_to_scenario": return "Envoyer le scénario dans l'onglet Scénario";
      case "send_to_lot": return "Envoyer le storyboard dans Le lot (" + ((String(a.script || "").match(/^\s*\d{1,4}\b/mg) || []).length) + " plans)";
      case "set_publication": return "Remplir la fiche Publication";
      case "get_storyboard": return "Lire les cartes du Storyboard";
      case "update_shots": {
        if (a.document) return "Mettre à jour les cartes existantes " + (a.cartes || []).map(function (x) { return "#" + x; }).join(", ") + " avec le LOT de « " + a.document + " » (aucune nouvelle carte)";
        var n = a.agent_id ? this.parsePlans(this.outputOf(a.agent_id)).length : (a.plans || []).length;
        return "Écrire les prompts de " + n + " carte(s) du Storyboard" + (ag ? " (travail de « " + ag.name + " »)" : "");
      }
      case "create_agent": return "Créer l'agent « " + (a.name || "?") + " » — " + (a.desc || "");
      case "generate_shots": return this.describeGeneration(a);
      case "marketing_state": return "Lire l'état de l'agent Marketing";
      case "marketing_veille": return "Agent Marketing : lancer la veille internet";
      case "marketing_generate_day": return "Agent Marketing : " + (a.garder ? "réécrire la journée du " + (a.date || "jour") + " en gardant « " + a.garder + " »" : "préparer les 3 vidéos du " + (a.date || "jour")) + " — méthode " + (a.methode || (a.garder ? "celle de la journée" : "par défaut")) + (a.appel ? " — appel " + (a.appel === "parle" ? "dit par Anthony" : "sur le carton") : "") + (a.topic ? " — sujet « " + a.topic + " »" : "") + " (écrites avec " + this.marketingModelLabel() + ")";
      case "marketing_get_day": return "Agent Marketing : reprendre le livrable du " + (a.date || "?");
      case "marketing_validate": return "Agent Marketing : revalider la journée du " + (a.date || "?");
      case "marketing_ressources": return "Lire les ressources locales (formations et vidéos)";
      case "transcrire_ressource": return "Transcrire la vidéo n°" + (a.video || 0) + " de « " + (a.fiche || "?") + " » (Extraire → Whisper), puis contrôle et ajout à la fiche";
      case "marketing_recherche_sujet": return "Agent Marketing : chercher « " + (a.sujet || "?") + " » sur internet" + (a.forums === false ? "" : " (avec Hacker News et Reddit)") + ", puis fiche à valider";
      case "mesurer_replique": return "Mesurer la réplique (caractères et durée)";
      case "set_replique": return "Remplacer la réplique de la carte #" + (a.carte || "?") + " par : « " + (a.replique || "") + " » (" + String(a.replique || "").length + " caractères)";
      case "marketing_fiches": return "Lire la liste des fiches connaissances";
      case "marketing_fiche": return "Lire la fiche « " + (a.fiche || "?") + " »";
      case "marketing_decider_fiche": return (a.decision === "rejeter" ? "REJETER" : "VALIDER") + " la fiche « " + (a.fiche || "?") + " » (votre décision : relisez les notions ci-dessous)";
      case "marketing_notes_cartes": return "Recopier réplique, carton de fin, description et hashtags de « " + (a.document || "?") + " » dans les notes des cartes " + (a.cartes || []).map(function (x) { return "#" + x; }).join(", ");
      case "marketing_extraire_fiche": return "Agent Marketing : extraire les notions de « " + (a.fiche || "?") + " »" + (a.ecraser ? " (en remplaçant les notions actuelles, copie gardée)" : "") + " — fiche à valider ensuite";
      case "montage_etat": return "Lire l'état du montage des cartes";
      case "montage_modeles": return "Lire les modèles de montage";
      case "monter_cartes": return "Monter " + ((a.cartes || []).length ? "les cartes " + a.cartes.map(function (x) { return "#" + x; }).join(", ") : "toutes les cartes classées") +
        " (vidéo finale dans le dossier Final)" + (a.modele ? " avec le modèle « " + a.modele + " »" : "") +
        (a.resserrer !== undefined ? (a.resserrer ? ", pauses resserrées" : ", pauses gardées") : "") + (a.karaoke !== undefined ? (a.karaoke ? ", sous-titres karaoké" : ", sans sous-titres") : "") +
        (a.appel ? ", appel : " + ({ carton: "carton", voixoff: "carton + voix-off déjà faite", aucun: "pas de carton" }[a.appel] || a.appel) : "");
      case "compiler_finales": return "Compiler les vidéos finales " + ((a.cartes || []).length ? "des cartes " + a.cartes.map(function (x) { return "#" + x; }).join(", ") : "de toutes les cartes montées") +
        " (" + ({ fondu: "fondu enchaîné", noir: "fondu au noir" }[a.transition] || "coupe franche") + ")" + (a.nom ? ", fichier « " + a.nom + " »" : "");
      case "rendre_episode": return "Rendre l'épisode à partir des plans de l'Assemblage (son réglé sur tout l'épisode" + (a.lufs ? ", " + a.lufs + " LUFS" : "") + ")" +
        (a.karaoke ? ", sous-titres karaoké" : "") + (a.carton ? ", carton de fin « " + a.carton + " »" : "") + (a.nom ? ", fichier « " + a.nom + " »" : "");
      case "studio_fiches": return "Lire les fiches du Studio";
      case "studio_fiche": return "Lire la fiche « " + (a.fiche || "?") + " » du Studio";
      case "style_projet": return "Lire le style des prompts du projet";
      case "choisir_style": return "Choisir le style des prompts du projet : « " + (a.style || "?") + " » (le compteur de répliques suit)";
      case "classer_cartes": return "Classer " + ((a.cartes || []).length ? "les cartes " + a.cartes.map(function (x) { return "#" + x; }).join(", ") : "toutes les cartes") +
        " dans Production" + (a.thematique ? "\\" + a.thematique : "") + (a.nom ? "\\" + a.nom : "") + (a.episode ? "\\Ep" + a.episode : "") + " (copie sur l'ordinateur, rien n'est supprimé d'Agnes)";
      case "voix_etat": return "Lire l'état des voix des cartes";
      case "voix_generer": return "Générer la voix des cartes " + (a.cartes || []).map(function (x) { return "#" + x; }).join(", ") + " (PAYANT : ElevenLabs / OpenAI de l'onglet Voix)" + (a.texte ? " avec le texte : « " + a.texte + " »" : "");
      case "son_pistes": return "Lire les pistes de l'onglet Son";
      case "son_generer": return "Générer " + ({ musique: "une musique", ambiance: "une ambiance", bruitage: "un bruitage" }[a.type] || a.type) + " de " + (a.duree || "?") + " s (PAYANT : ElevenLabs) : « " + (a.prompt || "") + " »";
      case "etalonnage_etat": return "Lire le look d'étalonnage du projet";
      case "etalonnage_regler": return "Étalonnage : préréglage « " + (a.preset || "inchangé") + " »" + (a.actif !== undefined ? (a.actif ? ", appliqué à l'Assemblage" : ", désactivé") : "");
      case "soustitres_modeles": return "Lire les modèles de sous-titres";
      case "soustitres_appliquer": return "Appliquer le modèle de sous-titres « " + (a.modele || "?") + " »";
      default: return c.name;
    }
  },
  execTool: function (c) {
    var a = c.args || {};
    switch (c.name) {
      case "run_agent": return this.runAgent(a.agent_id, a.request).then(function (t) { return "Travail terminé (" + t.length + " caractères). Début : " + t.slice(0, 1200); });
      case "get_output": { var t = this.outputOf(a.agent_id); return t || "(cet agent n'a encore rien produit)"; }
      case "get_document": {
        var q = String(a.name || "").toLowerCase(), d = (this.project().docs || []).find(function (x) { return x.name.toLowerCase() === q; }) ||
          (this.project().docs || []).find(function (x) { return x.name.toLowerCase().indexOf(q) !== -1; });
        return d ? d.content.slice(0, 40000) + (d.content.length > 40000 ? "\n[… document tronqué à 40 000 caractères]" : "") : "(aucun document de ce nom)";
      }
      case "bible_upsert": return this.bibleUpsert(a.entries, a.series_style);
      case "bible_attacher_image": return this.bibleAttacherImage(a.fiche, a.nom);
      case "send_to_scenario": return this.toScenario(a.text || "");
      case "send_to_lot": return this.toLot(a.script || "");
      case "set_publication": return this.toPublication(a);
      case "get_storyboard": return this.storyboardText();
      case "update_shots": {
        if (a.document) return this.applyLotToCards(a.document, a.cartes);
        var plans = a.agent_id ? this.parsePlans(this.outputOf(a.agent_id)) : a.plans;
        if (!plans || !plans.length) return "Aucun bloc « PLAN n » trouvé" + (a.agent_id ? " dans le travail de " + a.agent_id : "") + ".";
        return this.applyPlans(plans);
      }
      case "create_agent": return this.createAgent(a);
      case "generate_shots": return this.generateShots(a);
      case "marketing_state": return this.marketingCall("GET", "/marketing/etat").then(function (d) { return JSON.stringify(d); });
      case "marketing_veille": return this.marketingCall("POST", "/marketing/veille", { max: a.max }).then(function (d) {
        return (d.nouveautes.length ? d.nouveautes.map(function (t) { return "#" + t.id + " [" + (t.pilier || "divers") + "] " + t.titre; }).join("\n") : "Aucune nouveauté.") +
          (d.erreurs.length ? "\nFlux en erreur : " + d.erreurs.join(" · ") : "");
      });
      case "marketing_generate_day": return this.marketingDay(a);
      case "marketing_get_day": {
        var self2 = this;
        return this.marketingCall("GET", "/marketing/livrable?date=" + encodeURIComponent(a.date || "")).then(function (d) {
          self2.addDoc(d.nom, d.livrable, "agent Marketing", true); return "Document « " + d.nom + " » prêt : lis-le avec get_document.";
        });
      }
      case "marketing_validate": return this.marketingCall("POST", "/marketing/valider", { date: a.date }).then(function (d) {
        return "Journée " + d.date + " : " + (d.pret ? "toutes prêtes" : "à corriger") + "\n" + d.videos.map(function (v) {
          return "- " + v.type + " · " + v.statut + " · score " + v.score + (v.erreurs.length ? " · " + v.erreurs.join(" ; ") : "");
        }).join("\n");
      });
      case "marketing_ressources": return this.marketingCall("GET", "/marketing/ressources").then(function (d) {
        var list = d.formations.filter(function (f) { return !a.seulement_a_transcrire || f.a_transcrire; });
        return d.a_transcrire + " formation(s) à transcrire sur " + d.formations.length + ".\n" + list.map(function (f) {
          return "- " + f.fiche + " · " + f.titre + " · " + f.statut + " · " + f.mots + " mots" + (f.a_transcrire ? " · À TRANSCRIRE" : "") +
            (f.videos.length ? " · vidéos : " + f.videos.map(function (v) { return v.i + "=" + v.nom + (v.mo ? " (" + v.mo + " Mo)" : ""); }).join(", ") : "");
        }).join("\n");
      });
      case "transcrire_ressource": return this.transcribeResource(a);
      case "marketing_recherche_sujet": return this.marketingCall("POST", "/marketing/recherche", { sujet: a.sujet, forums: a.forums !== false }).then(function (d) {
        var e = d.extraction || {};
        return "Fiche « " + d.fiche + " » : " + d.sources.length + " source(s) trouvée(s) par " + d.par + " (" + d.mots + " mots)\n" +
          d.sources.map(function (s) { return "- [" + s.type + "] " + s.url; }).join("\n") +
          (d.notes.length ? "\nÉcartées / remarques : " + d.notes.join(" ; ") : "") +
          (e.erreur ? "\nExtraction : " + e.erreur : "\nNotions (" + e.notions + ", " + e.blocages + " blocage(s)) — fiche à valider par l'utilisatrice :\n" +
            (e.apercu || []).map(function (x) { return "- " + x; }).join("\n"));
      });
      case "marketing_fiches": return this.marketingCall("GET", "/marketing/fiches").then(function (d) {
        return "Dossier des fiches : `" + d.dossier + "`\n" + d.fiches.map(function (f) {
          return "- " + f.fiche + " · " + f.statut + " · " + f.notions + " notion(s)" + (f.blocages ? " · " + f.blocages + " blocage(s)" : "") + " · fichier `" + f.fichier + "`";
        }).join("\n") + (d.a_valider.length ? "\nÀ valider par l'utilisatrice : " + d.a_valider.join(", ") : "\nAucune fiche à valider.");
      });
      case "marketing_fiche": return this.fichePreview(a.fiche);
      case "set_replique": return this.setReplique(a.carte, a.replique, a.index);
      case "mesurer_replique": {
        var rp = window.AgnesPlugins && AgnesPlugins.get("repliques");
        if (!rp || !rp.resume) return "Mesure impossible : activez l'extension « Calculateur de répliques » (⚙ → Extensions). Compte en attendant les caractères espaces compris.";
        return rp.resume(a.texte || "", a.reglage || (rp.reglageProjet ? rp.reglageProjet() : undefined));   // 01/10 : réglage du projet par défaut
      }
      case "marketing_decider_fiche": return this.marketingCall("POST", "/marketing/fiche/decision", { fiche: a.fiche, decision: a.decision }).then(function (d) {
        return "Fiche « " + d.fiche + " » : " + (d.statut === "valide" ? "VALIDÉE par l'utilisatrice — Anthony peut s'en servir" : "rejetée") + ". Fichier : `" + d.fichier + "`";
      });
      case "marketing_notes_cartes": return this.applyCardNotes(a.document, a.cartes);
      case "montage_etat": case "montage_modeles": case "monter_cartes": case "compiler_finales": case "rendre_episode": return this.montageTool(c.name, a);
      case "studio_fiches": case "studio_fiche": case "style_projet": case "choisir_style": case "classer_cartes":
      case "voix_etat": case "voix_generer": case "son_pistes": case "son_generer": case "etalonnage_etat": case "etalonnage_regler":
      case "soustitres_modeles": case "soustitres_appliquer": return this.outilsExtensions(c.name, a);
      case "marketing_extraire_fiche": return this.marketingCall("POST", "/marketing/extraire", { fiche: a.fiche, ecraser: !!a.ecraser }).then(function (d) {
        return "Fiche « " + d.fiche + " » : " + d.notions + " notion(s), " + d.blocages + " blocage(s) du garde-fou, statut " + d.statut +
          " (l'utilisatrice valide).\n" + d.apercu.map(function (x) { return "- " + x; }).join("\n");
      });
    }
    return "Outil inconnu.";
  },
  // 02/10 — Studio, Styles de prompt, Classement : appelle ces extensions sans les modifier ; inactive = message, rien ne casse
  outilsExtensions: function (nom, a) {
    var P = window.AgnesPlugins, ext = function (id) { return P && P.isLoaded && P.isLoaded(id) ? P.get(id) : null; };
    var j = function (o) { return JSON.stringify(o, null, 1); };
    if (nom === "studio_fiches" || nom === "studio_fiche") {
      var V = ext("avatar"); if (!V) return "Studio indisponible : l'extension Studio est désactivée (⚙ → Extensions). Dis-le à l'utilisatrice.";
      if (nom === "studio_fiches") return j(V.cmdListe(a.type));
      try { return j(V.cmdFiche(a.fiche)); } catch (e) { return "Fiche introuvable : " + (e.message || e); }
    }
    if (nom === "style_projet" || nom === "choisir_style") {
      var S = ext("styles"); if (!S) return "Styles de prompt indisponibles : l'extension est désactivée (⚙ → Extensions). Les règles d'origine s'appliquent.";
      if (nom === "choisir_style") { try { S.choisir(a.style); } catch (e) { return "Style introuvable : " + (e.message || e) + ". Styles : " + S.list.map(function (x) { return x.nom; }).join(", "); } }
      var cur = S.courant(), R = ext("repliques");
      return (nom === "choisir_style" ? "Style choisi. " : "") + j({ style: cur.nom, regles_images: cur.image, regles_videos: cur.video, textes_ecrits: !!cur.texteEcran, musique: !!cur.musique,
        compteur_repliques: R && R.reglageProjet ? R.reglageProjet() : cur.repliques, styles: S.list.map(function (x) { return x.nom; }) });
    }
    if (nom === "classer_cartes") {
      var C = ext("classement"); if (!C || !C.classerLocal) return "Classement indisponible : l'extension Classement est désactivée (⚙ → Extensions).";
      var A = window.AgnesApp, all = A.sortedShots(), list = (a.cartes && a.cartes.length ? a.cartes.map(function (n) { return all[(+n || 0) - 1]; }) : all).filter(Boolean);
      if (!list.length) return "Aucune carte à classer.";
      var opt = { thematique: a.thematique, nom: a.nom, episode: a.episode, date: a.date, sujet: a.sujet }, out = [];
      return list.reduce(function (pr, s) {
        return pr.then(function () { return C.classerLocal(s, opt); }).then(function (r) { out.push("Carte #" + (all.indexOf(s) + 1) + " → `" + r.dossier.replace(/\//g, "\\") + "` (" + r.fichiers.join(", ") + ")"); });
      }, Promise.resolve()).then(function () { return "Classé dans Production :\n" + out.join("\n"); }, function (e) { return (out.length ? out.join("\n") + "\n" : "") + "Arrêt : " + (e.message || e); });
    }
    var Ap = window.AgnesApp, cartes = function () { return Ap.sortedShots(); };
    if (nom === "voix_etat" || nom === "voix_generer") {
      var T = ext("tts"); if (!T) return "Voix indisponibles : activez l'extension « Voix-off & dialogues » (⚙ → Extensions).";
      if (nom === "voix_etat") return j(cartes().map(function (s, i) {
        return { carte: i + 1, texte: (s.voice && s.voice.text) || s.voiceDraft || "", voix: !!(s.voice && s.voice.key), source: (s.voice && s.voice.source) || "" };
      }));
      var all = cartes(), cibles = (a.cartes || []).map(function (n) { return { n: n, s: all[(+n || 0) - 1] }; }).filter(function (x) { return x.s; }), rap = [];
      if (!cibles.length) return "Aucune carte valide.";
      return cibles.reduce(function (pr, x) {
        var texte = (cibles.length === 1 && a.texte) || (x.s.voice && x.s.voice.text) || x.s.voiceDraft || "";
        return pr.then(function () {
          if (!String(texte).trim()) { rap.push("Carte #" + x.n + " : aucun texte de voix (écrivez-le dans l'onglet Voix ou donnez « texte »)"); return; }
          return T.generateFor(x.s.id, texte).then(function () { rap.push("Carte #" + x.n + " : voix générée et attachée"); }, function (e) { rap.push("Carte #" + x.n + " : échec (" + (e.message || e) + ")"); });
        });
      }, Promise.resolve()).then(function () { return rap.join("\n"); });
    }
    if (nom === "son_pistes" || nom === "son_generer") {
      var M = ext("musique"); if (!M) return "Son indisponible : activez l'extension « Musique, ambiances & bruitages » (⚙ → Extensions).";
      if (nom === "son_pistes") return j((M.beds ? M.beds() : []).map(function (b) { return { nom: b.name, type: b.type, duree_s: b.dur ? Math.round(b.dur) : null, volume: b.volume, muet: !!b.mute }; }));
      if (["musique", "ambiance", "bruitage"].indexOf(a.type) === -1) return "Type inconnu : musique, ambiance ou bruitage.";
      return M.generate(a.type === "musique" ? "musique" : "effet", String(a.prompt || ""), +a.duree || 10, a.instrumental !== false)
        .then(function (b) { return M.addBed(b, a.nom || a.prompt.slice(0, 40), a.type); })
        .then(function (b) { return "Piste « " + b.name + " » (" + b.type + ", " + (b.dur ? Math.round(b.dur) + " s" : "durée inconnue") + ") ajoutée à l'onglet Son."; }, function (e) { return "Son non généré : " + (e.message || e); });
    }
    if (nom === "etalonnage_etat" || nom === "etalonnage_regler") {
      var G = ext("etalonnage"); if (!G || !G.g) return "Étalonnage indisponible : activez l'extension « Étalonnage & finition » (⚙ → Extensions).";
      var gr = G.g();
      if (nom === "etalonnage_regler") {
        if (a.preset) { if (!G.PRESETS[a.preset]) return "Préréglage inconnu. Disponibles : " + Object.keys(G.PRESETS).join(", "); Object.assign(gr, G.values(a.preset), { preset: a.preset }); }
        if (a.actif !== undefined) gr.on = !!a.actif;
        this.core.saveProject();
      }
      return (nom === "etalonnage_regler" ? "Étalonnage réglé. " : "") + j({ preset: gr.preset, actif: !!gr.on, prereglages: Object.keys(G.PRESETS).map(function (k) { return k + " (" + G.PRESETS[k][0] + ")"; }) });
    }
    if (nom === "soustitres_modeles" || nom === "soustitres_appliquer") {
      var K = ext("captions"); if (!K || !K.modeles) return "AutoCaption indisponible : activez l'extension AutoCaption (⚙ → Extensions).";
      var mods = K.modeles(), actuel = ((K.state && K.state().style) || {}).preset || "";
      if (nom === "soustitres_appliquer") {
        var q = String(a.modele || "").toLowerCase(), m = mods.find(function (x) { return x.id === a.modele || String(x.nom || "").toLowerCase() === q; });
        if (!m) return "Modèle introuvable. Modèles : " + mods.map(function (x) { return x.nom; }).join(", ");
        K.appliquerModele(m.id); return "Modèle de sous-titres « " + m.nom + " » appliqué.";
      }
      return j({ actuel: actuel, modeles: mods.map(function (x) { return { id: x.id, nom: x.nom, favori: x.favori, perso: x.perso }; }) });
    }
    return "Outil inconnu.";
  },
  // Montage (étape 5) : appelle l'extension Montage sans la modifier ; inactive = message, rien ne casse
  montageTool: function (nom, a) {
    var P = window.AgnesPlugins, M = P && P.isLoaded && P.isLoaded("montage") ? P.get("montage") : null;
    if (!M || !M.monterCartes) return "Montage indisponible : l'extension Montage est désactivée (⚙ → Extensions). Dis-le à l'utilisatrice.";
    var fr = function (x) { return String(x).replace(".", ","); }, cartes = a.cartes && a.cartes.length ? a.cartes : "tous";
    if (nom === "montage_etat") {
      var e = M.etatCartes();
      return "Modèle du projet : " + (e.modele || "aucun") + "\n" + (e.cartes.length ? e.cartes.map(function (c) {
        return "#" + c.carte + " " + c.titre + " · vidéo : " + (c.video || "aucune") + " · carton : « " + (c.carton || "") + " »" + (c.sous_texte ? " + « " + c.sous_texte + " »" : "") +
          " · appel : " + c.appel + (c.voix_off ? " (voix-off " + c.voix_off + ")" : "") + (c.resserrer ? " · pauses resserrées" : "") + (c.karaoke ? " · karaoké" : "") +
          " · " + (c.final ? "MONTÉE le " + c.final.date + " : `" + c.final.chemin + "`" : "pas encore montée");
      }).join("\n") : "Aucune carte.");
    }
    if (nom === "montage_modeles") {
      var m = M.listeModeles(), l = function (x) { return x.length ? x.map(function (y) { return y.nom + (y.favori ? " (favori)" : ""); }).join(", ") : "aucun"; };
      return "Modèles de montage : " + l(m.montage) + "\nModèles de carton : " + l(m.carton) + "\nCe projet : montage " + (m.projet.montage || "sans modèle") + ", carton " + (m.projet.carton || "sans modèle");
    }
    if (nom === "monter_cartes") return M.monterCartes(cartes, { modele: a.modele, resserrer: a.resserrer, karaoke: a.karaoke, appel: a.appel }).then(function (out) {
      return out.map(function (r) {
        return "#" + r.carte + " : " + (r.ok ? "montée → `" + r.chemin + "`" + (r.lufs != null ? " (" + fr(r.lufs) + " LUFS, crête " + fr(r.crete) + " dBTP)" : "") +
          (r.alertes.length ? " — à vérifier : " + r.alertes.join(" ; ") : "") : "ÉCHEC : " + r.erreur);
      }).join("\n");
    });
    if (nom === "rendre_episode") {
      if (!M.compilerEpisode) return "Montage trop ancien : rechargez Agnes.";
      var re = { ep_karaoke: !!a.karaoke, ep_carton: !!a.carton, ep_carton_texte: a.carton || "", ep_carton_sous: a.sous_texte || "" };
      if (a.lufs) re.ep_lufs = Number(a.lufs);
      if (a.nom) re.nom = a.nom;
      return M.compilerEpisode(re).then(function (r) {
        return "Épisode prêt : `" + r.chemin + "` (" + fr(r.duree) + " s, " + r.plans.length + " plans, " + fr(r.son.apres_lufs) + " LUFS)" +
          (r.sous_titres && r.sous_titres.srt ? "\nSous-titres : `" + r.sous_titres.srt + "`" : "") + "\nCompte rendu : `" + r.compte_rendu + "`" +
          (r.alertes.length ? "\nÀ vérifier : " + r.alertes.join(" ; ") : "");
      });
    }
    var rc = {}; ["transition", "duree_transition", "nom"].forEach(function (k) { if (a[k] !== undefined) rc[k] = a[k]; });
    return M.compilerFinales(cartes, rc).then(function (r) {
      return "Compilation prête : `" + r.chemin + "` (" + fr(r.duree) + " s, " + r.transition + (r.son ? ", " + fr(r.son.lufs) + " LUFS" : "") + ")" +
        (r.srt ? "\nSous-titres : `" + r.srt + "`" : "") + "\nCompte rendu : `" + r.compte_rendu + "`" + (r.alertes.length ? "\nÀ vérifier : " + r.alertes.join(" ; ") : "");
    });
  },
  setBusy: function (t) { this.busy = !!t && !/autorisation/.test(t); var el = document.getElementById("atBusy"); if (el) el.textContent = t || ""; },

  // =========================================================
  // AFFICHAGE
  // =========================================================
  renderAll: function () { if (!this.project()) return; this.renderList(); this.renderAgent(); this.renderChat(); this.renderDocs(); },

  // =========================================================
  // DOCUMENTS (lus par les agents choisis)
  // =========================================================
  DOC_MAX: 200000,     // caractères gardés par document
  // =========================================================
  // GÉNÉRATIONS ET AGENT MARKETING (outils du Chef)
  // =========================================================
  moteurs: function () { var m = window.AgnesPlugins && AgnesPlugins.get("moteurs"); return m && m.cfg ? m : null; },
  pont: function () { var m = this.moteurs(); return ((m && m.cfg.pont) || "http://127.0.0.1:8177").replace(/\/$/, ""); },
  shotsByNumbers: function (plans) {
    var all = window.AgnesApp.sortedShots(), nums = (Array.isArray(plans) ? plans : String(plans || "").split(/[,\s]+/)).map(Number).filter(function (n) { return n > 0; });
    return nums.map(function (n) { return { n: n, shot: all[n - 1] }; });
  },
  describeGeneration: function (a) {
    var m = this.moteurs(), picked = this.shotsByNumbers(a.plans), etape = a.etape === "image" || a.etape === "video" ? a.etape : "auto";
    var moteur = !m ? "Agnes" : etape === "video" ? m.cfg.video : etape === "image" ? m.cfg.image : m.cfg.image + " puis " + m.cfg.video;
    return "Lancer " + picked.length + " génération(s) " + (etape === "auto" ? "" : etape + " ") + "(moteur : " + moteur + ") — cartes " + picked.map(function (p) { return p.n; }).join(", ");
  },
  generateShots: function (a) {
    var A = window.AgnesApp, m = this.moteurs(), etape = a.etape === "image" || a.etape === "video" ? a.etape : "";
    var picked = this.shotsByNumbers(a.plans), missing = picked.filter(function (p) { return !p.shot; }).map(function (p) { return p.n; });
    if (!picked.length) return "Aucun numéro de carte donné.";
    if (missing.length) return "Cartes introuvables : " + missing.join(", ") + " (voir get_storyboard). Rien n'a été lancé.";
    if (etape !== "image" && m && (m.cfg.video === "grok" || m.cfg.video === "flow")) {
      var nom = m.cfg.video === "flow" ? "Flow" : "Grok", bloque = m.cfg[m.cfg.video + "Bloque"];
      if (bloque) return nom + " est bloqué par sécurité : " + bloque + " Rien n'a été lancé : préviens l'utilisateur (⚙ → Moteurs).";
      if (!m.canGrok()) return nom + " indisponible : Agnes n'est pas ouverte depuis Lumina. Rien n'a été lancé.";
    }
    var done = [];
    picked.forEach(function (p) { var j = etape ? A.enqueueStage(p.shot, etape) : A.enqueueShot(p.shot); if (j) done.push(p.n); });
    if (!done.length) return "Rien n'a été lancé (clé Agnes manquante pour ce moteur ?).";
    return done.length + " carte(s) mise(s) en file" + (etape ? " (étape " + etape + ")" : "") + " : " + done.join(", ") + ". Suivi dans la Liste d'attente ; contrôle le résultat avant la suite.";
  },
  // Fournisseur de l'Atelier transmis à l'agent Marketing pour écrire les scripts (sans Claude ni abonnement)
  marketingModel: function () {
    var r = this.resolveModel(""), id = r && r.provider, key = id && this.keyOf(id);
    if (!id || !key) return null;
    return { base: this.baseOf(id), key: key, model: r.model, label: this.PROVIDERS[id].label, min_interval_s: (this.PROVIDERS[id].gap || 1500) / 1000 };
  },
  marketingModelLabel: function () { var m = this.marketingModel(); return m ? m.label + " (" + m.model + ")" : "les modèles de phrases locaux"; },
  marketingCall: function (method, path, body) {
    var init = method === "GET" ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) };
    return fetch(this.pont() + path, init).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; });
    }, function () { throw new Error("pont local injoignable : lancez lancer_pont.bat (prod-fruits) puis réessayez"); });
  },
  // 01/10 — Ressource locale : vidéo (pont) → Extraire (Whisper) → contrôle par l'agent Marketing → fiche + document.
  // Extraire est facultative : sans elle, message clair et rien d'autre ne casse.
  transcribeResource: function (a) {
    var self = this, ex = window.AgnesPlugins && AgnesPlugins.get("extracteur");
    if (!ex || !ex.transcribeBlob) return Promise.resolve("Transcription impossible : l'extension Extraire n'est pas active (⚙ → Extensions). " +
      "Autre solution : exporter le script depuis une autre application puis « python -m content_agent connaissances ajouter-source " + (a.fiche || "<fiche>") + " --fichier script.txt ».");
    var i = Math.max(0, parseInt(a.video, 10) || 0), url = this.pont() + "/marketing/ressource-video?fiche=" + encodeURIComponent(a.fiche || "") + "&i=" + i;
    return fetch(url).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "HTTP " + r.status); }, function () { throw new Error("HTTP " + r.status); });
      return r.blob();
    }, function () { throw new Error("pont local injoignable : lancez lancer_pont.bat (prod-fruits) puis réessayez"); })
      .then(function (blob) { return ex.transcribeBlob(blob, (a.fiche || "video") + "-" + i + ".mp4"); })
      .then(function (r) {
        if (!r.text || r.text.split(/\s+/).length < 5) throw new Error("aucune parole détectée dans cette vidéo");
        return self.marketingCall("POST", "/marketing/transcription", { fiche: a.fiche, texte: r.text, nom: (a.fiche || "video") + "-video-" + i });
      })
      .then(function (d) {
        self.addDoc("Transcription — " + d.fiche + " (vidéo " + i + ")", d.texte_controle, "Extraire + contrôle", true);
        return "Transcription ajoutée à la fiche « " + d.fiche + " » : " + d.mots + " mots" +
          (d.controle ? " (contrôlée par " + d.par + " : " + d.corriges + "/" + d.morceaux + " morceau(x) corrigé(s), " + d.gardes_bruts + " gardé(s) brut(s) ; version brute conservée)" : " (sans contrôle)") +
          ". Sources de la fiche : " + d.mots_sources + " mots. Texte rangé dans les documents de l'Atelier. Étape suivante possible : marketing_extraire_fiche.";
      });
  },
  marketingDay: function (a) {
    var self = this, body = { methode: a.methode, date: a.date, topic: a.topic, audience: a.audience, offer: a.offer, objective: a.objective,
      trend: a.trend, pillar: a.pillar, cluster: a.cluster, environment: a.environment, garder: a.garder, notions: a.notions, suite_demain: !!a.suite_demain, appel: a.appel || undefined, llm: this.marketingModel() };
    return this.marketingCall("POST", "/marketing/journee", body).then(function (d) {
      self.addDoc(d.livrable_nom, d.livrable, "agent Marketing", true);
      return "Journée du " + d.date + " (méthode " + (d.methodes || []).join(", ") + ", pilier " + d.pilier + ") : " + (d.pret ? "3/3 vidéos prêtes" : "au moins une vidéo à corriger") + ".\n" +
        d.videos.map(function (v) { return "- " + v.type + " [" + v.statut + ", " + v.duree_s + " s, " + v.generateur + "] " + v.hook + (v.erreurs.length ? " — " + v.erreurs.join(" ; ") : ""); }).join("\n") +
        "\nDossier des fichiers de la journée : `" + d.dossier + "`" +
        "\nDocument « " + d.livrable_nom + " » ajouté : lis-le avec get_document et suis ses CONSIGNES POUR LE CHEF.";
    });
  },
  DOC_BUDGET: 60000,   // caractères de documents envoyés au maximum dans une requête d'agent
  doc: function (id) { return (this.project().docs || []).find(function (d) { return d.id === id; }); },
  // replace = true : un document du même nom est remplacé (livrables régénérés), sinon ajouté à côté
  addDoc: function (name, content, source, replace) {
    var st = this.project(), text = String(content || "").replace(/\r/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
    if (!text) { this.core.toast("« " + name + " » est vide.", "err"); return; }
    if (replace) st.docs = (st.docs || []).filter(function (d) { return d.name !== name; });
    var cut = text.length > this.DOC_MAX;
    st.docs.push({ id: window.AgnesApp.uid(), name: name, source: source || "fichier", content: cut ? text.slice(0, this.DOC_MAX) : text, size: text.length, cut: cut, on: true, for: "all", at: Date.now() });
    this.core.saveProject(); this.renderDocs();
    this.core.toast("Document ajouté : " + name + (cut ? " (tronqué à 200 000 caractères)" : ""), "ok");
  },
  loadScript: function (src, test) {
    if (test()) return Promise.resolve();
    return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = function () { rej(new Error("module de lecture indisponible (connexion ?)")); }; document.head.appendChild(sc); });
  },
  readDocFile: function (f) {
    var self = this;
    if (/\.docx$/i.test(f.name)) {
      return this.loadScript("vendor/mammoth.browser.min.js", function () { return !!window.mammoth; })
        .then(function () { return f.arrayBuffer(); }).then(function (ab) { return window.mammoth.extractRawText({ arrayBuffer: ab }); }).then(function (r) { return r.value; });
    }
    if (/\.pdf$/i.test(f.name)) {
      // Copie locale (vendor/) : obligatoire dans Lumina (extension Chrome), où le code distant est interdit.
      // Hors extension (fichier ouvert directement), le lecteur en arrière-plan reste celui du CDN : file:// ne peut pas lancer de worker local.
      var worker = location.protocol === "file:" ? "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js" : "vendor/pdf.worker.min.js";
      return this.loadScript("vendor/pdf.min.js", function () { return !!window.pdfjsLib; }).then(function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
        return f.arrayBuffer();
      }).then(function (ab) { return window.pdfjsLib.getDocument({ data: ab }).promise; }).then(function (pdf) {
        var pages = [], chain = Promise.resolve();
        for (var i = 1; i <= pdf.numPages; i++) (function (n) {
          chain = chain.then(function () { return pdf.getPage(n); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            var line = "", out = [], lastY = null;
            tc.items.forEach(function (it) { var y = it.transform ? it.transform[5] : null; if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { out.push(line); line = ""; } line += it.str; lastY = y; });
            out.push(line); pages.push(out.join("\n"));
          });
        })(i);
        return chain.then(function () { var t = pages.join("\n\n"); if (!t.trim()) throw new Error("PDF sans texte (scan ?) : utilisez un PDF texte ou copiez le texte"); return t; });
      });
    }
    return f.text().then(function (t) {
      if (/\.html?$/i.test(f.name)) { var d = new DOMParser().parseFromString(t, "text/html"); d.querySelectorAll("script,style,noscript").forEach(function (x) { x.remove(); }); return d.body ? d.body.innerText || d.body.textContent : t; }
      return t;
    });
  },
  addDocFiles: function (files) {
    var self = this, chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        self.core.toast("Lecture de « " + f.name + " »…");
        return self.readDocFile(f).then(function (t) { self.addDoc(f.name, t, "fichier"); }, function (e) { self.core.toast("« " + f.name + " » illisible : " + (e.message || e), "err"); });
      });
    });
  },
  addDocUrl: function (url) {
    var self = this, btn = document.getElementById("atDocUrlBtn");
    if (!/^https?:\/\//i.test(url)) { this.core.toast("Saisissez une adresse complète (https://…).", "err"); return; }
    btn.disabled = true; btn.textContent = "Lecture…";
    fetch("https://r.jina.ai/" + url).then(function (r) { if (!r.ok) throw new Error("page inaccessible (HTTP " + r.status + ")"); return r.text(); })
      .then(function (t) { self.addDoc("Web : " + url.replace(/^https?:\/\//, "").slice(0, 60), t, "web"); document.getElementById("atDocUrl").value = ""; })
      .catch(function (e) { self.core.toast("Lecture de la page impossible : " + (e.message || e), "err"); })
      .finally(function () { btn.disabled = false; btn.textContent = "Lire la page"; });
  },
  // Documents destinés à un agent, dans la limite du budget de caractères
  docsFor: function (agentId) {
    var list = (this.project().docs || []).filter(function (d) { return d.on && (d.for === "all" || d.for === agentId); });
    if (!list.length) return "";
    var budget = this.DOC_BUDGET, per = Math.floor(budget / list.length), out = ["### DOCUMENTS FOURNIS PAR L'UTILISATEUR (à utiliser en priorité quand la demande s'y rapporte)"];
    list.forEach(function (d) {
      var t = d.content.length > per ? d.content.slice(0, per) + "\n[… tronqué : " + d.content.length + " caractères au total]" : d.content;
      out.push("--- DÉBUT « " + d.name + " » ---\n" + t + "\n--- FIN « " + d.name + " » ---");
    });
    return out.join("\n");
  },
  docsIndex: function () {
    var self = this, list = this.project().docs || [];
    if (!list.length) return "(aucun)";
    return list.map(function (d) { var ag = d.for !== "all" && d.for !== "chef" ? self.agent(d.for) : null;
      return "- « " + d.name + " » (" + d.size + " car.)" + (d.on ? "" : " [désactivé]") + " → " + (d.for === "all" ? "tous les agents" : d.for === "chef" ? "chef seulement" : ag ? "agent " + ag.num + ". " + ag.name : d.for); }).join("\n");
  },
  renderDocs: function () {
    var self = this, el = document.getElementById("atDocList"), st = this.project(), esc = window.AgnesApp.esc; if (!el || !st) return;
    var opts = [["all", "Tous les agents"], ["chef", "Chef de production seulement"]].concat(this.ordered().map(function (a) { return [a.id, "Agent " + a.num + ". " + a.name]; }));
    el.innerHTML = st.docs.length ? st.docs.map(function (d) {
      var icon = d.source === "web" ? "🌐" : d.source === "texte" ? "📝" : "📄";
      return '<div class="at-doc" data-doc="' + d.id + '"><input type="checkbox" data-dk="on"' + (d.on ? " checked" : "") + ' title="Transmettre ce document">' +
        '<span class="at-doc-name" title="' + esc(d.name) + '">' + icon + " " + esc(d.name) + '</span><span class="hint" style="margin:0;white-space:nowrap">' + (d.size < 1000 ? d.size + ' car.' : Math.round(d.size / 1000) + ' k car.') + (d.cut ? " (tronqué)" : "") + '</span>' +
        '<select data-dk="for">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (d.for === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>' +
        '<button class="small-btn" data-dact="view" type="button" title="Voir le texte lu">👁</button><button class="small-btn" data-dact="del" type="button" title="Retirer">✕</button></div>';
    }).join("") : '<p class="hint" style="margin:0">Aucun document.</p>';
  },
  renderList: function () {
    var self = this, st = this.project(), esc = window.AgnesApp.esc;
    document.getElementById("atList").innerHTML = this.ordered().map(function (a) {
      var o = st.outputs[a.id], state = a._running ? "run" : o && o.ok ? "ok" : o && o.text ? "done" : "";
      return '<button type="button" class="at-ag' + (a.id === self.sel ? " sel" : "") + '" data-ag="' + a.id + '" title="' + esc(a.desc) + '">' +
        '<span class="at-dot ' + state + '"></span><b>' + esc(a.num) + '</b> ' + esc(a.name) + '</button>';
    }).join("");
  },
  renderAgent: function () {
    var self = this, a = this.agent(this.sel), st = this.project(), esc = window.AgnesApp.esc; if (!a) return;
    var o = st.outputs[a.id] || {}, box = document.getElementById("atAgent");
    var ins = (a.inputs || []).map(function (id) { var s = self.agent(id), ok = !!self.outputOf(id); return '<span class="ext-tag' + (ok ? " ok" : " err") + '">' + esc(s ? s.num + ". " + s.name : id) + '</span>'; }).join(" ");
    var destBtn = { "bible-serie": "→ Bible (style + lieux)", "bible-perso": "→ Bible (fiches + ADN)", scenario: "→ Onglet Scénario", lot: "→ Le lot", publication: "→ Publication", storyboard: "→ Cartes du Storyboard" }[a.dest];
    box.innerHTML = '<div class="at-head"><h3 style="margin:0">' + esc(a.num + ". " + a.name) + '</h3><button class="small-btn" data-at="edit">' + (this.editing ? "Fermer l'édition" : "Modifier l'agent") + '</button></div>' +
      '<p class="hint" style="margin:4px 0">' + esc(a.desc) + '</p>' +
      '<p class="hint" style="margin:4px 0">Entrées : ' + (ins || "votre idée (ci-dessous)") + (a.context && a.context.length ? ' · lit aussi : ' + a.context.map(function (c) { return { bible: "la Bible", library: "la Bibliothèque", skills: "les Skills", storyboard: "le Storyboard" }[c] || c; }).join(", ") : "") +
      ' · destination : ' + esc(this.DESTS[a.dest] || "—") + '</p>' +
      (this.editing ? this.editorHtml(a) : '') +
      '<label class="hint" style="margin:6px 0 2px;display:block">Demande (idée, épisode visé, contraintes)</label>' +
      '<textarea data-af="request" rows="2" placeholder="' + (a.id === "a1" ? "Collez votre idée brute d'histoire…" : "Ex. Épisode 1 uniquement. / Garde les dialogues très courts.") + '">' + esc(st.requests[a.id] || "") + '</textarea>' +
      '<div class="row-inline" style="margin-top:6px"><button class="primary-btn" data-at="run"' + (a._running ? " disabled" : "") + '>' + (a._running ? "Au travail…" : o.text ? "Refaire" : "Lancer l'agent") + '</button>' +
      (o.text ? '<button class="small-btn" data-at="ok">' + (o.ok ? "✓ Validé" : "Valider") + '</button><button class="small-btn" data-at="copy">Copier</button>' +
        (destBtn ? '<button class="small-btn" data-at="dest">' + destBtn + '</button>' : '') : '') + '</div>' +
      (o.text ? '<label class="hint" style="margin:8px 0 2px;display:block">Travail produit (modifiable ; les agents suivants lisent cette version)' + (o.at ? " · " + new Date(o.at).toLocaleString("fr-FR") : "") + '</label>' +
        '<textarea data-af="output" class="at-out" rows="16">' + esc(o.text) + '</textarea>' : '');
  },
  editorHtml: function (a) {
    var esc = window.AgnesApp.esc, self = this;
    return '<div class="refs-block" style="margin:8px 0"><div class="field"><label>Nom</label><input type="text" id="atEdName" value="' + esc(a.name) + '"></div>' +
      '<div class="field"><label>Description</label><input type="text" id="atEdDesc" value="' + esc(a.desc) + '"></div>' +
      '<div class="field"><label>Consignes (collez ici les instructions de votre Gem)</label><textarea id="atEdIns" rows="10">' + esc(a.instructions) + '</textarea></div>' +
      '<div class="field"><label>Entrées (travail des agents à lui transmettre)</label><div class="chips">' + this.ordered().filter(function (x) { return x.id !== a.id; }).map(function (x) {
        return '<label class="inline"><input type="checkbox" data-edin="' + x.id + '"' + ((a.inputs || []).indexOf(x.id) !== -1 ? " checked" : "") + '> ' + esc(x.num + ". " + x.name) + '</label>';
      }).join("") + '</div></div>' +
      '<div class="row-inline"><label class="inline">Modèle <input type="text" id="atEdModel" list="atModels" placeholder="fournisseur principal" value="' + esc(a.model || "") + '" style="width:190px"></label>' +
      '<label class="inline">Créativité <input type="number" id="atEdTemp" class="mini" min="0" max="1.5" step="0.05" placeholder="auto" value="' + esc(a.temperature == null ? "" : a.temperature) + '"></label>' +
      '<label class="inline">Longueur max (tokens) <input type="number" id="atEdMax" class="mini" min="256" max="32000" step="256" placeholder="auto" value="' + esc(a.maxTokens || "") + '" style="width:90px"></label></div>' +
      '<div class="row-inline"><label class="inline"><input type="checkbox" id="atEdBible"' + ((a.context || []).indexOf("bible") !== -1 ? " checked" : "") + '> lit la Bible</label>' +
      '<label class="inline"><input type="checkbox" id="atEdLib"' + ((a.context || []).indexOf("library") !== -1 ? " checked" : "") + '> lit la Bibliothèque</label>' +
      '<label class="inline"><input type="checkbox" id="atEdSkills"' + ((a.context || []).indexOf("skills") !== -1 ? " checked" : "") + '> connaît les Skills</label>' +
      '<label class="inline"><input type="checkbox" id="atEdStory"' + ((a.context || []).indexOf("storyboard") !== -1 ? " checked" : "") + '> lit le Storyboard</label>' +
      '<label class="inline">Destination <select id="atEdDest">' + Object.keys(this.DESTS).map(function (k) { return '<option value="' + k + '"' + (a.dest === k ? " selected" : "") + '>' + esc(self.DESTS[k]) + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" data-at="save">Enregistrer l\'agent</button><button class="small-btn" data-at="reset">Consignes par défaut</button>' +
      '<button class="small-btn" data-at="export">Exporter l\'équipe (.json)</button></div></div>';
  },
  // Markdown des réponses (titres, gras, italique, listes, tableaux, code, liens) → HTML.
  // Tout le texte est échappé AVANT la mise en forme : aucun HTML venant de l'IA n'est interprété.
  // 29/09 — adresses d'un dossier ou d'un fichier de l'ordinateur (C:\…, D:\…) : cliquables (pont → Explorateur) + copiables
  isPath: function (t) { return /^[a-zA-Z]:[\\\/][^<>|?*\n]*$/.test(String(t).replace(/&amp;/g, "&").trim()); },
  pathHtml: function (escaped) {
    var raw = escaped.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    return '<code class="at-path">' + escaped + '</code><button type="button" class="at-open" data-open="' + window.AgnesApp.esc(raw) + '" title="Ouvrir dans l\'Explorateur (pont local) — sinon l\'adresse est copiée">📂</button>';
  },
  copyText: function (t, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = "✓ Copié"; setTimeout(function () { btn.textContent = o; }, 1500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { window.prompt("Copiez :", t); });
    else window.prompt("Copiez :", t);
  },
  openPath: function (path, btn) {
    var self = this;
    fetch(this.pont() + "/ouvrir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chemin: path }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || "refusé"); self.core.toast("Ouvert dans l'Explorateur : " + path, "ok"); })
      .catch(function (e) { self.copyText(path, btn); self.core.toast("Adresse copiée (" + (e.message || "pont local injoignable") + ") : collez-la dans l'Explorateur.", "err"); });
  },
  md: function (text) {
    var self = this, esc = window.AgnesApp.esc, codes = [];
    var t = String(text || "").replace(/\r/g, "").replace(/```[^\n]*\n([\s\S]*?)```/g, function (_, c) { codes.push(c.replace(/\n$/, "")); return "\u0000" + (codes.length - 1) + "\u0000"; });
    var inline = function (s) {
      return esc(s)
        .replace(/`([^`]+)`/g, function (_, c) { return self.isPath(c) ? self.pathHtml(c) : "<code>" + c + "</code>"; })
        .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, function (_, a, b) { return "<strong>" + (a || b) + "</strong>"; })
        .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)|(^|[^_\w])_([^_\n]+)_(?!\w)/g, function (_, p1, a, p2, b) { return (p1 || p2 || "") + "<em>" + (a || b) + "</em>"; })
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    };
    var lines = t.split("\n"), out = [], i = 0, para = [];
    var flush = function () { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    var cells = function (l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^\u0000\d+\u0000$/.test(l.trim())) { flush(); out.push('<div class="at-code"><button type="button" class="at-copy" data-copy="1" title="Copier">📋 Copier</button><pre><code>' + esc(codes[+l.trim().slice(1, -1)]) + "</code></pre></div>"); i++; continue; }
      if (!l.trim()) { flush(); i++; continue; }
      if ((m = l.match(/^\s*(#{1,6})\s+(.*)$/))) { flush(); out.push("<h" + Math.min(6, m[1].length + 2) + ">" + inline(m[2].replace(/\s*#+\s*$/, "")) + "</h" + Math.min(6, m[1].length + 2) + ">"); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush(); var head = cells(l), rows = []; i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push("<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>");
        continue;
      }
      if (/^\s*>\s?/.test(l)) { flush(); var q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^\s*>\s?/, ""))); i++; } out.push("<blockquote>" + q.join("<br>") + "</blockquote>"); continue; }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        flush(); var ordered = /^\s*\d/.test(l), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          var item = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""); i++;
          while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) { item += "\n" + lines[i].trim(); i++; }
          items.push("<li>" + inline(item).replace(/\n/g, "<br>") + "</li>");
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }
      para.push(l); i++;
    }
    flush();
    return out.join("");
  },
  renderChat: function () {
    var st = this.project(), esc = window.AgnesApp.esc, el = document.getElementById("atMsgs"); if (!el || !st) return;
    var self = this, calls = {};
    // Pseudo de chaque message : Vous (→ agent appelé avec @), Chef de production, ou l'agent qui a travaillé
    var tag = function (a) { return a ? a.num + ". " + a.name : ""; };
    var who = function (label, cls) { return '<span class="at-who' + (cls ? " " + cls : "") + '">' + esc(label) + '</span>'; };
    st.chat.forEach(function (m) { (m.tool_calls || []).forEach(function (c) { calls[c.id] = c; }); });
    var html = st.chat.map(function (m) {
      if (m.role === "user") {
        var dm = self.findMention(m.content);
        return '<div class="at-msg me">' + who("Vous" + (dm ? " → " + tag(dm.agent) : "")) + esc(m.content) + '</div>';
      }
      if (m.role === "tool") {
        var c0 = calls[m.tool_call_id], args0 = c0 && c0.function.arguments, ag0 = null;
        if (typeof args0 === "string") { try { args0 = JSON.parse(args0); } catch (e) { args0 = {}; } }
        if (c0 && c0.function.name === "run_agent" && args0) ag0 = self.agent(args0.agent_id);
        return '<div class="at-msg tool">' + (ag0 ? who(tag(ag0), "agent") : "") + '↳ ' + esc(String(m.content).slice(0, 220)) + (String(m.content).length > 220 ? "…" : "") + '</div>';
      }
      var list = (m.tool_calls || []).map(function (c) {
        var args = c.function.arguments; if (typeof args === "string") { try { args = JSON.parse(args); } catch (e) { args = {}; } }
        return '<div class="at-call">⚙ ' + esc(self.describe({ name: c.function.name, args: args })) + '</div>';
      }).join("");
      var ag = m.agent ? self.agent(m.agent) : null;
      if (!ag && !m.local) { var mm = /^▸ (\d+)\. /.exec(m.content || ""); if (mm) ag = self.agents.find(function (x) { return x.num === mm[1]; }); }
      return (m.content ? '<div class="at-msg bot md">' + who(ag ? tag(ag) : "Chef de production", ag ? "agent" : "") + self.md(m.content) + '</div>'
        : (list ? '<div class="at-msg tool">' + who("Chef de production") + '</div>' : '')) + list;
    }).join("");
    if (this.pending) {
      var c = this.pending.call, preview = c.preview ? c.preview : c.name === "run_agent" ? c.args.request : c.name === "bible_upsert" ? (c.args.entries || []).map(function (e) { return e.name + (e.dna ? " — " + e.dna : ""); }).join("\n") + (c.args.series_style ? "\nStyle : " + c.args.series_style : "")
        : c.name === "send_to_lot" ? c.args.script : c.name === "send_to_scenario" ? c.args.text : JSON.stringify(c.args, null, 1);
      html += '<div class="at-auth"><b>Autorisation demandée :</b> ' + esc(this.describe(c)) +
        (c.preview ? '<div class="at-msg md" style="max-width:100%;margin:6px 0">' + this.md(c.preview) + '</div>'
          : '<pre>' + esc(String(preview || "").slice(0, 1500)) + (String(preview || "").length > 1500 ? "\n…" : "") + '</pre>') +
        '<div class="row-inline"><button class="primary-btn" data-auth="yes">Autoriser</button><button class="small-btn" data-auth="no">Refuser</button></div></div>';
    }
    el.innerHTML = html || '<p class="hint">Dites au chef de production ce que vous voulez faire : « Voici mon idée… », « Continue la chaîne », « Range les personnages dans la Bible », « Envoie l\'épisode 1 dans Le lot ».</p>';
    el.scrollTop = el.scrollHeight;
  },

  // Boutons du panneau d'un agent
  agentAction: function (act, btn) {
    var App_clamp = window.AgnesApp.clamp;
    var self = this, a = this.agent(this.sel), st = this.project(), core = this.core, o = st.outputs[a.id];
    if (act === "run") {
      var missing = (a.inputs || []).filter(function (id) { return !self.outputOf(id); }).map(function (id) { var s = self.agent(id); return s ? s.num + ". " + s.name : id; });
      if (missing.length && !window.confirm("Entrées encore vides : " + missing.join(", ") + ". Lancer quand même ?")) return;
      this.runAgent(a.id, st.requests[a.id] || "").then(function () { core.toast("« " + a.name + " » a terminé.", "ok"); }, function (e) { core.toast(e.display || e.message || e, "err"); });
    }
    if (act === "ok" && o) { o.ok = !o.ok; core.saveProject(); this.renderAll(); }
    if (act === "copy" && o) { (navigator.clipboard ? navigator.clipboard.writeText(o.text) : Promise.reject()).then(function () { core.toast("Copié.", "ok"); }, function () { }); }
    if (act === "dest" && o) this.manualDispatch(a, o.text, btn);
    if (act === "edit") { this.editing = !this.editing; this.renderAgent(); if (this.editing) this.bindEditor(); }
    if (act === "save") {
      a.name = document.getElementById("atEdName").value.trim() || a.name; a.desc = document.getElementById("atEdDesc").value.trim();
      a.instructions = document.getElementById("atEdIns").value;
      a.inputs = Array.from(document.querySelectorAll("[data-edin]")).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-edin"); });
      a.context = [document.getElementById("atEdBible").checked ? "bible" : "", document.getElementById("atEdLib").checked ? "library" : "", document.getElementById("atEdSkills").checked ? "skills" : "", document.getElementById("atEdStory").checked ? "storyboard" : ""].filter(Boolean);
      a.dest = document.getElementById("atEdDest").value;
      a.model = document.getElementById("atEdModel").value.trim();
      var tv = document.getElementById("atEdTemp").value; a.temperature = tv === "" ? null : App_clamp(tv, 0, 1.5);
      a.maxTokens = Number(document.getElementById("atEdMax").value) || null;
      this.saveAgents(); this.editing = false; this.renderAll(); core.toast("Agent enregistré.", "ok");
    }
    if (act === "reset") {
      var d = this.DEFAULT_AGENTS.find(function (x) { return x.id === a.id; });
      if (d && window.confirm("Remettre les consignes par défaut de cet agent ?")) { Object.assign(a, JSON.parse(JSON.stringify(d))); this.saveAgents(); this.renderAgent(); this.bindEditor(); }
    }
    if (act === "export") core.download(new Blob([JSON.stringify(this.agents.map(function (x) { var y = Object.assign({}, x); delete y._running; return y; }), null, 2)], { type: "application/json" }), "equipe-atelier.json");
  },
  bindEditor: function () { },
  // =========================================================
  // IMPORT D'AGENTS (RMAOPN AI ou export de l'Atelier)
  // =========================================================
  // Agent RMAOPN : { name, desc, instructions, primer, style, forbidden, temperature, maxTokens, modelPref, tags }
  fromRmaopn: function (x) {
    var parts = [String(x.instructions || "").trim()];
    if (x.primer) parts.push("Entrée en matière : " + x.primer);
    if (x.style) parts.push("Style de réponse : " + x.style);
    if (x.forbidden) parts.push("Interdits : " + x.forbidden);
    return { name: String(x.name || "").trim(), desc: String(x.desc || "").trim(), instructions: parts.filter(Boolean).join("\n\n") || String(x.desc || ""),
      model: x.modelPref || "", temperature: x.temperature != null ? Number(x.temperature) : null, maxTokens: x.maxTokens || null };
  },
  // Devine l'emplacement dans la chaîne : numéro en tête (« 8. », « Gem 8 — »), sinon mots du nom
  guessSlot: function (name) {
    var n = String(name).match(/^\s*(?:gem\s*)?(\d{1,2})\b/i);
    if (n && this.agent("a" + parseInt(n[1], 10))) return "a" + parseInt(n[1], 10);
    var norm = function (t) { return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " "); };
    var words = norm(name).split(/\s+/).filter(function (w) { return w.length > 3; }), best = "", score = 0;
    this.agents.forEach(function (a) {
      var t = norm(a.name + " " + a.desc), sc = words.filter(function (w) { return t.indexOf(w) !== -1; }).length;
      if (sc > score) { score = sc; best = a.id; }
    });
    return score >= 2 || (score === 1 && words.length <= 2) ? best : "new";
  },
  readImport: function (files) {
    var self = this, found = [];
    Promise.all(files.map(function (f) { return f.text().then(function (t) { return { name: f.name, json: JSON.parse(t) }; }, function () { return null; }); }))
      .then(function (list) {
        list.forEach(function (it) {
          if (!it) return;
          var j = it.json;
          if (Array.isArray(j) && j.length && j[0].instructions !== undefined && j[0].dest !== undefined) {   // export de l'Atelier
            self.agents = self.mergeAgents(j.filter(function (x) { return x && x.id && x.name; })); self.saveAgents(); self.renderAll();
            self.core.toast("Équipe de l'Atelier importée (" + j.length + " agents).", "ok"); return;
          }
          var arr = j && j.data && Array.isArray(j.data.agents) ? j.data.agents : Array.isArray(j.agents) ? j.agents : Array.isArray(j) ? j : j && j.name ? [j] : [];
          arr.forEach(function (x) { if (x && x.name) found.push(self.fromRmaopn(x)); });
        });
        if (!found.length) { if (!list.some(function (x) { return x && Array.isArray(x.json) && x.json[0] && x.json[0].dest !== undefined; })) self.core.toast("Aucun agent trouvé dans ce(s) fichier(s).", "err"); return; }
        found.sort(function (a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true }); });
        self.imp = found.map(function (x) { return { agent: x, slot: self.guessSlot(x.name), on: true }; });
        self.renderImport();
      });
  },
  renderImport: function () {
    var self = this, box = document.getElementById("atImportBox"), esc = window.AgnesApp.esc;
    if (!this.imp) { box.innerHTML = ""; return; }
    var opts = this.ordered().map(function (a) { return [a.id, "remplace « " + a.num + ". " + a.name + " »"]; }).concat([["new", "➕ nouvel agent"]]);
    box.innerHTML = '<div class="refs-block" style="margin-top:10px"><b>' + this.imp.length + ' agent(s) trouvé(s)</b>' +
      '<p class="hint" style="margin:4px 0 8px">Choisissez la place de chacun. « Remplace » garde les entrées et la destination de la chaîne, et reprend les consignes, le modèle, la créativité et la longueur de l\'agent importé.</p>' +
      this.imp.map(function (r, i) {
        return '<div class="row-inline" style="margin-bottom:4px"><input type="checkbox" data-impon="' + i + '"' + (r.on ? " checked" : "") + '>' +
          '<span style="min-width:220px" title="' + esc(r.agent.desc) + '">' + esc(r.agent.name) + '</span>' +
          '<select data-impslot="' + i + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (r.slot === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select></div>';
      }).join("") +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" data-imp="apply">Importer</button><button class="small-btn" data-imp="cancel">Annuler</button></div></div>';
    box.querySelectorAll("[data-impon]").forEach(function (c) { c.onchange = function () { self.imp[+c.getAttribute("data-impon")].on = c.checked; }; });
    box.querySelectorAll("[data-impslot]").forEach(function (c) { c.onchange = function () { self.imp[+c.getAttribute("data-impslot")].slot = c.value; }; });
  },
  applyImport: function () {
    var self = this, rows = (this.imp || []).filter(function (r) { return r.on; }), used = {}, replaced = 0, added = 0;
    var dup = rows.filter(function (r) { if (r.slot === "new") return false; if (used[r.slot]) return true; used[r.slot] = 1; return false; });
    if (dup.length) { this.core.toast("Deux agents importés visent la même place : corrigez avant d'importer.", "err"); return; }
    rows.forEach(function (r) {
      var x = r.agent;
      if (r.slot !== "new") {
        var a = self.agent(r.slot);
        Object.assign(a, { name: x.name.replace(/^\s*(?:gem\s*)?\d{1,2}\s*[.—–:-]*\s*/i, "") || a.name, desc: x.desc || a.desc, instructions: x.instructions, model: x.model, temperature: x.temperature, maxTokens: x.maxTokens, imported: true });
        replaced++;
      } else {
        var nums = self.agents.map(function (a) { return +a.num || 0; }), num = Math.max.apply(null, nums.concat([15])) + 1;
        self.agents.push({ id: "x" + window.AgnesApp.uid().slice(0, 8), num: String(num), name: x.name, desc: x.desc, instructions: x.instructions, inputs: [], context: [], dest: "none",
          model: x.model, temperature: x.temperature, maxTokens: x.maxTokens, imported: true });
        added++;
      }
    });
    this.imp = null; this.saveAgents(); this.renderImport(); this.renderAll();
    this.core.toast("Import terminé : " + replaced + " agent(s) remplacé(s), " + added + " ajouté(s).", "ok");
  },

  // Rangement manuel (sans passer par le chef) — toujours avec confirmation
  manualDispatch: function (a, text, btn) {
    var self = this, core = this.core;
    try {
      if (a.dest === "scenario") { if (window.confirm("Envoyer ce scénario dans l'onglet Scénario ?")) core.toast(this.toScenario(text), "ok"); return; }
      if (a.dest === "lot") { if (window.confirm("Envoyer ce script dans Le lot ?")) core.toast(this.toLot(text), "ok"); return; }
      if (a.dest === "storyboard") {
        var plans = this.parsePlans(text);
        if (!plans.length) { core.toast("Aucun bloc « PLAN n » dans ce texte.", "err"); return; }
        if (window.confirm("Écrire les prompts de " + plans.length + " carte(s) du Storyboard (" + plans.map(function (x) { return "#" + x.plan; }).join(", ") + ") ?")) core.toast(this.applyPlans(plans), "ok");
        return;
      }
      if (a.dest === "publication") {
        var f = this.parsePublication(text);
        if (!Object.keys(f).length) { core.toast("Bloc « FICHE PUBLICATION » introuvable dans le texte.", "err"); return; }
        if (window.confirm("Remplir la fiche Publication ?\n\n" + Object.keys(f).map(function (k) { return k + " : " + f[k]; }).join("\n"))) core.toast(this.toPublication(f), "ok");
        return;
      }
      if (a.dest === "bible-perso" || a.dest === "bible-serie") {
        btn.disabled = true; btn.textContent = "Extraction des fiches…";
        this.extractBible(text).then(function (r) {
          var list = r.entries.map(function (e) { return "• " + e.name + " (" + (e.kind || "personnage") + ")" + (e.dna ? " — " + e.dna.slice(0, 90) : ""); }).join("\n");
          if (!r.entries.length && !r.style) { core.toast("Aucune fiche trouvée dans ce texte.", "err"); return; }
          if (window.confirm("Ranger dans la Bible ?\n\n" + (r.style ? "Style commun : " + r.style + "\n" : "") + list)) core.toast(self.bibleUpsert(r.entries, r.style), "ok");
        }).catch(function (e) { core.toast(e.display || e.message || e, "err"); }).finally(function () { self.renderAgent(); });
      }
    } catch (e) { core.toast(e.display || e.message || e, "err"); }
  }
});
