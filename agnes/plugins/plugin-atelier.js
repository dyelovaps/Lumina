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
      var b = e.target.closest("[data-auth]"); if (!b || !self.pending) return;
      self.resolvePending(b.getAttribute("data-auth"));
    });
  },

  // =========================================================
  // L'ÉQUIPE (consignes par défaut, modifiables ; collez-y vos consignes de Gems)
  // =========================================================
  COMMON: "Tu fais partie de l'équipe de production d'Agnes Studio Pro, une app qui produit des séries courtes générées par IA " +
    "(format vertical TikTok/Reels ; images par Agnes Image 2.5 ou ChatGPT, vidéos de 4 à 12 s par Agnes Video 2.5 ou Grok). " +
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
    var messages = [{ role: "system", content: a.instructions + "\n\n" + this.COMMON }, { role: "user", content: this.buildUserMessage(a, request) }];
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
      var e = B.addEntry(String(x.name).trim(), kind);
      if (x.dna) e.dna = String(x.dna).trim();
      if (x.aliases) e.aliases = String(x.aliases).trim();
      if (x.episode_note) { e.byProject = e.byProject || {}; e.byProject[proj.id] = String(x.episode_note).trim(); }
      done.push(e.name);
    });
    B.persist();
    return done.length ? "Bible mise à jour : " + done.join(", ") + "." : "Rien à ranger.";
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
        entries: { type: "array", items: { type: "object", properties: { name: { type: "string" }, kind: { type: "string", enum: ["personnage", "lieu", "objet", "costume"] }, aliases: { type: "string" }, dna: { type: "string", description: "ADN visuel en anglais" }, episode_note: { type: "string", description: "Changement propre à cet épisode (facultatif)" } }, required: ["name", "kind"] } } } } } },
    { type: "function", function: { name: "send_to_scenario", description: "Place un scénario (format INT./EXT., NOM en majuscules, répliques) dans l'onglet Scénario et lance l'analyse. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
    { type: "function", function: { name: "send_to_lot", description: "Place un script numéroté (01 — libellé / IMAGE : / VIDÉO : / RÉF :) dans Le lot pour créer les cartes du Storyboard. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { script: { type: "string" } }, required: ["script"] } } },
    { type: "function", function: { name: "get_storyboard", description: "Lit les cartes du Storyboard : numéro, mode, format, prompts actuels, références et skills cochés (lecture seule, sans autorisation).",
      parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "update_shots", description: "Écrit les prompts dans les cartes du Storyboard. Le plus sûr : agent_id = l'agent qui a produit des blocs « PLAN n / IMAGE : / VIDÉO : » (ex. a16), appliqués tels quels. Sinon plans = liste explicite. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { agent_id: { type: "string", description: "Agent dont le travail contient les blocs PLAN (ex. a16)" },
        plans: { type: "array", items: { type: "object", properties: { plan: { type: "number", description: "Numéro de la carte (#N)" }, image_prompt: { type: "string" }, video_prompt: { type: "string" } }, required: ["plan"] } } } } } },
    { type: "function", function: { name: "create_agent", description: "Crée un nouvel agent dans l'équipe quand aucun agent existant ne convient. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { name: { type: "string" }, desc: { type: "string", description: "Rôle en une phrase" },
        instructions: { type: "string", description: "Consignes complètes : rôle, méthode, format de sortie exact" },
        inputs: { type: "array", items: { type: "string" }, description: "Identifiants des agents dont il lit le travail (ex. a3, a5)" },
        context: { type: "array", items: { type: "string", enum: ["bible", "library", "skills", "storyboard"] } },
        dest: { type: "string", enum: ["none", "bible-serie", "bible-perso", "scenario", "lot", "publication", "storyboard"] } }, required: ["name", "desc", "instructions"] } } },
    { type: "function", function: { name: "set_publication", description: "Remplit la fiche de l'onglet Publication. Nécessite l'autorisation.",
      parameters: { type: "object", properties: { serie: { type: "string" }, episode: { type: "number" }, titre: { type: "string" }, accroche: { type: "string" }, resume: { type: "string" }, hashtags: { type: "string" }, appel: { type: "string" } } } } }
  ],
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
      "RÈGLES\n- Tu n'écris pas toi-même le contenu créatif : tu le confies à l'agent compétent (run_agent), avec une consigne précise.\n" +
      "- Respecte l'ordre de la chaîne : un agent ne travaille que si ses entrées existent. Propose l'étape suivante logique.\n" +
      "- Pour ranger dans l'app, lis d'abord le travail (get_output), puis utilise l'outil de destination avec le contenu exact, sans le réécrire (sauf pour extraire les fiches de la Bible).\n" +
      "- Chaque action qui modifie l'app est soumise à l'autorisation de l'utilisateur : ne la présente jamais comme déjà faite avant le résultat de l'outil.\n" +
      "- Un seul épisode à la fois pour les étapes 5 à 15, sauf demande contraire.\n" +
      "- Quand l'utilisateur parle d'un document, lis-le avec get_document avant de décider. Pour qu'un agent le lise, il suffit qu'il soit destiné à cet agent ou à « tous » ; sinon cite l'essentiel dans la consigne de run_agent.\n" +
      "- Les messages « ▸ N. Agent a terminé » viennent d'appels directs de l'utilisateur (@N) : tiens-en compte.\n" +
      "- Prompts des cartes du Storyboard (« prompt parfait », placement des personnages, angle, voiture…) : confie-les à a16 (Directeur de plans) en précisant les numéros de cartes et la demande de l'utilisateur, puis applique son travail avec update_shots en donnant agent_id \"a16\" (sans recopier les prompts).\n" +
      "- Si aucun agent ne convient à la demande, propose d'en créer un avec create_agent (consignes complètes, format de sortie, entrées et contexte utiles), puis lance-le. N'en crée pas un qui double un agent existant.\n\n" +
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
  NEEDS_AUTH: { run_agent: true, bible_upsert: true, send_to_scenario: true, send_to_lot: true, set_publication: true, update_shots: true, create_agent: true },
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
      if (auto || !self.NEEDS_AUTH[c.name]) go(true);
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
      case "send_to_scenario": return "Envoyer le scénario dans l'onglet Scénario";
      case "send_to_lot": return "Envoyer le storyboard dans Le lot (" + ((String(a.script || "").match(/^\s*\d{1,4}\b/mg) || []).length) + " plans)";
      case "set_publication": return "Remplir la fiche Publication";
      case "get_storyboard": return "Lire les cartes du Storyboard";
      case "update_shots": {
        var n = a.agent_id ? this.parsePlans(this.outputOf(a.agent_id)).length : (a.plans || []).length;
        return "Écrire les prompts de " + n + " carte(s) du Storyboard" + (ag ? " (travail de « " + ag.name + " »)" : "");
      }
      case "create_agent": return "Créer l'agent « " + (a.name || "?") + " » — " + (a.desc || "");
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
      case "send_to_scenario": return this.toScenario(a.text || "");
      case "send_to_lot": return this.toLot(a.script || "");
      case "set_publication": return this.toPublication(a);
      case "get_storyboard": return this.storyboardText();
      case "update_shots": {
        var plans = a.agent_id ? this.parsePlans(this.outputOf(a.agent_id)) : a.plans;
        if (!plans || !plans.length) return "Aucun bloc « PLAN n » trouvé" + (a.agent_id ? " dans le travail de " + a.agent_id : "") + ".";
        return this.applyPlans(plans);
      }
      case "create_agent": return this.createAgent(a);
    }
    return "Outil inconnu.";
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
  DOC_BUDGET: 60000,   // caractères de documents envoyés au maximum dans une requête d'agent
  doc: function (id) { return (this.project().docs || []).find(function (d) { return d.id === id; }); },
  addDoc: function (name, content, source) {
    var st = this.project(), text = String(content || "").replace(/\r/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
    if (!text) { this.core.toast("« " + name + " » est vide.", "err"); return; }
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
  md: function (text) {
    var esc = window.AgnesApp.esc, codes = [];
    var t = String(text || "").replace(/\r/g, "").replace(/```[^\n]*\n([\s\S]*?)```/g, function (_, c) { codes.push(c.replace(/\n$/, "")); return "\u0000" + (codes.length - 1) + "\u0000"; });
    var inline = function (s) {
      return esc(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, function (_, a, b) { return "<strong>" + (a || b) + "</strong>"; })
        .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)|(^|[^_\w])_([^_\n]+)_(?!\w)/g, function (_, p1, a, p2, b) { return (p1 || p2 || "") + "<em>" + (a || b) + "</em>"; })
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    };
    var lines = t.split("\n"), out = [], i = 0, para = [];
    var flush = function () { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    var cells = function (l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^\u0000\d+\u0000$/.test(l.trim())) { flush(); out.push("<pre><code>" + esc(codes[+l.trim().slice(1, -1)]) + "</code></pre>"); i++; continue; }
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
      var c = this.pending.call, preview = c.name === "run_agent" ? c.args.request : c.name === "bible_upsert" ? (c.args.entries || []).map(function (e) { return e.name + (e.dna ? " — " + e.dna : ""); }).join("\n") + (c.args.series_style ? "\nStyle : " + c.args.series_style : "")
        : c.name === "send_to_lot" ? c.args.script : c.name === "send_to_scenario" ? c.args.text : JSON.stringify(c.args, null, 1);
      html += '<div class="at-auth"><b>Autorisation demandée :</b> ' + esc(this.describe(c)) +
        '<pre>' + esc(String(preview || "").slice(0, 1500)) + (String(preview || "").length > 1500 ? "\n…" : "") + '</pre>' +
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
