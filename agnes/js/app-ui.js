// js/app-ui.js — onglets, storyboard, sélection multiple, visionneuse, réglages, projet
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId, esc = A.esc;
  A.selection = new Set();

  // =========================================================
  // ONGLETS
  // =========================================================
  A.showView = function (viewId) {
    document.querySelectorAll("#tabBar .tab").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-view") === viewId));
    });
    document.querySelectorAll(".shell > .view").forEach(function (v) { v.classList.toggle("active", v.id === viewId); });
    if (viewId === "viewQueue") A.renderQueue();
    if (viewId === "viewMontage") A.renderMontage();
    if (viewId === "viewProject") { renderProjectManageList(); renderStorageInfo(); }
    if (viewId === "viewLibrary") A.renderLibrary();
    if (viewId === "viewSkills") A.renderSkills();
    AgnesCore.emit("view:change", viewId);
  };
  A.bindTab = function (btn) {
    btn.addEventListener("click", function () { A.showView(btn.getAttribute("data-view")); });
  };

  // =========================================================
  // RENDU GLOBAL
  // =========================================================
  A.render = function () {
    renderProjectSelect();
    fillProjectForm();
    A.renderShots();
    A.renderLibrary && A.renderLibrary();
    A.renderSkills && A.renderSkills();
    A.refreshPickers && A.refreshPickers();
    A.renderQueue();
    if (byId("viewMontage").classList.contains("active")) A.renderMontage();
    AgnesCore.emit("render", null);
  };

  // =========================================================
  // PROJETS
  // =========================================================
  function renderProjectSelect() {
    var sel = byId("projectSelect");
    sel.innerHTML = Object.keys(A.db.projects)
      .sort(function (a, b) { return A.db.projects[b].updatedAt - A.db.projects[a].updatedAt; })
      .map(function (id) { return '<option value="' + id + '"' + (id === A.db.currentProjectId ? " selected" : "") + '>' + esc(A.db.projects[id].name) + '</option>'; })
      .join("");
  }
  A.switchProject = function (id) { switchProject(id); };
  function switchProject(id) { A.db.currentProjectId = id; A.selection.clear(); A.saveDB(); A.render(); A.refreshToolDefaults(); AgnesCore.emit("project:change", A.getProject()); }
  function renderProjectManageList() {
    var wrap = byId("projectManageList");
    wrap.innerHTML = Object.keys(A.db.projects)
      .sort(function (a, b) { return A.db.projects[b].updatedAt - A.db.projects[a].updatedAt; })
      .map(function (id) {
        var p = A.db.projects[id], cur = id === A.db.currentProjectId;
        return '<div class="row-inline" style="justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--edge-soft);">' +
          '<span style="font-size:13px;' + (cur ? 'color:var(--silver);font-weight:600;' : '') + '">' + esc(p.name) + '</span>' +
          '<span class="hint" style="margin:0;">' + p.shots.length + ' plan(s) · ' + p.library.length + ' ingrédient(s)</span>' +
          '<button class="small-btn" data-proj="' + id + '"' + (cur ? " disabled" : "") + '>' + (cur ? "Actif" : "Activer") + '</button></div>';
      }).join("");
  }
  function fillProjectForm() {
    var p = A.getProject();
    byId("projName").value = p.name; byId("projStyle").value = p.styleGuide || ""; byId("projNegative").value = p.negative || "";
    byId("projAspect").innerHTML = A.optionsHtml(A.ASPECTS, p.aspect);
    byId("projRes").innerHTML = A.optionsHtml(A.RESOLUTIONS, p.resolution);
    byId("projSeed").value = p.seed || ""; byId("projDuration").value = p.duration || 5; byId("projOutputs").value = p.outputs || 1;
    byId("projFps").value = p.fps || 24; byId("projConcurrency").value = p.concurrency || 1; byId("qConcurrency").value = p.concurrency || 1;
  }
  function renderStorageInfo() {
    AgnesStore.estimate().then(function (est) {
      var txt = AgnesStore.isMemoryOnly() ? "Stockage du navigateur indisponible : les médias seront perdus à la fermeture. Exportez régulièrement en .zip." :
        "Les médias (prises, ingrédients) sont enregistrés dans ce navigateur et survivent à la fermeture.";
      if (est && est.usage != null) txt += " Utilisé : " + (est.usage / 1048576).toFixed(0) + " Mo sur environ " + (est.quota / 1073741824).toFixed(1) + " Go disponibles.";
      byId("storageInfo").textContent = txt;
    });
  }

  // =========================================================
  // STORYBOARD — cartes de plans
  // =========================================================
  var STATUS = { idle: "prêt", queued: "en file", running: "en cours", done: "terminé", error: "échec", resume: "reprise", review: "image à valider" };

  function libOptions(proj, selected, allowPrev, placeholder) {
    var html = '<option value="">' + esc(placeholder) + '</option>';
    if (allowPrev) html += '<option value="' + A.PREV_REF + '"' + (selected === A.PREV_REF ? " selected" : "") + '>↳ Dernière image du plan précédent</option>';
    proj.library.forEach(function (l) {
      html += '<option value="' + l.id + '"' + (l.id === selected ? " selected" : "") + '>' + esc(l.name) + (l.missing ? " (à réimporter)" : "") + '</option>';
    });
    return html;
  }
  function skillsFor(kind) {
    return A.db.skills.filter(function (s) { return s.target === "both" || s.target === kind; });
  }
  A.skillOptionsHtml = function (kind, placeholder) {
    var byCat = {};
    skillsFor(kind || "both").forEach(function (s) {
      var c = (s.categories && s.categories[0]) || "Autres"; (byCat[c] = byCat[c] || []).push(s);
    });
    return '<option value="">' + esc(placeholder || "+ Ajouter un skill") + '</option>' + Object.keys(byCat).sort().map(function (c) {
      return '<optgroup label="' + esc(c) + '">' + byCat[c].map(function (s) { return '<option value="' + s.id + '">' + esc(s.title) + '</option>'; }).join("") + '</optgroup>';
    }).join("");
  };

  function refsHtml(shot, proj) {
    var m = shot.mode, empty = !proj.library.length;
    var hint = empty ? '<span class="hint" style="margin:0;">Ajoutez des images dans la Bibliothèque pour les utiliser ici.</span>' : "";
    if (m === "i2v") {
      var strat = shot.i2v || "standard", tips = {
        standard: "L'image sert de première image ; la suite est libre. À réserver aux plans où le mouvement compte plus que la fidélité.",
        anchor: "Le rendu part de l'image et y revient : l'IA ne peut presque rien inventer. Idéal pour les dialogues et les plans où le personnage bouge peu.",
        refs: "L'image fixe la scène, les références ci-dessous fixent le visage et la tenue des personnages (vos fiches, votre Bible)."
      };
      return '<div class="refs-row"><select data-f="sourceRef">' + libOptions(proj, shot.sourceRef, true, "Image de la scène — choisir") + '</select>' + hint + '</div>' +
        '<div class="refs-row"><select data-f="i2v" title="Comment tenir la scène">' + A.optionsHtml(A.I2V_STRATEGIES, strat) + '</select>' +
        '<select data-f="motion" title="Amplitude du mouvement">' + A.optionsHtml(A.MOTIONS, shot.motion || "subtle") + '</select></div>' +
        '<p class="hint" style="margin:4px 0 0">' + esc(tips[strat]) + '</p>' +
        (strat === "refs" ? refsBlock(shot, proj) : lockHtml(shot));
    }
    if (m === "i2i") {
      return '<div class="refs-row"><select data-f="sourceRef">' + libOptions(proj, shot.sourceRef, true, "Image source — choisir") + '</select></div>' + refsBlock(shot, proj);
    }
    if (m === "frames") {
      return '<div class="refs-row"><select data-f="startRef">' + libOptions(proj, shot.startRef, true, "Première frame — choisir") + '</select>' +
        '<select data-f="endRef">' + libOptions(proj, shot.endRef, false, "Dernière frame — choisir") + '</select>' + hint + '</div>';
    }
    if (m === "frames") return lockHtml(shot);
    return A.usesRefs(m, shot) ? refsBlock(shot, proj) : "";
  }
  // Texte → Image → Vidéo : image de départ (variantes à choisir) puis animation
  function keyBlock(shot) {
    var keys = shot.keyTakes || [], cur = A.keyTake(shot), busy = ["queued", "running", "resume"].indexOf(shot.status) !== -1;
    var strat = shot.i2v || "anchor";
    var minis = keys.map(function (t, i) {
      return '<button type="button" class="take-mini' + (cur && t.id === cur.id ? " active" : "") + '" data-act="keytake" data-take="' + t.id + '" title="Image ' + (i + 1) + (A.engineOf(t) ? " (" + A.engineOf(t) + ")" : "") + ' — cliquer pour la choisir">' +
        (t.thumb ? '<img src="' + t.thumb + '" alt="Image ' + (i + 1) + '">' : (i + 1)) + '</button>';
    }).join("");
    return '<div class="refs-block key-block"><div class="refs-head"><span class="refs-title">Image de départ ' +
      (cur ? '<span class="ext-tag ok">' + (keys.indexOf(cur) + 1) + '/' + keys.length + ' choisie</span>' : '<span class="ext-tag">à générer</span>') + '</span>' +
      '<label class="inline">Variantes <input type="number" class="mini" data-f="keyOutputs" min="1" max="4" value="' + esc(shot.keyOutputs || 2) + '"></label></div>' +
      (keys.length ? '<div class="takes" style="margin-top:6px">' + minis + '</div>' : '<p class="hint" style="margin:4px 0 0">Générée avec le prompt image et les références ci-dessous. Vous choisissez la meilleure, puis vous l\'animez avec le prompt vidéo.</p>') +
      '<div class="refs-row" style="margin-top:8px"><select data-f="i2v" title="Comment tenir la scène pendant l\'animation">' + A.optionsHtml(A.I2V_STRATEGIES, strat) + '</select>' +
      '<select data-f="motion" title="Amplitude du mouvement">' + A.optionsHtml(A.MOTIONS, shot.motion || "subtle") + '</select></div>' +
      '<div class="row-inline" style="margin-top:8px">' +
      '<button class="small-btn" data-act="genkey"' + (busy ? " disabled" : "") + '>' + (keys.length ? "Nouvelle image" : "Générer l'image") + '</button>' +
      '<button class="small-btn" data-act="animate"' + (busy || !cur ? " disabled" : "") + '>Animer cette image →</button>' +
      (cur ? '<button class="small-btn" data-act="viewkey">Agrandir</button><button class="small-btn" data-act="delkey">Supprimer l\'image</button>' : '') +
      '<label class="inline" title="Sinon, le plan s\'arrête sur « image à valider »"><input type="checkbox" data-f="autoAnimate"' + (shot.autoAnimate ? " checked" : "") + '> Animer sans attendre ma validation</label></div></div>';
  }
  function lockHtml(shot) {
    return '<label class="lock-row" title="Ajoute au prompt : même visage, même tenue, un seul plan continu sans coupe ni transformation"><input type="checkbox" data-f="lock"' + (shot.lock !== false ? " checked" : "") + '> Verrou d\'identité (même personnage du début à la fin, sans coupe)</label>';
  }
  // Bloc « Références » : personnages, lieux, objets de la bibliothèque, envoyés à Agnes avec le prompt
  function refsBlock(shot, proj) {
    var sel = shot.ingredients || [], max = A.settings.maxRefs || 5, order = { personnage: 0, decor: 1, objet: 2, style: 3, autre: 4, source: 5 };
    var kindLabel = {}; A.LIB_KINDS.forEach(function (k) { kindLabel[k[0]] = k[1]; });
    var lib = proj.library.slice().sort(function (a, b) { return (order[a.kind] || 9) - (order[b.kind] || 9) || String(a.name).localeCompare(b.name); });
    var chips = lib.map(function (l) {
      var on = sel.indexOf(l.id) !== -1;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-act="ingr" data-lib="' + l.id + '" title="' + esc(kindLabel[l.kind] || "") + ' — ' + esc(l.name) + '">' +
        (l.thumb ? '<img src="' + l.thumb + '" alt="">' : '') + esc(l.name) + (on ? ' <span class="x">✓</span>' : '') + '</button>';
    }).join("");
    var sources = AgnesCore._refSources.map(function (r, i) { return '<button type="button" class="small-btn" data-act="refsrc" data-i="' + i + '">' + esc(r.label) + '</button>'; }).join("");
    var needed = shot.mode === "ingr_i" || shot.mode === "ingr_v";
    return '<div class="refs-block"><div class="refs-head"><span class="refs-title">Références — personnages, lieux, objets <span class="ext-tag' + (sel.length ? " ok" : "") + '">' + sel.length + '/' + max + '</span></span>' +
      '<label class="small-btn" style="cursor:pointer">+ Importer<input type="file" data-f="addref" accept="image/*" multiple hidden></label>' + sources + '</div>' +
      (lib.length ? '<div class="chips">' + chips + '</div>'
        : '<p class="hint" style="margin:6px 0 0">Importez ici une image de votre personnage ou de votre lieu' + (needed ? " (au moins une est nécessaire dans ce mode)" : "") + ' : elle sera envoyée à Agnes pour garder le même visage et le même décor.</p>') +
      lockHtml(shot) + '</div>';
  }

  function shotCardHtml(shot, idx, proj) {
    var kind = A.modeKind(shot.mode), take = A.selectedTake(shot), sel = A.selection.has(shot.id);
    var badge = { running: "running", done: "done", error: "error", queued: "running", resume: "running" }[shot.status] || "";
    var thumb = '<span class="ph">Aucun rendu</span>', two = A.isTwoStep(shot), keyT = two ? A.keyTake(shot) : null;
    var by = function (t) { var e = A.engineOf(t); return e ? " · " + e : ""; };
    if (two && !take && keyT && keyT.thumb) thumb = '<img src="' + keyT.thumb + '" alt="Image de départ"><span class="take-kind">image de départ' + by(keyT) + '</span>';
    if (shot.status === "running" || shot.status === "resume") thumb = '<span class="spinner"></span>';
    else if (take && !take.thumb) thumb = (take.kind === "video"
        ? '<video data-live="' + take.id + '" muted playsinline preload="metadata" aria-label="Rendu du plan ' + (idx + 1) + '"></video>'
        : '<img data-live="' + take.id + '" alt="Rendu du plan ' + (idx + 1) + '">') +
      '<span class="take-kind">' + (take.kind === "video" ? "▶ vidéo" : "image") + by(take) + (take.local ? "" : " · en ligne") + '</span>';
    else if (take && take.thumb) thumb = '<img src="' + take.thumb + '" alt="Rendu du plan ' + (idx + 1) + '"><span class="take-kind">' + (take.kind === "video" ? "▶ vidéo" : "image") + by(take) + (shot.takes.length > 1 ? " · " + (shot.takes.indexOf(take) + 1) + "/" + shot.takes.length : "") + '</span>';
    var takes = shot.takes && shot.takes.length > 1 ? '<div class="takes">' + shot.takes.map(function (t, i) {
      return '<button class="take-mini' + (take && t.id === take.id ? " active" : "") + '" data-act="take" data-take="' + t.id + '" title="Prise ' + (i + 1) + by(t) + '">' +
        (t.thumb ? '<img src="' + t.thumb + '" alt="Prise ' + (i + 1) + '">' : (i + 1)) + '</button>';
    }).join("") + '</div>' : "";
    var skillChips = (shot.skills || []).map(function (id) {
      var s = A.db.skills.find(function (x) { return x.id === id; }); if (!s) return "";
      var off = !(s.target === "both" || s.target === kind);
      return '<button type="button" class="chip skill on" data-act="rmskill" data-skill="' + id + '" title="' + esc(s.description || s.action) + (off ? " — ignoré pour ce mode" : "") + '"' + (off ? ' style="opacity:.5"' : '') + '>' + esc(s.title) + '<span class="x">✕</span></button>';
    }).join("");
    var running = ["queued", "running", "resume"].indexOf(shot.status) !== -1;
    var runLabel = shot.takes && shot.takes.length ? "Regénérer" : "Générer";
    if (two) runLabel = !keyT ? "Générer l'image" : (shot.takes && shot.takes.length ? "Regénérer la vidéo" : "Animer l'image");
    var acts = '<button class="primary-btn" data-act="run"' + (running ? " disabled" : "") + '>' + runLabel + '</button>';
    if (running) acts += '<button class="small-btn" data-act="cancel">Annuler</button>';
    if (take) {
      acts += '<button class="small-btn" data-act="dl">Télécharger</button>';
      if (take.kind === "image") acts += '<button class="small-btn convert-btn" data-act="convert"' + (running ? " disabled" : "") + ' title="Garde cette image et transforme la carte en plan vidéo : il ne reste qu\'à écrire le mouvement">🎬 Convertir (vidéo)</button><button class="small-btn" data-act="tolib">→ Bibliothèque</button>';
      else acts += '<button class="small-btn" data-act="dl1080" title="Agrandit la vidéo en 1080p (bicubique + netteté, sur la carte graphique) puis la télécharge. Prend le temps de la vidéo.">⬇ 1080p</button>' +
        '<button class="small-btn" data-act="first">1re image → Bibliothèque</button><button class="small-btn" data-act="last">Dernière image → Bibliothèque</button>';
      acts += '<button class="small-btn" data-act="deltake">Supprimer la prise</button>';
      if (!take.local && take.remoteUrl) acts += '<button class="small-btn" data-act="repair" title="Le fichier n\'a pas pu être enregistré dans l\'app : l\'Assemblage et le kit ne peuvent pas l\'utiliser">⟳ Récupérer le fichier</button>';
    }
    if (shot.status === "error" && (shot.remoteTasks || []).length) acts += '<button class="small-btn" data-act="resume" title="Interroge à nouveau Agnes pour la même tâche, sans relancer ni refacturer">⟳ Reprendre le suivi</button>';
    AgnesCore._shotActions.forEach(function (a, i) { acts += '<button class="small-btn" data-act="plugin" data-i="' + i + '">' + esc(a.label) + '</button>'; });

    return '<div class="shot-card' + (sel ? " selected" : "") + '" data-shot="' + shot.id + '">' +
      '<div class="shot-head"><div class="row-inline" style="gap:10px;">' +
      '<input type="checkbox" class="sel" data-act="sel"' + (sel ? " checked" : "") + ' aria-label="Sélectionner le plan ' + (idx + 1) + '">' +
      '<span class="shot-num">#' + (idx + 1) + '</span><span class="mode-badge">' + esc(A.MODE_LABEL(shot)) + '</span>' + A.cardEngineBadge(shot) +
      (shot.batchNo != null || shot.stillNo != null ? '<span class="mode-badge" title="Numéro dans le script ou le nom de l\'image">N° ' + String(shot.batchNo != null ? shot.batchNo : shot.stillNo).padStart(2, "0") + '</span>' : '') +
      '<span class="shot-badge ' + (shot.status === "review" ? "review" : badge) + '">' + STATUS[shot.status] + '</span>' +
      (shot.voice && shot.voice.key ? '<span class="mode-badge" title="' + esc(shot.voice.text || "Voix attachée") + '">🎙 voix</span>' : '') + '</div>' +
      '<div class="row-inline"><button class="small-btn" data-act="up" aria-label="Monter">↑</button><button class="small-btn" data-act="down" aria-label="Descendre">↓</button>' +
      '<button class="small-btn" data-act="dup" title="Dupliquer le plan">Dupliquer</button><button class="small-btn" data-act="del" aria-label="Supprimer">🗑</button></div></div>' +
      '<div class="shot-body"><div><div class="shot-thumb" data-act="view">' + thumb + '</div>' + takes + '</div>' +
      '<div class="shot-fields">' +
      (shot.mode === "t2v"
        ? '<label class="prompt-label">Prompt image <span class="hint" style="margin:0">(facultatif : rempli, l\'image est générée d\'abord avec les références, puis animée)</span></label>' +
          '<textarea data-f="imagePrompt" class="prompt-img" placeholder="Ex. Léa, plan américain, derrière le comptoir, néon froid">' + esc(shot.imagePrompt || "") + '</textarea>' +
          '<label class="prompt-label">Prompt vidéo' + (two ? ' <span class="hint" style="margin:0">(décrivez le mouvement)</span>' : '') + '</label>'
        : '') +
      '<textarea data-f="prompt" placeholder="' + (shot.mode === "t2v" ? (two ? "Ex. elle lève lentement les yeux vers la caméra" : "Description du plan et du mouvement…") : "Description du plan…") + '">' + esc(shot.prompt) + '</textarea>' +
      '<div class="shot-row">' +
      '<select data-f="mode" aria-label="Mode">' + A.modeOptionsHtml(shot.mode) + '</select>' +
      '<select data-f="aspect" aria-label="Format">' + A.optionsHtml(A.ASPECTS, shot.aspect) + '</select>' +
      '<select data-f="resolution" aria-label="Résolution">' + A.optionsHtml(A.RESOLUTIONS, shot.resolution) + '</select>' +
      (kind === "video" ? '<label class="inline" title="' + (A.videoStyle() === "agnes25" ? "Agnes Video 2.5 : de 4 à 12 secondes" : "") + '">Durée <input type="number" class="mini" data-f="duration" min="' + A.videoSecondsRange()[0] + '" max="' + A.videoSecondsRange()[1] + '" value="' + esc(shot.duration) + '"> s</label>' : '') +
      '<label class="inline">Sorties <input type="number" class="mini" data-f="outputs" min="1" max="4" value="' + esc(shot.outputs || 1) + '"></label>' +
      '</div>' + (two ? keyBlock(shot) : '') + refsHtml(shot, proj) +
      '<div class="chips">' + skillChips + '<select data-f="addskill" style="width:auto;" aria-label="Ajouter un skill">' + A.skillOptionsHtml(kind) + '</select></div>' +
      '<details class="more-opts"><summary>Plus d\'options</summary><div class="grid3">' +
      '<div class="field"><label>Seed</label><input type="number" data-f="seed" value="' + esc(shot.seed || "") + '" placeholder="Projet : ' + esc(proj.seed || "aléatoire") + '"></div>' +
      '<div class="field"><label>Prompt négatif</label><input type="text" data-f="negative" value="' + esc(shot.negative || "") + '" placeholder="' + esc(proj.negative || "Aucun") + '"></div>' +
      (shot.mode === "i2i" ? '<div class="field"><label>Force de transformation (0–1)</label><input type="number" step="0.05" min="0" max="1" data-f="strength" value="' + esc(shot.strength || "") + '"></div>' : '') +
      '</div>' + (two
        ? '<p class="hint">Prompt image envoyé : ' + esc(A.buildPrompt(A.stageView(shot, "image"), proj)) + '</p><p class="hint">Prompt vidéo envoyé : ' + esc(A.buildPrompt(A.stageView(shot, "video"), proj)) + '</p>'
        : '<p class="hint">Prompt envoyé : ' + esc(A.buildPrompt(shot, proj)) + '</p>') + '</details>' +
      '<div class="shot-actions">' + acts + '</div>' +
      (shot.errorMsg ? '<div class="shot-error">' + esc(shot.errorMsg) + '</div>' : '') +
      (shot.lastRequest && A.modeKind(shot.mode) !== "image" ? A.debugBlock("Requête vidéo envoyée", shot.lastRequest) : '') +
      (shot.lastRaw ? A.debugBlock("Réponse brute", shot.lastRaw) : '') +
      '</div></div></div>';
  }

  A.renderShots = function () {
    var proj = A.getProject(), shots = A.sortedShots(proj);
    byId("shotCount").textContent = shots.length ? "(" + shots.length + ")" : "";
    byId("shotEmpty").style.display = shots.length ? "none" : "block";
    var done = shots.filter(function (s) { return s.status === "done"; }).length;
    byId("queueStats").textContent = shots.length ? done + " / " + shots.length + " plans terminés" : "";
    byId("queueProgressFill").style.width = shots.length ? Math.round(done / shots.length * 100) + "%" : "0%";
    // conserve l'état ouvert des « Plus d'options » et le focus
    var open = {}; document.querySelectorAll("#shotList .shot-card").forEach(function (c) {
      var d = c.querySelector("details.more-opts"); if (d && d.open) open[c.getAttribute("data-shot")] = true;
    });
    var active = document.activeElement, activeShot = active && active.closest && active.closest("[data-shot]"),
      activeField = active && active.getAttribute && active.getAttribute("data-f");
    var caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    byId("shotList").innerHTML = shots.map(function (s, i) { return shotCardHtml(s, i, proj); }).join("");
    Object.keys(open).forEach(function (id) { var d = document.querySelector('[data-shot="' + id + '"] details.more-opts'); if (d) d.open = true; });
    if (activeShot && activeField) {
      var el = document.querySelector('[data-shot="' + activeShot.getAttribute("data-shot") + '"] [data-f="' + activeField + '"]');
      if (el) { el.focus(); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) { } }
    }
    renderSelBar();
    fillLivePreviews(proj);
  };

  // Aperçu direct (vidéo/image lue depuis le fichier local ou l'URL d'Agnes) quand la miniature n'a pas pu être créée
  var healTried = new Set();
  function fillLivePreviews(proj) {
    document.querySelectorAll("#shotList [data-live]").forEach(function (el) {
      var id = el.getAttribute("data-live"), found = null;
      proj.shots.some(function (s) { var t = (s.takes || []).find(function (x) { return x.id === id; }); if (t) { found = { t: t, s: s }; return true; } });
      if (!found) return;
      A.getTakeSrc(found.t).then(function (u) {
        if (!u) return;
        el.onerror = function () { el.outerHTML = '<span class="ph">Aperçu impossible<br>(lien expiré ?)</span>'; };
        el.src = u + (el.tagName === "VIDEO" && u.indexOf("#") === -1 ? "#t=0.1" : "");
      });
      if (!healTried.has(id)) { healTried.add(id); A.repairTake(found.t, found.s, proj, false); }
    });
  }

  // Récupère le fichier d'une prise (pour l'Assemblage, le kit, les miniatures). verbose : explique l'échec
  A.repairTake = function (take, shot, proj, verbose) {
    proj = proj || A.getProject();
    function withBlob(b) {
      take.local = true;
      return AgnesStore.putBlob("take:" + take.id, b).then(function () {
        if (take.kind === "image") return A.makeThumb(b, 320);
        var u = URL.createObjectURL(b);
        return A.videoFrame(u, "first", 320).then(A.makeThumb).finally(function () { URL.revokeObjectURL(u); });
      }).catch(function () { return null; }).then(function (th) {
        if (th) take.thumb = th; A.forgetUrl("take:" + take.id); A.touch(proj); A.renderShots();
        if (verbose) A.toast("Fichier récupéré : il est maintenant utilisable partout (miniature, Assemblage, kit).", "ok");
      });
    }
    return AgnesStore.getBlob("take:" + take.id).then(function (local) {
      if (local) return withBlob(local);
      if (!take.remoteUrl) { if (verbose) A.toast("Aucun lien vers ce fichier.", "err"); return; }
      return fetch(take.remoteUrl).then(function (r) {
        if (!r.ok) throw { http: r.status };
        var ct = r.headers.get("content-type") || "";
        if (/text\/html|json/i.test(ct)) throw { notMedia: ct };
        return r.blob();
      }).then(withBlob).catch(function (e) {
        if (!verbose) return;
        var why = e && e.http ? (e.http === 403 || e.http === 404 || e.http === 410 ? "le lien a expiré ou est refusé (HTTP " + e.http + ")" : "le serveur répond HTTP " + e.http)
          : e && e.notMedia ? "l'adresse renvoyée par Agnes n'est pas une vidéo (" + e.notMedia + ") — regardez « Réponse brute »"
          : "le serveur des vidéos Agnes n'autorise pas le téléchargement direct depuis une page web (CORS)";
        showRepairPanel(take, shot, proj, why);
      });
    });
  };
  function showRepairPanel(take, shot, proj, why) {
    var pan = AgnesCore.ui.panel("repair-take", "Récupérer le fichier du plan");
    pan.body.innerHTML = '<p>Le rendu existe, mais l\'app n\'a pas pu l\'enregistrer : ' + esc(why) + '.</p>' +
      '<p class="hint">Sans fichier local, pas de miniature, et l\'Assemblage comme le kit FFmpeg ignorent ce plan. Solution : ouvrez le rendu, enregistrez-le sur votre ordinateur, puis joignez-le ici.</p>' +
      '<div class="row-inline"><a class="primary-btn" href="' + esc(take.remoteUrl) + '" target="_blank" rel="noopener">1. Ouvrir le rendu</a>' +
      '<label class="small-btn" style="cursor:pointer">2. Joindre le fichier enregistré<input type="file" accept="' + (take.kind === "video" ? "video/*" : "image/*") + '" hidden></label></div>' +
      '<p class="hint" style="margin-top:10px">Astuce : sur la vidéo ouverte, clic droit → « Enregistrer la vidéo sous… ».</p>';
    pan.body.querySelector("input[type=file]").onchange = function () {
      var f = this.files[0]; if (!f) return;
      pan.close();
      AgnesStore.putBlob("take:" + take.id, f).then(function () { return A.repairTake(take, shot, proj, true); });
    };
    pan.open();
  }

  function shotFromEvent(e) {
    var card = e.target.closest("[data-shot]"); if (!card) return null;
    return A.findShot(card.getAttribute("data-shot"));
  }
  var NUMERIC = ["duration", "outputs", "keyOutputs"];
  function onFieldInput(e) {
    var el = e.target, f = el.getAttribute("data-f"); if (!f) return;
    var shot = shotFromEvent(e); if (!shot) return;
    if (f === "addskill") return;
    shot[f] = NUMERIC.indexOf(f) !== -1 ? (el.value === "" ? "" : A.clamp(el.value, 1, f === "outputs" || f === "keyOutputs" ? 4 : 60)) : el.value;
    A.touch();
  }
  function onFieldChange(e) {
    var el = e.target, f = el.getAttribute("data-f"); if (!f) return;
    var shot = shotFromEvent(e); if (!shot) return;
    if (f === "lock") { shot.lock = el.checked; A.touch(); return; }
    if (f === "autoAnimate") { shot.autoAnimate = el.checked; A.touch(); return; }
    if (f === "addref") {
      var files = Array.prototype.slice.call(el.files || []), chain = Promise.resolve(), added = 0, max = A.settings.maxRefs || 5;
      el.value = "";
      files.forEach(function (file) {
        chain = chain.then(function () {
          var name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Référence";
          return A.addLibraryItem(file, { name: name, kind: "personnage" }).then(function (item) {
            if ((shot.ingredients || []).length < max) { shot.ingredients = (shot.ingredients || []).concat(item.id); added++; }
          });
        });
      });
      chain.then(function () {
        A.touch(); A.renderShots();
        A.toast(added + " référence(s) ajoutée(s) au plan et à la bibliothèque. Renommez-les (nom du personnage ou du lieu) dans la Bibliothèque.", "ok");
      });
      return;
    }
    if (f === "addskill") {
      if (el.value && (shot.skills || []).indexOf(el.value) === -1) { shot.skills = (shot.skills || []).concat(el.value); A.touch(); }
      A.renderShots(); return;
    }
    onFieldInput(e);
    if (["mode", "sourceRef", "startRef", "endRef", "i2v", "imagePrompt"].indexOf(f) !== -1) A.renderShots();
  }

  function downloadTake(shot, take, proj) {
    var idx = A.sortedShots(proj).indexOf(shot) + 1;
    var name = String(idx).padStart(2, "0") + "_" + A.slugify(shot.prompt) + "_prise" + (shot.takes.indexOf(take) + 1) + (take.kind === "video" ? ".mp4" : ".png");
    A.getTakeBlobOrFetch(take).then(function (b) {
      var href = b ? URL.createObjectURL(b) : take.remoteUrl;
      if (!href) { A.toast("Fichier indisponible.", "err"); return; }
      var a = document.createElement("a"); a.href = href; a.download = name; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      if (b) setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
    });
  }
  // Téléchargement agrandi en 1080p (petit côté = 1080 px) — réencodage en temps réel dans le navigateur
  function download1080(shot, take, proj, btn) {
    var idx = A.sortedShots(proj).indexOf(shot) + 1, label = btn.textContent;
    btn.disabled = true; btn.textContent = "1080p : préparation…";
    A.getTakeBlobOrFetch(take).then(function (b) {
      if (!b) throw new Error("Le fichier de la vidéo n'est pas dans l'app : « ⟳ Récupérer le fichier » d'abord.");
      var mode = (proj.montage.opts && proj.montage.opts.up && proj.montage.opts.up !== "off") ? proj.montage.opts.up : "net";
      return A.exportUpscaledVideo(b, 1080, mode, function (p) { btn.textContent = "1080p : " + Math.round(p * 100) + " %"; });
    }).then(function (r) {
      var ext = /mp4/.test(r.blob.type) ? "mp4" : "webm", a = document.createElement("a");
      a.href = URL.createObjectURL(r.blob); a.download = String(idx).padStart(2, "0") + "_" + A.slugify(shot.prompt) + "_1080p." + ext;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      A.toast("Vidéo 1080p prête (" + r.w + "×" + r.h + ", " + ext.toUpperCase() + ").", "ok");
    }).catch(function (e) { A.toast("1080p impossible : " + (e.message || e), "err"); })
      .finally(function () { btn.disabled = false; btn.textContent = label; });
  }
  function takeToLibrary(shot, take, which, proj) {
    var idx = A.sortedShots(proj).indexOf(shot) + 1;
    var name = "Plan " + idx + (which === "first" ? " — début" : which === "last" ? " — fin" : "");
    A.toast("Ajout à la bibliothèque…");
    A.getTakeBlobOrFetch(take).then(function (b) {
      if (!b) throw new Error("Le fichier de la prise n'est pas disponible localement.");
      if (take.kind === "image") return A.addLibraryItem(b, { name: name, kind: "autre", publicUrl: take.remoteUrl || "" }, proj);
      var u = URL.createObjectURL(b);
      return A.videoFrame(u, which).then(function (fb) { URL.revokeObjectURL(u); return A.addLibraryItem(fb, { name: name, kind: "autre" }, proj); });
    }).then(function () { A.toast("« " + name + " » ajouté à la bibliothèque.", "ok"); })
      .catch(function (err) { A.toast("Échec : " + (err.message || err), "err"); });
  }
  function duplicateShot(shot, proj) {
    var arr = A.sortedShots(proj), i = arr.indexOf(shot);
    arr.slice(i + 1).forEach(function (s) { s.order += 1; });
    var copy = JSON.parse(JSON.stringify(shot));
    copy.id = A.uid(); copy.order = shot.order + 1; copy.takes = []; copy.selectedTakeId = null; copy.status = "idle"; copy.errorMsg = ""; copy.lastRaw = null; copy.remoteTasks = [];
    copy.keyTakes = []; copy.keyTakeId = null; copy.twoStage = "";
    proj.shots.push(copy); return copy;
  }
  function deleteTakeBlobs(shot) {
    (shot.takes || []).concat(shot.keyTakes || []).forEach(function (t) { AgnesStore.delBlob("take:" + t.id); A.forgetUrl("take:" + t.id); });
  }
  A.deleteShot = function (shot, proj) {
    proj = proj || A.getProject();
    A.jobs.forEach(function (j) { if (j.shotId === shot.id && (j.status === "waiting" || j.status === "running")) A.cancelJob(j); });
    deleteTakeBlobs(shot);
    proj.shots = proj.shots.filter(function (s) { return s.id !== shot.id; });
    A.selection.delete(shot.id);
  };

  function onShotClick(e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var shot = shotFromEvent(e); if (!shot) return;
    var proj = A.getProject(), act = btn.getAttribute("data-act"), take = A.selectedTake(shot);
    switch (act) {
      case "sel": if (btn.checked) A.selection.add(shot.id); else A.selection.delete(shot.id);
        btn.closest(".shot-card").classList.toggle("selected", btn.checked); renderSelBar(); return;
      case "up": case "down": {
        var arr = A.sortedShots(proj), i = arr.indexOf(shot), j = act === "up" ? i - 1 : i + 1;
        if (j >= 0 && j < arr.length) { var t = arr[i].order; arr[i].order = arr[j].order; arr[j].order = t; }
        break;
      }
      case "dup": duplicateShot(shot, proj); break;
      case "del": if (!window.confirm("Supprimer ce plan et ses prises ?")) return; A.deleteShot(shot, proj); break;
      case "run": A.enqueueMany([shot], proj); return;
      case "cancel": A.jobs.forEach(function (j) { if (j.shotId === shot.id) A.cancelJob(j); }); return;
      case "view": if (take) A.openLightbox(take); else if (A.isTwoStep(shot) && A.keyTake(shot)) A.openLightbox(A.keyTake(shot)); return;
      case "take": shot.selectedTakeId = btn.getAttribute("data-take"); break;
      case "keytake": shot.keyTakeId = btn.getAttribute("data-take"); break;
      case "genkey": A.enqueueStage(shot, "image", proj); return;
      case "resume": A.enqueueShot(shot, { resume: true }, proj); return;
      case "convert": {
        if (!A.convertToVideo(shot, proj)) return;
        A.renderShots();
        var ta = document.querySelector('[data-shot="' + shot.id + '"] textarea[data-f="prompt"]');
        if (ta) { ta.focus(); ta.scrollIntoView({ behavior: "smooth", block: "center" }); }
        A.toast("Plan converti : décrivez le mouvement dans « Prompt vidéo », puis « Animer l'image ».", "ok");
        return;
      }
      case "animate": A.enqueueStage(shot, "video", proj); return;
      case "viewkey": { var kt = A.keyTake(shot); if (kt) A.openLightbox(kt); return; }
      case "delkey": {
        var k = A.keyTake(shot); if (!k || !window.confirm("Supprimer cette image de départ ?")) return;
        AgnesStore.delBlob("take:" + k.id); A.forgetUrl("take:" + k.id);
        shot.keyTakes = shot.keyTakes.filter(function (t) { return t.id !== k.id; });
        shot.keyTakeId = shot.keyTakes.length ? shot.keyTakes[shot.keyTakes.length - 1].id : null;
        if (!shot.keyTakes.length && shot.status === "review") shot.status = "idle";
        break;
      }
      case "dl": if (take) downloadTake(shot, take, proj); return;
      case "dl1080": if (take) download1080(shot, take, proj, btn); return;
      case "repair": if (take) A.repairTake(take, shot, proj, true); return;
      case "tolib": if (take) takeToLibrary(shot, take, null, proj); return;
      case "first": case "last": if (take) takeToLibrary(shot, take, act, proj); return;
      case "deltake":
        if (!take || !window.confirm("Supprimer cette prise ?")) return;
        AgnesStore.delBlob("take:" + take.id); A.forgetUrl("take:" + take.id);
        shot.takes = shot.takes.filter(function (t) { return t.id !== take.id; });
        shot.selectedTakeId = shot.takes.length ? shot.takes[shot.takes.length - 1].id : null;
        if (!shot.takes.length) shot.status = "idle";
        break;
      case "ingr": {
        var id = btn.getAttribute("data-lib"), list = shot.ingredients || [];
        if (list.indexOf(id) !== -1) list = list.filter(function (x) { return x !== id; });
        else if (list.length >= (A.settings.maxRefs || 5)) { A.toast("Maximum " + (A.settings.maxRefs || 5) + " ingrédients par plan (réglable dans les options avancées).", "err"); return; }
        else list = list.concat(id);
        shot.ingredients = list; break;
      }
      case "rmskill": shot.skills = (shot.skills || []).filter(function (x) { return x !== btn.getAttribute("data-skill"); }); break;
      case "refsrc": { var rs = AgnesCore._refSources[+btn.getAttribute("data-i")]; if (rs) rs.onClick(shot); return; }
      case "plugin": { var pa = AgnesCore._shotActions[+btn.getAttribute("data-i")]; if (pa) pa.onClick(shot, take); return; }
      default: return;
    }
    A.touch(); A.renderShots();
  }

  // ---- Barre de sélection (édition par lot) ----
  function renderSelBar() {
    var n = A.selection.size, bar = byId("selBar");
    bar.classList.toggle("open", n > 0);
    byId("selCount").textContent = n + " plan" + (n > 1 ? "s" : "") + " sélectionné" + (n > 1 ? "s" : "");
    byId("selectAllBtn").textContent = n && n === A.getProject().shots.length ? "Tout désélectionner" : "Tout sélectionner";
  }
  function selectedShots() { return A.sortedShots().filter(function (s) { return A.selection.has(s.id); }); }
  function initSelBar() {
    byId("selMode").innerHTML = '<option value="">Mode — inchangé</option>' + A.modeOptionsHtml("");
    byId("selAspect").innerHTML = '<option value="">Format — inchangé</option>' + A.optionsHtml(A.ASPECTS, "");
    byId("selRes").innerHTML = '<option value="">Résolution — inchangée</option>' + A.optionsHtml(A.RESOLUTIONS, "");
    byId("selApplyBtn").addEventListener("click", function () {
      var m = byId("selMode").value, a = byId("selAspect").value, r = byId("selRes").value,
        d = byId("selDuration").value, o = byId("selOutputs").value, sk = byId("selSkill").value;
      selectedShots().forEach(function (s) {
        if (m) s.mode = m; if (a) s.aspect = a; if (r) s.resolution = r;
        if (d) s.duration = A.clamp(d, 1, 60); if (o) s.outputs = A.clamp(o, 1, 4);
        if (sk && (s.skills || []).indexOf(sk) === -1) s.skills = (s.skills || []).concat(sk);
      });
      A.touch(); A.renderShots(); A.toast("Réglages appliqués à " + A.selection.size + " plan(s).", "ok");
    });
    byId("selRunBtn").addEventListener("click", function () { var n = A.enqueueMany(selectedShots()); if (n) A.toast(n + " plan(s) ajouté(s) à la liste d'attente.", "ok"); });
    byId("selDupBtn").addEventListener("click", function () {
      var p = A.getProject(); selectedShots().reverse().forEach(function (s) { duplicateShot(s, p); }); A.touch(); A.renderShots();
    });
    byId("selDelBtn").addEventListener("click", function () {
      if (!window.confirm("Supprimer les " + A.selection.size + " plans sélectionnés et leurs prises ?")) return;
      var p = A.getProject(); selectedShots().forEach(function (s) { A.deleteShot(s, p); }); A.touch(); A.renderShots();
    });
    byId("selClearBtn").addEventListener("click", function () { A.selection.clear(); A.renderShots(); });
    byId("selectAllBtn").addEventListener("click", function () {
      var p = A.getProject();
      if (A.selection.size === p.shots.length) A.selection.clear(); else p.shots.forEach(function (s) { A.selection.add(s.id); });
      A.renderShots();
    });
  }

  // =========================================================
  // VISIONNEUSE
  // =========================================================
  A.openLightbox = function (take) {
    A.getTakeSrc(take).then(function (src) {
      if (!src) { A.toast("Fichier indisponible.", "err"); return; }
      byId("lightboxBody").innerHTML = take.kind === "video"
        ? '<video src="' + esc(src) + '" controls autoplay playsinline></video>' : '<img src="' + esc(src) + '" alt="">';
      byId("lightbox").classList.add("open");
    });
  };
  function closeLightbox() { byId("lightbox").classList.remove("open"); byId("lightboxBody").innerHTML = ""; }

  // =========================================================
  // RÉGLAGES API
  // =========================================================
  var TEXT_FIELDS = { apiKeyInput: "apiKey", imgbbKeyInput: "imgbbKey", baseUrlInput: "baseUrl", imageModelInput: "imageModel", imagePathInput: "imagePath",
    videoModelInput: "videoModel", videoCreatePathInput: "videoCreatePath", videoStatusPathInput: "videoStatusPath", videoLegacyPathInput: "videoLegacyPath", videoParamStyleInput: "videoParamStyle" };
  var CHECK_FIELDS = { extraBodyInput: "refsInExtraBody", img2imgTagInput: "img2imgTag", sendNegativeInput: "sendNegative" };
  function fillSettingsForm() {
    byId("videoModelList").innerHTML = A.KNOWN_MODELS.video.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + '</option>'; }).join("");
    byId("imageModelList").innerHTML = A.KNOWN_MODELS.image.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + '</option>'; }).join("");
    var vm = A.KNOWN_MODELS.video.find(function (m) { return m[0] === A.settings.videoModel; });
    byId("videoModelHint").textContent = (vm ? vm[1] + ". " : "") + (A.settings.videoModel === "agnes-video-v2.0" ? "⚠ Ce modèle est retiré le 25/09/2026 : passez à agnes-video-2.5-flash." : "");
    Object.keys(TEXT_FIELDS).forEach(function (id) { byId(id).value = A.settings[TEXT_FIELDS[id]] || ""; });
    Object.keys(CHECK_FIELDS).forEach(function (id) { byId(id).checked = !!A.settings[CHECK_FIELDS[id]]; });
    byId("maxRefsInput").value = A.settings.maxRefs || 5;
  }
  A.openSettings = function () { fillSettingsForm(); byId("settingsOverlay").classList.add("open"); };
  function initSettings() {
    byId("openSettings").addEventListener("click", A.openSettings);
    byId("closeSettings").addEventListener("click", function () { byId("settingsOverlay").classList.remove("open"); });
    byId("settingsOverlay").addEventListener("click", function (e) { if (e.target === byId("settingsOverlay")) byId("settingsOverlay").classList.remove("open"); });
    byId("saveSettingsBtn").addEventListener("click", function () {
      Object.keys(TEXT_FIELDS).forEach(function (id) {
        var k = TEXT_FIELDS[id], v = byId(id).value.trim();
        A.settings[k] = v || (k === "apiKey" || k === "imgbbKey" ? "" : A.SETTINGS_DEFAULTS[k]);
      });
      Object.keys(CHECK_FIELDS).forEach(function (id) { A.settings[CHECK_FIELDS[id]] = byId(id).checked; });
      A.settings.maxRefs = A.clamp(byId("maxRefsInput").value, 1, 10);
      if (A.persistSettings()) A.toast("Réglages enregistrés.", "ok");
      A.pump();
    });
    byId("resetSettingsBtn").addEventListener("click", function () {
      if (!window.confirm("Remettre les réglages par défaut ? La clé API sera conservée.")) return;
      var key = A.settings.apiKey, img = A.settings.imgbbKey, ext = A.settings.extensions;
      A.settings = Object.assign({}, A.SETTINGS_DEFAULTS, { apiKey: key, imgbbKey: img, extensions: ext });
      A.persistSettings(); fillSettingsForm(); A.toast("Réglages réinitialisés.", "ok");
    });
    byId("advToggle").addEventListener("click", function () {
      var f = byId("advFields"); f.classList.toggle("open");
      this.textContent = "Options avancées (URL et paramètres) " + (f.classList.contains("open") ? "▴" : "▾");
    });
    byId("toggleKeyVisibility").addEventListener("click", function () {
      var i = byId("apiKeyInput"); i.type = i.type === "password" ? "text" : "password";
    });
  }

  // =========================================================
  // INITIALISATION DE L'INTERFACE
  // =========================================================
  A.initUI = function () {
    document.querySelectorAll("#tabBar .tab").forEach(A.bindTab);
    initSettings(); initSelBar();

    // Projet actif
    byId("projectSelect").addEventListener("change", function () { switchProject(this.value); });
    byId("newProjectBtn").addEventListener("click", function () {
      var name = window.prompt("Nom du nouveau projet :", "Nouveau projet"); if (name === null) return;
      var p = A.newProject(name.trim() || "Nouveau projet"); A.db.projects[p.id] = p; switchProject(p.id);
    });
    byId("projectManageList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-proj]"); if (b) { switchProject(b.getAttribute("data-proj")); renderProjectManageList(); }
    });
    byId("duplicateProjectBtn").addEventListener("click", function () {
      var src = A.getProject(), copy = JSON.parse(JSON.stringify(src));
      copy.id = A.uid(); copy.name = src.name + " (copie)"; copy.createdAt = copy.updatedAt = Date.now();
      copy.shots.forEach(function (s) { s.id = A.uid(); s.status = "idle"; s.takes = []; s.selectedTakeId = null; s.errorMsg = ""; s.remoteTasks = []; s.keyTakes = []; s.keyTakeId = null; s.twoStage = ""; });
      // les ingrédients gardent leurs identifiants : les images sont partagées entre les deux projets
      A.db.projects[copy.id] = copy; switchProject(copy.id); A.toast("Projet dupliqué (plans sans leurs rendus).", "ok");
    });
    byId("deleteProjectBtn").addEventListener("click", function () {
      if (Object.keys(A.db.projects).length <= 1) { A.toast("Impossible de supprimer le dernier projet.", "err"); return; }
      var p = A.getProject();
      if (!window.confirm('Supprimer définitivement le projet « ' + p.name + ' » et ses rendus ?')) return;
      p.shots.forEach(deleteTakeBlobs);
      delete A.db.projects[p.id]; switchProject(Object.keys(A.db.projects)[0]);
    });
    byId("saveProjectBtn").addEventListener("click", function () {
      var p = A.getProject();
      p.name = byId("projName").value.trim() || p.name; p.styleGuide = byId("projStyle").value.trim();
      p.negative = byId("projNegative").value.trim(); p.seed = byId("projSeed").value.trim();
      p.aspect = byId("projAspect").value; p.resolution = byId("projRes").value;
      p.duration = A.clamp(byId("projDuration").value, 1, 60); p.outputs = A.clamp(byId("projOutputs").value, 1, 4);
      p.fps = A.clamp(byId("projFps").value, 8, 60); p.concurrency = A.clamp(byId("projConcurrency").value, 1, 4);
      A.touch(); renderProjectSelect(); fillProjectForm(); A.pump(); A.toast("Projet enregistré.", "ok");
    });
    byId("persistBtn").addEventListener("click", function () {
      AgnesStore.persist().then(function (ok) { A.toast(ok ? "Stockage protégé : le navigateur ne l'effacera pas automatiquement." : "Le navigateur a refusé (installez l'app ou ajoutez la page aux favoris, puis réessayez).", ok ? "ok" : "err"); });
    });
    byId("cleanOrphansBtn").addEventListener("click", function () {
      var used = new Set();
      Object.keys(A.db.projects).forEach(function (pid) {
        var p = A.db.projects[pid];
        p.library.forEach(function (l) { used.add("lib:" + l.id); });
        p.shots.forEach(function (s) { (s.takes || []).concat(s.keyTakes || []).forEach(function (t) { used.add("take:" + t.id); }); if (s.voice && s.voice.key) used.add(s.voice.key); });
        (p.audioBeds || []).forEach(function (b) { if (b.key) used.add(b.key); });
        if (p.grade && p.grade.lutKey) used.add(p.grade.lutKey);
      });
      AgnesStore.blobKeys().then(function (keys) {
        // Seules les clés gérées par le studio sont nettoyées (les extensions gardent les leurs, ex. « bible: »)
        var orphans = (keys || []).filter(function (k) { return /^(take|lib|voice|bed|grade):/.test(k) && !used.has(k); });
        return Promise.all(orphans.map(AgnesStore.delBlob)).then(function () { A.toast(orphans.length + " média(s) orphelin(s) supprimé(s).", "ok"); renderStorageInfo(); });
      });
    });

    // Storyboard
    byId("breakdownMode").innerHTML = A.modeOptionsHtml("t2v");
    byId("breakdownBtn").addEventListener("click", function () {
      var blocks = byId("scriptInput").value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!blocks.length) { A.toast("Rien à découper — séparez vos plans par une ligne vide.", "err"); return; }
      var p = A.getProject(), mode = byId("breakdownMode").value;
      blocks.forEach(function (b) { p.shots.push(A.newShot({ mode: mode, prompt: b }, p)); });
      byId("scriptInput").value = ""; A.touch(); A.renderShots(); A.toast(blocks.length + " plan(s) créé(s).", "ok");
    });
    byId("addShotBtn").addEventListener("click", function () {
      A.addShot({ mode: byId("breakdownMode").value });
      var last = byId("shotList").lastElementChild; if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    byId("runQueueBtn").addEventListener("click", function () {
      var all = A.sortedShots(), review = all.filter(function (s) { return s.status === "review"; }).length;
      var pending = all.filter(function (s) { return ["done", "queued", "running", "resume", "review"].indexOf(s.status) === -1; });
      var wait = review ? " " + review + " image(s) à valider restent en attente : « Animer » sur la carte, ou cochez-les puis « Générer la sélection »." : "";
      if (!pending.length) { A.toast("Rien à lancer : les plans sont terminés ou déjà en file." + wait, "ok"); return; }
      var n = A.enqueueMany(pending); if (n) A.toast(n + " plan(s) ajouté(s) à la liste d'attente." + wait, "ok");
    });
    var list = byId("shotList");
    list.addEventListener("input", onFieldInput);
    list.addEventListener("change", onFieldChange);
    list.addEventListener("click", onShotClick);

    // Visionneuse
    byId("lightboxClose").addEventListener("click", closeLightbox);
    byId("lightbox").addEventListener("click", function (e) { if (e.target === byId("lightbox")) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeLightbox(); byId("settingsOverlay").classList.remove("open"); }
    });
  };
})();
