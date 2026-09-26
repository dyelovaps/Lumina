// js/app-state.js — état, réglages, projets, formats, skills intégrés, outils médias
(function () {
  "use strict";
  var A = window.AgnesApp = window.AgnesApp || {};

  // =========================================================
  // UTILITAIRES
  // =========================================================
  A.byId = function (id) { return document.getElementById(id); };
  A.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  A.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); };
  A.slugify = function (s, max) {
    s = (s || "plan").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return (s || "plan").slice(0, max || 40);
  };
  // Le plan (ou l'étape) a-t-il besoin de la clé Agnes ? Remplacé par l'extension Moteurs quand un autre moteur génère.
  A.needsAgnesKey = function (shot, stage) { return true; };
  // Qui a fabriqué une prise ? (source posée par l'extension Moteurs ou par Lumina ; anciennes prises : Agnes si en ligne)
  A.engineOf = function (take) {
    var s = take && take.source;
    return s === "chatgpt" ? "ChatGPT" : s === "grok" ? "Grok" : s === "agnes" ? "Agnes" : take && take.remoteUrl ? "Agnes" : take && take.local && !s ? "" : "Agnes";
  };
  // Badge « moteur de la prochaine génération » en tête de carte (fourni par l'extension Moteurs)
  A.cardEngineBadge = function (shot) { return ""; };
  A.clamp = function (v, min, max) { v = Number(v); if (isNaN(v)) v = min; return Math.min(max, Math.max(min, v)); };
  A.sleep = function (ms, signal) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener("abort", function () { clearTimeout(t); reject({ display: "Annulé.", cancelled: true }); });
    });
  };
  A.debugBlock = function (label, data) {
    return '<details class="debug"><summary>' + A.esc(label) + '</summary><pre>' +
      A.esc(JSON.stringify(data, null, 2)) + '</pre></details>';
  };
  var toastTimer = null;
  A.toast = function (msg, type) {
    var el = A.byId("toast"); if (!el) return;
    el.textContent = msg; el.className = "toast-float show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast-float"; }, type === "err" ? 7000 : 3800);
  };

  // Recherche tolérante dans les réponses JSON
  A.collectByKey = function (obj, key, results, seen) {
    results = results || []; seen = seen || new Set();
    if (!obj || typeof obj !== "object" || seen.has(obj)) return results;
    seen.add(obj);
    Object.keys(obj).forEach(function (k) {
      if (k.toLowerCase() === key && typeof obj[k] === "string" && obj[k]) results.push(obj[k]);
    });
    Object.keys(obj).forEach(function (k) {
      var v = obj[k]; if (v && typeof v === "object") A.collectByKey(v, key, results, seen);
    });
    return results;
  };
  A.findFirst = function (obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var r = A.collectByKey(obj, keys[i]);
      if (r.length) return r[0];
    }
    return null;
  };
  // "/chemin" → base + chemin ; "~/chemin" → racine du domaine ; "https://…" → tel quel
  A.joinUrl = function (base, path) {
    if (/^https?:\/\//i.test(path)) return path;
    if (path.indexOf("~/") === 0) { try { return new URL(base).origin + path.slice(1); } catch (e) { } }
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  };

  // =========================================================
  // FORMATS, RÉSOLUTIONS, MODES
  // =========================================================
  A.ASPECTS = [
    ["16:9", "16:9 — paysage"], ["9:16", "9:16 — vertical (TikTok, Reels)"], ["1:1", "1:1 — carré"],
    ["4:3", "4:3"], ["3:4", "3:4 — portrait"], ["4:5", "4:5 — Instagram"], ["21:9", "21:9 — cinémascope"],
    ["3:2", "3:2"], ["2:3", "2:3"]
  ];
  A.RESOLUTIONS = [["480p", "480p"], ["720p", "720p"], ["1080p", "1080p"], ["1440p", "2K"], ["2160p", "4K"]];
  A.computeSize = function (aspect, res) {
    var parts = String(aspect || "16:9").split(":"), a = Number(parts[0]) || 16, b = Number(parts[1]) || 9;
    var short = parseInt(res, 10) || 1080, w, h;
    if (a >= b) { h = short; w = short * a / b; } else { w = short; h = short * b / a; }
    function r8(v) { return Math.max(8, Math.round(v / 8) * 8); }
    return { w: r8(w), h: r8(h) };
  };
  A.MODES = {
    t2i: { label: "Texte → Image", kind: "image", refs: [] },
    i2i: { label: "Image → Image", kind: "image", refs: ["source"] },
    ingr_i: { label: "Ingrédients → Image", kind: "image", refs: ["ingredients"] },
    t2v: { label: "Texte → Vidéo", kind: "video", refs: [] },
    i2v: { label: "Image → Vidéo", kind: "video", refs: ["source"] },
    frames: { label: "Première + dernière frame → Vidéo", kind: "video", refs: ["start", "end"] },
    ingr_v: { label: "Ingrédients → Vidéo", kind: "video", refs: ["ingredients"] }
  };
  // Modes qui acceptent des références (personnages, lieux, objets) envoyées à Agnes avec le prompt
  A.REF_MODES = ["t2i", "t2v", "i2i", "ingr_i", "ingr_v"];
  // Image → Vidéo accepte aussi des références quand la stratégie « + références personnages » est choisie
  A.usesRefs = function (mode, shot) { return A.REF_MODES.indexOf(mode) !== -1 || (mode === "i2v" && shot && shot.i2v === "refs"); };
  // Image → Vidéo : comment tenir la scène
  A.I2V_STRATEGIES = [
    ["standard", "Standard — l'image de départ seule"],
    ["anchor", "Scène verrouillée — début et fin sur la même image"],
    ["refs", "Scène + références personnages"]
  ];
  A.MOTIONS = [["subtle", "Mouvement subtil"], ["moderate", "Mouvement modéré"], ["free", "Mouvement libre"]];
  A.modeKind = function (mode) { return (A.MODES[mode] || A.MODES.t2v).kind; };
  A.LIB_KINDS = [["personnage", "Personnage"], ["decor", "Décor"], ["objet", "Objet"], ["style", "Style"], ["source", "Source (lot)"], ["autre", "Autre"]];
  A.PREV_REF = "__prev_last"; // « dernière image du plan précédent »
  A.KEY_REF = "__key_image";   // « image de départ » générée par le plan lui-même (Texte → Vidéo avec prompt image)

  // Texte → Vidéo avec un prompt image : la carte génère d'abord l'image (avec ses références), puis l'anime
  A.isTwoStep = function (shot) { return !!shot && shot.mode === "t2v" && (!!String(shot.imagePrompt || "").trim() || !!(shot.keyTakes || []).length); };
  A.keyTake = function (shot) {
    var list = (shot && shot.keyTakes) || [];
    return list.find(function (t) { return t.id === shot.keyTakeId; }) || list[list.length - 1] || null;
  };
  // Vue d'un plan pour une étape : les lectures renvoient les valeurs de l'étape, les écritures vont au vrai plan
  A.stageView = function (shot, stage) {
    var o = stage === "image"
      ? { mode: shot.keyMode || "t2i", prompt: shot.imagePrompt || "", outputs: shot.keyOutputs || 2, sourceRef: shot.keyMode === "i2i" ? shot.sourceRef : "" }
      : { mode: "i2v", sourceRef: A.KEY_REF, i2v: shot.i2v || "anchor", motion: shot.motion || "subtle",
          ingredients: shot.i2v === "refs" ? (shot.ingredients || []) : [] };
    return new Proxy(shot, {
      get: function (t, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : t[k]; },
      set: function (t, k, v) { if (Object.prototype.hasOwnProperty.call(o, k)) o[k] = v; else t[k] = v; return true; }
    });
  };
  A.MODE_LABEL = function (shot) {
    if (!A.isTwoStep(shot)) return (A.MODES[shot.mode] || A.MODES.t2v).label;
    return shot.keyMode && shot.keyMode !== "t2i" && A.MODES[shot.keyMode] ? A.MODES[shot.keyMode].label + " → Vidéo" : "Texte → Image → Vidéo";
  };
  // « Convertir (vidéo) » : un plan image garde ses images comme images de départ et devient un plan vidéo
  A.convertToVideo = function (shot, proj) {
    proj = proj || A.getProject();
    var images = (shot.takes || []).filter(function (t) { return t.kind === "image"; }), sel = A.selectedTake(shot);
    if (!images.length) return false;
    var oldMode = A.modeKind(shot.mode) === "image" ? shot.mode : "t2i";
    shot.keyMode = oldMode === "t2i" ? "" : oldMode;
    shot.imagePrompt = shot.prompt || "";
    shot.keyOutputs = shot.outputs || 2;
    shot.keyTakes = (shot.keyTakes || []).concat(images);
    shot.keyTakeId = sel && sel.kind === "image" ? sel.id : images[images.length - 1].id;
    shot.takes = (shot.takes || []).filter(function (t) { return t.kind !== "image"; });
    shot.selectedTakeId = shot.takes.length ? shot.takes[shot.takes.length - 1].id : null;
    shot.mode = "t2v"; shot.prompt = ""; shot.outputs = proj.outputs || 1; shot.duration = shot.duration || proj.duration || 5;
    shot.i2v = shot.i2v && shot.i2v !== "refs" ? shot.i2v : "anchor"; shot.motion = shot.motion || "subtle";
    shot.status = shot.takes.length ? "done" : "review"; shot.errorMsg = ""; shot.remoteTasks = [];
    A.touch(proj); return true;
  };

  A.optionsHtml = function (pairs, selected) {
    return pairs.map(function (p) {
      return '<option value="' + A.esc(p[0]) + '"' + (String(p[0]) === String(selected) ? " selected" : "") + '>' + A.esc(p[1]) + '</option>';
    }).join("");
  };
  A.modeOptionsHtml = function (selected) {
    return A.optionsHtml(Object.keys(A.MODES).map(function (k) { return [k, A.MODES[k].label]; }), selected);
  };

  // =========================================================
  // RÉGLAGES API (partagés entre projets)
  // =========================================================
  var SETTINGS_KEY = "agnes_studio_settings_v3";
  A.SETTINGS_DEFAULTS = {
    apiKey: "", imgbbKey: "",
    baseUrl: "https://apihub.agnes-ai.com/v1",
    imageModel: "agnes-image-2.5-flash", imagePath: "/images/generations",
    videoModel: "agnes-video-2.5-flash", videoCreatePath: "/videos",
    videoStatusPath: "~/agnesapi?video_id={id}&model_name={model}", videoLegacyPath: "/videos/{id}",
    videoParamStyle: "auto", refsInExtraBody: true, img2imgTag: false, sendNegative: true,
    maxRefs: 5, extensions: {}
  };
  A.settings = Object.assign({}, A.SETTINGS_DEFAULTS);
  A.loadSettings = function () {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        var old = localStorage.getItem("agnes_studio_settings_v2");
        if (old) { old = JSON.parse(old); raw = JSON.stringify({ apiKey: old.apiKey || "", baseUrl: old.baseUrl, imageModel: old.imageModel }); }
      }
      if (raw) A.settings = Object.assign({}, A.SETTINGS_DEFAULTS, JSON.parse(raw));
    } catch (e) { console.warn("Réglages illisibles :", e); }
    migrateModels();
  };
  // Agnes Video v2.0 est retiré le 25/09/2026 : passage automatique à la série 2.5 (et Image 2.5 Flash, même API que 2.1)
  function migrateModels() {
    var s = A.settings, changed = [];
    if (s.videoModel === "agnes-video-v2.0") { s.videoModel = "agnes-video-2.5-flash"; changed.push("vidéo → agnes-video-2.5-flash"); }
    if (s.imageModel === "agnes-image-2.1-flash" || s.imageModel === "agnes-image-2.0-flash") { s.imageModel = "agnes-image-2.5-flash"; changed.push("image → agnes-image-2.5-flash"); }
    if (s.videoStatusPath === "~/agnesapi?video_id={id}") s.videoStatusPath = A.SETTINGS_DEFAULTS.videoStatusPath;
    if (s.videoParamStyle === "agnes" && /2\.5/.test(s.videoModel)) s.videoParamStyle = "auto";
    if (changed.length) { A.migratedModels = changed; A.persistSettings(); }
  }
  // ---- Modèles vidéo : format de requête et limites ----
  A.videoStyle = function (model) {
    model = model || A.settings.videoModel;
    var st = A.settings.videoParamStyle || "auto";
    return st === "auto" ? (/2\.5/.test(model) ? "agnes25" : "agnes") : st;
  };
  A.isFlashVideo = function (model) { return /2\.5-flash/i.test(model || A.settings.videoModel); };
  A.videoSecondsRange = function () { return A.videoStyle() === "agnes25" ? [4, 12] : [1, 18]; };
  A.KNOWN_MODELS = {
    video: [["agnes-video-2.5-flash", "Agnes Video 2.5 Flash — gratuit (offre limitée), 720P, 4 à 12 s"],
      ["agnes-video-2.5", "Agnes Video 2.5 — payant, 720P à 2K, 4 à 12 s"],
      ["agnes-video-v2.0", "Agnes Video v2.0 — retiré le 25/09/2026"]],
    image: [["agnes-image-2.5-flash", "Agnes Image 2.5 Flash — dernière génération"],
      ["agnes-image-2.1-flash", "Agnes Image 2.1 Flash"], ["agnes-image-2.0-flash", "Agnes Image 2.0 Flash"]]
  };
  A.persistSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(A.settings)); return true; }
    catch (e) { A.toast("Enregistrement des réglages impossible (stockage local indisponible).", "err"); return false; }
  };

  // =========================================================
  // SKILLS INTÉGRÉS
  // =========================================================
  function sk(id, title, cats, desc, action, target) {
    return { id: "b-" + id, title: title, categories: cats, description: desc, action: action, target: target || "both", builtin: true };
  }
  A.BUILTIN_SKILLS = [
    sk("dolly-in", "Travelling avant", ["Caméra", "Mouvement"], "La caméra avance vers le sujet : tension, intimité, révélation.", "slow dolly-in camera move toward the subject, smooth and steady", "video"),
    sk("dolly-out", "Travelling arrière", ["Caméra", "Mouvement"], "La caméra recule : isole le personnage, révèle le décor.", "slow dolly-out camera move away from the subject, revealing the surroundings", "video"),
    sk("truck", "Travelling latéral", ["Caméra", "Mouvement"], "La caméra glisse sur le côté en suivant l'action.", "lateral tracking shot moving sideways alongside the subject", "video"),
    sk("pan", "Panoramique", ["Caméra", "Mouvement"], "La caméra pivote horizontalement sur place.", "smooth horizontal pan across the scene", "video"),
    sk("tilt", "Tilt (bascule verticale)", ["Caméra", "Mouvement"], "La caméra pivote de bas en haut ou de haut en bas.", "slow vertical tilt up revealing the subject", "video"),
    sk("orbit", "Orbite", ["Caméra", "Mouvement"], "La caméra tourne autour du personnage.", "camera orbits 180 degrees around the subject, subject stays centered", "video"),
    sk("handheld", "Caméra épaule", ["Caméra", "Mouvement", "Réalisme"], "Léger tremblement naturel : effet documentaire, urgence.", "handheld camera, subtle natural shake, documentary feel", "video"),
    sk("static", "Plan fixe", ["Caméra", "Mouvement"], "Caméra immobile sur trépied : le jeu d'acteur porte la scène.", "static locked-off camera on tripod, no camera movement", "video"),
    sk("crane", "Grue / drone montant", ["Caméra", "Mouvement"], "La caméra s'élève pour dévoiler l'espace.", "crane shot rising upward, revealing the wide environment", "video"),
    sk("dollyzoom", "Dolly zoom (vertigo)", ["Caméra", "Mouvement"], "Le fond se déforme pendant que le sujet reste fixe : malaise, choc.", "dolly zoom vertigo effect, background stretches while subject stays the same size", "video"),
    sk("closeup", "Gros plan", ["Cadrage"], "Le visage remplit le cadre : émotion.", "close-up shot on the face, shallow depth of field", "both"),
    sk("ecu", "Très gros plan", ["Cadrage"], "Détail extrême : yeux, mains, objet.", "extreme close-up on a detail", "both"),
    sk("medium", "Plan américain", ["Cadrage"], "Personnage cadré à mi-cuisse : dialogue, action.", "medium-long shot framed from mid-thigh up", "both"),
    sk("wide", "Plan large", ["Cadrage"], "Le décor domine : situer la scène.", "wide establishing shot, subject small in the frame", "both"),
    sk("ots", "Par-dessus l'épaule", ["Cadrage", "Dialogue"], "Champ-contrechamp classique pour un dialogue.", "over-the-shoulder shot, foreground shoulder out of focus", "both"),
    sk("low", "Contre-plongée", ["Angle"], "Caméra basse : le personnage domine.", "low angle shot looking up at the subject", "both"),
    sk("high", "Plongée", ["Angle"], "Caméra haute : le personnage est écrasé, vulnérable.", "high angle shot looking down at the subject", "both"),
    sk("profile-r", "Angle droit (profil)", ["Angle"], "Le personnage est vu de profil droit.", "the character is captured in right profile", "both"),
    sk("golden", "Heure dorée", ["Lumière"], "Lumière chaude et rasante du coucher de soleil.", "golden hour lighting, warm low sun, long soft shadows", "both"),
    sk("neon", "Néons nocturnes", ["Lumière", "Ambiance"], "Nuit urbaine, reflets colorés.", "night scene lit by neon signs, wet reflective surfaces", "both"),
    sk("chiaro", "Clair-obscur", ["Lumière", "Ambiance"], "Contraste fort, ombres profondes : thriller, drame.", "chiaroscuro lighting, hard key light, deep shadows", "both"),
    sk("natural", "Lumière naturelle", ["Lumière", "Réalisme"], "Éclairage réaliste, sans effet.", "soft natural window light, realistic exposure", "both"),
    sk("photoreal", "Réalisme brut", ["Style", "Réalisme"], "Rendu photojournalistique, sans lissage.", "ultra realistic cinematic, raw photojournalistic look, real skin texture, subtle film grain", "both"),
    sk("pixar", "3D style Pixar", ["Style"], "Animation 3D expressive, couleurs douces.", "3D animated film style, expressive characters, soft global illumination", "both"),
    sk("cybernoir", "Cyber-noir", ["Style", "Ambiance"], "Thriller sombre, bleus froids et accents néon.", "cyber-noir aesthetic, cold blue palette with neon accents, heavy atmosphere", "both"),
    sk("nosubs", "Sans texte ni musique", ["Règles"], "Aucun texte à l'écran, pas de sous-titres ni de musique : seulement dialogues, bruitages et ambiance.", "no on-screen text, no subtitles, no music, only dialogue, sound effects and ambient sound", "video"),
    sk("sheet", "Fiche personnage", ["Ingrédient"], "Planche de référence du personnage : face, profil, dos.", "character reference sheet, same character shown front view, side profile and back view, neutral grey background, full body, consistent outfit and face", "image")
  ];

  // =========================================================
  // PROJETS (métadonnées dans IndexedDB, médias à part)
  // =========================================================
  A.db = { projects: {}, currentProjectId: null, skills: [] };

  A.newProject = function (name) {
    return {
      id: A.uid(), name: name || "Nouveau projet", createdAt: Date.now(), updatedAt: Date.now(),
      styleGuide: "", negative: "", seed: "", aspect: "16:9", resolution: "1080p", duration: 5, outputs: 1, fps: 24,
      concurrency: 1, library: [], shots: [], montage: { items: {}, opts: {} }
    };
  };
  A.getProject = function () { return A.db.projects[A.db.currentProjectId]; };
  A.getProjectById = function (id) { return A.db.projects[id]; };
  A.sortedShots = function (proj) {
    proj = proj || A.getProject();
    return proj.shots.slice().sort(function (a, b) { return a.order - b.order; });
  };
  A.newShot = function (opts, proj) {
    proj = proj || A.getProject(); opts = opts || {};
    var maxOrder = proj.shots.reduce(function (m, s) { return Math.max(m, s.order); }, 0);
    return Object.assign({
      id: A.uid(), order: maxOrder + 1, mode: "t2v", prompt: "", negative: "",
      aspect: proj.aspect || "16:9", resolution: proj.resolution || "1080p",
      duration: proj.duration || 5, outputs: proj.outputs || 1, seed: "", strength: "",
      sourceRef: "", startRef: "", endRef: "", ingredients: [], skills: [],
      status: "idle", errorMsg: "", takes: [], selectedTakeId: null, lastRaw: null, toLibrary: null
    }, opts);
  };
  A.addShot = function (opts, proj) {
    proj = proj || A.getProject();
    var s = A.newShot(opts, proj); proj.shots.push(s); A.touch(); A.render && A.render(); return s;
  };
  // Crée un plan terminé à partir d'un média local. opts : { prompt, position: "start"|"end"|index, still (s), tin, tout, trans, tdur, label }
  A.addMediaShot = function (blob, kind, opts, proj) {
    proj = proj || A.getProject(); opts = opts || {};
    var take = { id: A.uid(), kind: kind, createdAt: Date.now(), remoteUrl: "", local: true };
    var shot = A.newShot({ mode: kind === "video" ? "t2v" : "t2i", prompt: opts.prompt || "", status: "done", takes: [take], selectedTakeId: take.id, media: opts.label || "média" }, proj);
    if (opts.duration) shot.duration = opts.duration;
    var sorted = A.sortedShots(proj), pos = opts.position === "start" ? 0 : opts.position === "end" || opts.position == null ? sorted.length : A.clamp(opts.position, 0, sorted.length);
    sorted.splice(pos, 0, shot); sorted.forEach(function (s, i) { s.order = i + 1; });
    return AgnesStore.putBlob("take:" + take.id, blob).then(function () {
      if (kind === "image") return A.makeThumb(blob, 320);
      var u = URL.createObjectURL(blob);
      return A.videoFrame(u, "first", 640).then(function (fb) { URL.revokeObjectURL(u); return A.makeThumb(fb, 320); });
    }).catch(function () { return null; }).then(function (thumb) {
      take.thumb = thumb; proj.shots.push(shot);
      var m = proj.montage.items[shot.id] = { on: true, dur: "", tin: "", tout: "", trans: "", tdur: 0.6 };
      if (opts.still) m.dur = opts.still; if (opts.tin != null) m.tin = opts.tin; if (opts.tout != null) m.tout = opts.tout;
      if (opts.trans) m.trans = opts.trans; if (opts.tdur) m.tdur = opts.tdur;
      A.touch(proj); A.render && A.render(); return shot;
    });
  };
  A.selectedTake = function (shot) {
    if (!shot.takes || !shot.takes.length) return null;
    return shot.takes.find(function (t) { return t.id === shot.selectedTakeId; }) || shot.takes[shot.takes.length - 1];
  };
  A.findShot = function (shotId, projId) {
    var proj = projId ? A.db.projects[projId] : A.getProject();
    return proj ? proj.shots.find(function (s) { return s.id === shotId; }) : null;
  };

  // Migration depuis la v2 (localStorage, un seul rendu par plan)
  function migrateV2(old) {
    var out = { projects: {}, currentProjectId: old.currentProjectId, skills: [] };
    Object.keys(old.projects || {}).forEach(function (id) {
      var p = old.projects[id], np = A.newProject(p.name);
      np.id = p.id; np.styleGuide = p.styleGuide || ""; np.seed = p.seed || ""; np.concurrency = p.concurrency || 1;
      var sz = String(p.defaultSize || "1920x1080").split("x"), w = +sz[0], h = +sz[1];
      np.aspect = w === h ? "1:1" : (w > h ? (Math.abs(w / h - 4 / 3) < 0.05 ? "4:3" : "16:9") : (Math.abs(h / w - 4 / 3) < 0.05 ? "3:4" : "9:16"));
      np.resolution = Math.min(w, h) >= 1080 ? "1080p" : "720p";
      np.library = (p.library || []).map(function (l) { return Object.assign({ publicUrl: "", missing: true }, l); });
      np.shots = (p.shots || []).map(function (s) {
        var mode = s.kind === "image" ? "t2i" : (s.startRefId && s.endRefId ? "frames" : (s.startRefId ? "i2v" : "t2v"));
        return A.newShot({
          id: s.id, order: s.order, mode: mode, prompt: s.prompt || "", aspect: np.aspect, resolution: np.resolution,
          duration: s.duration || 5, seed: s.seed || "", sourceRef: mode === "i2v" ? s.startRefId : "",
          startRef: mode === "frames" ? s.startRefId : "", endRef: mode === "frames" ? s.endRefId : "",
          status: "idle"
        }, np);
      });
      out.projects[np.id] = np;
    });
    return out;
  }

  A.loadDB = function () {
    return AgnesStore.getKV("db").catch(function () { return null; }).then(function (stored) {
      if (stored && stored.projects) A.db = stored;
      else {
        try {
          var old = localStorage.getItem("agnes_studio_db_v2");
          if (old) { A.db = migrateV2(JSON.parse(old)); A.toast("Projets de la version précédente importés.", "ok"); }
        } catch (e) { console.warn("Migration v2 impossible :", e); }
      }
      if (!A.db.projects || !Object.keys(A.db.projects).length) {
        var p = A.newProject("Mon premier projet");
        A.db.projects = {}; A.db.projects[p.id] = p; A.db.currentProjectId = p.id;
      }
      if (!A.db.currentProjectId || !A.db.projects[A.db.currentProjectId]) A.db.currentProjectId = Object.keys(A.db.projects)[0];
      if (!Array.isArray(A.db.skills) || !A.db.skills.length) A.db.skills = JSON.parse(JSON.stringify(A.BUILTIN_SKILLS));
      // Plans interrompus par un rechargement
      Object.keys(A.db.projects).forEach(function (pid) {
        var p = A.db.projects[pid];
        p.montage = p.montage || { items: {}, opts: {} };
        p.shots.forEach(function (s) {
          if (s.status === "running" || s.status === "queued") {
            s.status = s.remoteTasks && s.remoteTasks.length ? "resume" : "idle";
            if (s.status === "idle") s.errorMsg = "Génération interrompue par le rechargement de la page — relancez le plan.";
          }
        });
      });
      A.saveDB(true);
    });
  };
  var saveTimer = null;
  A.saveDB = function (now) {
    clearTimeout(saveTimer);
    function write() {
      AgnesStore.setKV("db", JSON.parse(JSON.stringify(A.db))).catch(function (e) {
        A.toast("Enregistrement du projet impossible : " + (e && e.message ? e.message : e), "err");
      });
    }
    if (now) write(); else saveTimer = setTimeout(write, 250);
  };
  A.touch = function (proj) { (proj || A.getProject()).updatedAt = Date.now(); A.saveDB(); };

  // =========================================================
  // MÉDIAS
  // =========================================================
  A.fileToDataUrl = function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("Lecture du fichier impossible.")); };
      r.readAsDataURL(file);
    });
  };
  A.blobToDataUrl = A.fileToDataUrl;
  A.dataUrlToBlob = function (dataUrl) {
    var parts = dataUrl.split(","), mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
    var bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };
  A.loadImage = function (src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Image illisible.")); };
      img.src = src;
    });
  };
  function canvasFrom(source, sw, sh, maxW) {
    var scale = Math.min(1, (maxW || sw) / sw);
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
    c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
    return c;
  }
  A.canvasToBlob = function (canvas, type, q) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("Conversion d'image impossible.")); }, type || "image/jpeg", q || 0.92);
    });
  };
  // Vignette légère (dataURL JPEG) à partir d'une URL ou d'un Blob image
  A.makeThumb = function (srcOrBlob, maxW) {
    var src = srcOrBlob instanceof Blob ? URL.createObjectURL(srcOrBlob) : srcOrBlob;
    return A.loadImage(src).then(function (img) {
      var c = canvasFrom(img, img.naturalWidth, img.naturalHeight, maxW || 320);
      if (srcOrBlob instanceof Blob) URL.revokeObjectURL(src);
      return c.toDataURL("image/jpeg", 0.72);
    });
  };
  // Capture d'une image d'une vidéo : at = secondes, "first" ou "last" → Blob JPEG
  A.videoFrame = function (src, at, maxW) {
    return new Promise(function (resolve, reject) {
      var v = document.createElement("video"), done = false;
      if (/^https?:/i.test(src)) v.crossOrigin = "anonymous";
      v.muted = true; v.playsInline = true; v.preload = "auto";
      var timer = setTimeout(function () { finish(new Error("Délai dépassé pendant la lecture de la vidéo.")); }, 15000);
      function finish(err, val) { if (done) return; done = true; clearTimeout(timer); v.removeAttribute("src"); v.load(); err ? reject(err) : resolve(val); }
      v.addEventListener("loadedmetadata", function () {
        var d = v.duration || 0, t = at === "first" ? 0.05 : at === "last" ? Math.max(0, d - 0.08) : Math.min(Math.max(0, +at || 0), Math.max(0, d - 0.05));
        try { v.currentTime = t; } catch (e) { finish(e); }
      });
      v.addEventListener("seeked", function () {
        try {
          var c = canvasFrom(v, v.videoWidth || 1280, v.videoHeight || 720, maxW);
          A.canvasToBlob(c, "image/jpeg", 0.92).then(function (b) { finish(null, b); }, finish);
        } catch (e) { finish(e); }
      });
      v.addEventListener("error", function () { finish(new Error("Vidéo illisible.")); });
      v.src = src;
    });
  };

  // ---- Blobs des prises et de la bibliothèque ----
  var urlCache = new Map();
  A.objectUrlFor = function (key) {
    if (urlCache.has(key)) return Promise.resolve(urlCache.get(key));
    return AgnesStore.getBlob(key).then(function (b) {
      if (!b) return null;
      var u = URL.createObjectURL(b); urlCache.set(key, u); return u;
    });
  };
  A.forgetUrl = function (key) { if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); } };
  A.audioExt = function (blob) {
    var t = (blob && blob.type) || "";
    return /mpeg|mp3/.test(t) ? "mp3" : /wav/.test(t) ? "wav" : /ogg/.test(t) ? "ogg" : /mp4|aac|m4a/.test(t) ? "m4a" : /webm/.test(t) ? "webm" : "mp3";
  };
  A.getTakeBlob = function (takeId) { return AgnesStore.getBlob("take:" + takeId); };
  A.getTakeSrc = function (take) {
    if (!take) return Promise.resolve(null);
    return A.objectUrlFor("take:" + take.id).then(function (u) { return u || take.remoteUrl || null; });
  };
  A.getLibSrc = function (item) {
    return A.objectUrlFor("lib:" + item.id).then(function (u) { return u || item.publicUrl || null; });
  };
  A.getLibBlob = function (item) {
    return AgnesStore.getBlob("lib:" + item.id).then(function (b) {
      if (b) return b;
      if (item.publicUrl) return fetch(item.publicUrl).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); }).catch(function () { return null; });
      return null;
    });
  };
  // Blob d'une prise (ou tentative de téléchargement depuis son URL distante)
  A.getTakeBlobOrFetch = function (take) {
    return A.getTakeBlob(take.id).then(function (b) {
      if (b) return b;
      if (!take.remoteUrl) return null;
      return fetch(take.remoteUrl).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
        .then(function (blob) { AgnesStore.putBlob("take:" + take.id, blob); return blob; })
        .catch(function () { return null; });
    });
  };

  // Ajoute une image (Blob) à la bibliothèque du projet
  A.addLibraryItem = function (blob, meta, proj) {
    proj = proj || A.getProject();
    var item = Object.assign({ id: A.uid(), name: "Ingrédient", kind: "personnage", seed: "", publicUrl: "", thumb: null, createdAt: Date.now() }, meta || {});
    return AgnesStore.putBlob("lib:" + item.id, blob).then(function () { return A.makeThumb(blob, 320); })
      .then(function (thumb) {
        item.thumb = thumb; item.missing = false; proj.library.push(item); A.touch(proj);
        A.render && A.render(); return item;
      });
  };

  // =========================================================
  // ENVOI DES IMAGES À L'API (URL publique requise par Agnes)
  // =========================================================
  A.uploadImgbb = function (blob) {
    var fd = new FormData();
    return A.blobToDataUrl(blob).then(function (dataUrl) {
      fd.append("image", dataUrl.split(",")[1]);
      return fetch("https://api.imgbb.com/1/upload?key=" + encodeURIComponent(A.settings.imgbbKey), { method: "POST", body: fd });
    }).then(function (r) { return r.json(); }).then(function (j) {
      var url = j && j.data && (j.data.url || j.data.display_url);
      if (!url) throw { display: "Hébergement imgbb refusé : " + ((j && j.error && j.error.message) || "réponse inattendue"), json: j };
      return url;
    });
  };
  // Réduit une image trop lourde avant envoi (côté long max 2048 px)
  A.shrinkBlob = function (blob, maxSide) {
    maxSide = maxSide || 2048;
    var u = URL.createObjectURL(blob);
    return A.loadImage(u).then(function (img) {
      URL.revokeObjectURL(u);
      var side = Math.max(img.naturalWidth, img.naturalHeight);
      if (side <= maxSide && blob.size < 3.5e6) return blob;
      var s = maxSide / side, c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return A.canvasToBlob(c, "image/jpeg", 0.9);
    });
  };
  // Blob → URL utilisable par l'API (imgbb si configuré, sinon data URL)
  A.blobToApiUrl = function (blob) {
    return A.shrinkBlob(blob).then(function (b) {
      if (A.settings.imgbbKey) return A.uploadImgbb(b);
      return A.blobToDataUrl(b);
    });
  };
  // Ingrédient de bibliothèque → URL API (mise en cache de l'URL publique)
  A.libItemToApiUrl = function (item, proj) {
    if (item.publicUrl) return Promise.resolve(item.publicUrl);
    return AgnesStore.getBlob("lib:" + item.id).then(function (b) {
      if (!b) throw { display: "L'image « " + item.name + " » n'est plus disponible — réimportez-la dans la Bibliothèque." };
      return A.blobToApiUrl(b).then(function (url) {
        if (/^https?:/i.test(url)) { item.publicUrl = url; A.touch(proj); }
        return url;
      });
    });
  };
})();
