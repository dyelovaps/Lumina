// js/app-skills-batch.js — Skills (patchs de prompt) et Skill → Clip (le lot est dans app-batch.js)
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId, esc = A.esc;
  var TARGET_LABEL = { both: "image + vidéo", video: "vidéo", image: "image" };

  // =========================================================
  // SKILLS — liste et éditeur
  // =========================================================
  var editingId = null, catFilter = "", pickState = new Set();

  function allCategories() {
    var set = {}; A.db.skills.forEach(function (s) { (s.categories || []).forEach(function (c) { set[c] = true; }); });
    return Object.keys(set).sort();
  }
  A.renderSkills = function () {
    var cats = allCategories();
    byId("skillCatFilter").innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(function (c) { return '<option' + (c === catFilter ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("");
    var q = byId("skillSearch").value.trim().toLowerCase();
    var list = A.db.skills.filter(function (s) {
      if (catFilter && (s.categories || []).indexOf(catFilter) === -1) return false;
      if (q && (s.title + " " + (s.description || "") + " " + (s.action || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    byId("skillList").innerHTML = list.length ? list.map(function (s) {
      return '<button class="skill-item' + (s.id === editingId ? " active" : "") + '" data-sk="' + s.id + '" title="' + esc(s.description || s.action) + '">' +
        '<b>' + esc(s.title) + '</b><small>' + esc((s.categories || []).join(", ")) + ' · ' + TARGET_LABEL[s.target || "both"] + '</small></button>';
    }).join("") : '<p class="hint">Aucun skill ne correspond.</p>';
    byId("skillCount").textContent = list.length + (list.length < A.db.skills.length ? " / " + A.db.skills.length : "") + " skill(s)";
    renderPick(); renderPacks();
  };
  function renderPick() {
    var byCat = {};
    A.db.skills.forEach(function (s) { var c = (s.categories && s.categories[0]) || "Autres"; (byCat[c] = byCat[c] || []).push(s); });
    byId("s2cPick").innerHTML = Object.keys(byCat).sort().map(function (c) {
      return '<h4>' + esc(c) + '</h4><div class="chips" style="margin-top:0;">' + byCat[c].map(function (s) {
        return '<button type="button" class="chip skill' + (pickState.has(s.id) ? " on" : "") + '" data-pick="' + s.id + '" title="' + esc(s.description || s.action) + '">' + esc(s.title) + '</button>';
      }).join("") + '</div>';
    }).join("");
  }
  function loadEditor(s) {
    editingId = s ? s.id : null;
    byId("skillEditorTitle").textContent = s ? "Modifier « " + s.title + " »" : "Nouveau skill";
    byId("skTitle").value = s ? s.title : ""; byId("skCats").value = s ? (s.categories || []).join(", ") : "";
    byId("skDesc").value = s ? s.description || "" : ""; byId("skAction").value = s ? s.action || "" : "";
    byId("skTarget").value = s ? s.target || "both" : "both";
    A.renderSkills();
  }
  function saveEditor() {
    var title = byId("skTitle").value.trim(), action = byId("skAction").value.trim();
    if (!title || !action) { A.toast("Un skill a besoin d'un nom et d'une action.", "err"); return; }
    var data = {
      title: title, action: action, description: byId("skDesc").value.trim(), target: byId("skTarget").value,
      categories: byId("skCats").value.split(",").map(function (c) { return c.trim(); }).filter(Boolean)
    };
    if (!data.categories.length) data.categories = ["Mes skills"];
    var s = editingId && A.db.skills.find(function (x) { return x.id === editingId; });
    if (s) Object.assign(s, data); else { s = Object.assign({ id: "u-" + A.uid() }, data); A.db.skills.push(s); }
    A.saveDB(); loadEditor(s); A.renderShots(); A.refreshPickers(); A.toast("Skill enregistré.", "ok");
  }

  // ---- Import : tableau de skills, format AIStudioGuide (promptBlocks), ou fichier .md/.txt ----
  function normalizeImported(obj, fallbackTitle) {
    var out = [];
    function actionOf(o) { return typeof o === "string" ? o : (o && (o.action || o.prompt || o.promptBlock || o.text || o.content || o.block || o.value)); }
    function titleOf(o, i) { return (o && (o.title || o.name || o.label)) || (fallbackTitle + " " + (i + 1)); }
    function descOf(o, parent) { return (o && (o.description || o.simpleExplanation || o.tooltip)) || (parent && (parent.description || parent.simpleExplanation)) || ""; }
    function push(o, i, parent) {
      var action = actionOf(o); if (!action || typeof action !== "string") return;
      var cats = (o && (o.categories || o.category)) || (parent && (parent.title || parent.name)) || "Importés";
      out.push({ id: "u-" + A.uid(), title: titleOf(o, i), action: action.trim(), description: descOf(o, parent),
        categories: Array.isArray(cats) ? cats : [String(cats)], target: (o && o.target) || "both" });
    }
    function walk(node, parent) {
      if (Array.isArray(node)) { node.forEach(function (n, i) { if (actionOf(n) && typeof n === "object") push(n, i, parent); else walk(n, parent); }); return; }
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node.promptBlocks) || (node.promptBlocks && typeof node.promptBlocks === "object")) {
        var blocks = Array.isArray(node.promptBlocks) ? node.promptBlocks : Object.keys(node.promptBlocks).map(function (k) { var b = node.promptBlocks[k]; return typeof b === "string" ? { title: k, prompt: b } : Object.assign({ title: k }, b); });
        blocks.forEach(function (b, i) { push(b, i, node); });
      }
      if (node.action && node.title) { push(node, 0, parent); return; }
      Object.keys(node).forEach(function (k) { if (k !== "promptBlocks" && typeof node[k] === "object") walk(node[k], node.title ? node : parent); });
    }
    walk(obj, null);
    return out;
  }
  // =========================================================
  // IMPORT EN MASSE : fichiers (.md/.txt/.csv/.json), texte collé ou pack → aperçu → import
  // =========================================================
  var pending = [];   // candidats en attente : { title, action, description, categories[], target, id?, on }
  function normTitle(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function targetOf(v) {
    v = String(v || "").toLowerCase();
    var img = /image|img|photo/.test(v), vid = /vid|video|clip|anim/.test(v);
    return img && !vid ? "image" : vid && !img ? "video" : "both";
  }
  function splitCats(v) { return String(v || "").split(/[,|;\/]/).map(function (c) { return c.trim(); }).filter(Boolean); }
  function mk(title, action, desc, cats, target) {
    return { title: String(title || "").replace(/\*\*|__/g, "").trim(), action: String(action || "").trim(), description: String(desc || "").trim(),
      categories: cats && cats.length ? cats : [], target: target || "both" };
  }
  // .md / .txt : « # Catégorie », puis un « ## Nom » par skill avec « Explication : », « Action : », « Catégories : », « Cible : ».
  // Format court accepté : « - Nom : action » sous une catégorie.
  function parseSkillText(text, base) {
    var out = [], cat = "", cur = null, field = null;
    var LBL = /^(explication|description|infobulle|action(?: cach[ée]e)?|prompt|cat[ée]gories?|cible|s'applique [àa]|target)\s*:\s*(.*)$/i;
    function close() { if (cur && cur.action) out.push(mk(cur.title, cur.action, cur.desc, cur.cats.length ? cur.cats : (cat ? [cat] : []), cur.target)); cur = null; field = null; }
    String(text).replace(/\r/g, "").split("\n").forEach(function (raw) {
      var line = raw.replace(/\*\*/g, "").trim(), m;
      if (!line) { if (field === "desc") field = null; return; }
      if ((m = line.match(/^#\s+(.+)$/))) { close(); cat = m[1].replace(/^cat[ée]gorie\s*:\s*/i, "").trim(); return; }
      if ((m = line.match(/^#{2,4}\s+(.+)$/))) { close(); cur = { title: m[1], action: "", desc: "", cats: [], target: "both" }; return; }
      if (!cur && (m = line.match(/^cat[ée]gorie\s*:\s*(.+)$/i))) { cat = m[1].trim(); return; }
      if (!cur && (m = line.match(/^[-*•]\s+(.+?)\s*[:：—–]\s+(.+)$/))) { out.push(mk(m[1], m[2], "", cat ? [cat] : [], "both")); return; }
      if (!cur) return;
      if ((m = line.match(LBL))) {
        var k = m[1].toLowerCase(), v = m[2];
        if (/^(explication|description|infobulle)/.test(k)) { cur.desc = v; field = "desc"; }
        else if (/^(action|prompt)/.test(k)) { cur.action = v; field = "action"; }
        else if (/^cat/.test(k)) { cur.cats = splitCats(v); field = null; }
        else { cur.target = targetOf(v); field = null; }
        return;
      }
      if (field === "desc") cur.desc += " " + line;
      else cur.action = cur.action ? cur.action + " " + line : line;   // texte sans étiquette = action
    });
    close();
    if (!out.length && String(text).trim()) {   // ancien comportement : le fichier entier = un skill
      var first = (String(text).split("\n").find(function (l) { return l.trim(); }) || "").replace(/^#+\s*/, "").slice(0, 160);
      out.push(mk(base, String(text).trim().slice(0, 2000), first, [], "both"));
    }
    return out;
  }
  // .csv / .tsv : nom ; catégories ; action ; explication ; cible (en-tête facultatif, dans n'importe quel ordre)
  function parseSkillCsv(text) {
    var lines = String(text).replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); }); if (!lines.length) return [];
    var sep = /\t/.test(lines[0]) ? "\t" : (lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",");
    function cells(l) {
      var out = [], cur = "", q = false;
      for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === sep && !q) { out.push(cur.trim()); cur = ""; } else cur += c; }
      out.push(cur.trim()); return out;
    }
    var head = cells(lines[0]).map(function (h) { return h.toLowerCase(); }), col = { title: 0, cats: 1, action: 2, desc: 3, target: 4 }, start = 0;
    if (head.some(function (h) { return /^(nom|name|titre|title|action|prompt)/.test(h); })) {
      start = 1; col = { title: -1, cats: -1, action: -1, desc: -1, target: -1 };
      head.forEach(function (h, i) {
        if (/^(nom|name|titre|title)/.test(h)) col.title = i; else if (/^cat/.test(h)) col.cats = i; else if (/^(action|prompt|texte)/.test(h)) col.action = i;
        else if (/^(explication|description|infobulle)/.test(h)) col.desc = i; else if (/^(cible|target|s'applique)/.test(h)) col.target = i;
      });
    }
    return lines.slice(start).map(function (l) {
      var c = cells(l), g = function (k) { return col[k] >= 0 ? c[col[k]] || "" : ""; };
      return mk(g("title"), g("action"), g("desc"), splitCats(g("cats")), targetOf(g("target")));
    }).filter(function (x) { return x.title && x.action; });
  }
  function parseSkillFile(name, text) {
    var base = name.replace(/\.[^.]+$/, "");
    if (/\.json$/i.test(name)) return normalizeImported(JSON.parse(text), base).map(function (x) { return mk(x.title, x.action, x.description, x.categories && x.categories[0] === "Importés" ? [] : x.categories, x.target); });
    if (/\.(csv|tsv)$/i.test(name)) return parseSkillCsv(text);
    return parseSkillText(text, base);
  }
  function addPending(list, label) {
    var n = 0;
    list.forEach(function (x) { if (x.title && x.action) { x.on = true; pending.push(x); n++; } });
    renderPreview();
    if (!n) A.toast("Aucun skill trouvé" + (label ? " dans « " + label + " »" : "") + ". Voir « Modèle .md » pour le format.", "err");
    else byId("skPreview").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function readFiles(files) {
    Promise.all(Array.from(files).map(function (f) {
      return f.text().then(function (t) { return parseSkillFile(f.name, t); }).catch(function (e) { A.toast("« " + f.name + " » illisible : " + e.message, "err"); return []; });
    })).then(function (lists) { addPending([].concat.apply([], lists), files.length === 1 ? files[0].name : ""); byId("skillImport").value = ""; });
  }
  function finalCats(x) {
    var c = byId("skImpCat").value.trim(), cats = x.categories.slice();
    if (c && byId("skImpReplace").checked) cats = [c];
    else if (c && cats.indexOf(c) === -1) cats.unshift(c);
    return cats.length ? cats : ["Importés"];
  }
  function existing(x) {
    var t = normTitle(x.title);
    return (x.id && A.db.skills.find(function (s) { return s.id === x.id; })) || A.db.skills.find(function (s) { return normTitle(s.title) === t; });
  }
  function renderPreview() {
    var box = byId("skPreview"), dup = byId("skImpDup").value;
    if (!pending.length) { box.innerHTML = ""; return; }
    var counts = { add: 0, upd: 0, skip: 0 };
    var rows = pending.map(function (x, i) {
      var ex = existing(x), state = !ex ? "add" : dup === "update" ? "upd" : dup === "add" ? "add" : "skip";
      if (x.on) counts[state]++;
      var tag = !ex ? '<span class="ext-tag ok">nouveau</span>' : state === "upd" ? '<span class="ext-tag">mise à jour</span>' : state === "skip" ? '<span class="ext-tag err">existe déjà : ignoré</span>' : '<span class="ext-tag">copie</span>';
      return '<div class="sk-prev-row' + (x.on ? "" : " off") + '"><input type="checkbox" data-pi="' + i + '"' + (x.on ? " checked" : "") + '>' +
        '<div class="grow"><b>' + esc(x.title) + '</b> ' + tag + '<br><span class="hint" style="margin:0">' + esc(finalCats(x).join(", ")) + ' · ' + TARGET_LABEL[x.target || "both"] + '</span>' +
        '<div class="sk-prev-action">' + esc(x.action.slice(0, 160)) + (x.action.length > 160 ? "…" : "") + '</div></div></div>';
    }).join("");
    var total = counts.add + counts.upd;
    box.innerHTML = '<div class="sk-prev"><div class="row-inline" style="justify-content:space-between"><b>' + pending.length + ' skill(s) lu(s)</b>' +
      '<span class="hint" style="margin:0">' + counts.add + ' à ajouter · ' + counts.upd + ' à mettre à jour' + (counts.skip ? ' · ' + counts.skip + ' ignoré(s)' : '') + '</span></div>' +
      '<div class="sk-prev-list">' + rows + '</div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="skImpGo" type="button"' + (total ? "" : " disabled") + '>Importer ' + total + ' skill(s)</button>' +
      '<button class="small-btn" id="skImpAll" type="button">Tout cocher / décocher</button><button class="small-btn" id="skImpCancel" type="button">Annuler</button></div></div>';
  }
  function applyImport() {
    var dup = byId("skImpDup").value, added = 0, updated = 0, firstCat = null;
    pending.filter(function (x) { return x.on; }).forEach(function (x) {
      var cats = finalCats(x), ex = existing(x);
      firstCat = firstCat || cats[0];
      if (ex && dup === "skip") return;
      if (ex && dup === "update") { Object.assign(ex, { title: x.title, action: x.action, description: x.description, categories: cats, target: x.target || "both" }); updated++; return; }
      var id = x.id && !A.db.skills.some(function (s) { return s.id === x.id; }) ? x.id : "u-" + A.uid();
      A.db.skills.push({ id: id, title: x.title, action: x.action, description: x.description, categories: cats, target: x.target || "both" }); added++;
    });
    pending = []; A.saveDB();
    if (firstCat) { catFilter = firstCat; }
    byId("skImpCat").value = ""; byId("skImpReplace").checked = false;   // options d'un import : pas reportées au suivant
    A.renderSkills(); A.refreshPickers(); A.renderShots(); renderPreview(); renderPacks();
    A.toast(added + " skill(s) ajouté(s)" + (updated ? ", " + updated + " mis à jour" : "") + (firstCat ? " — filtre : « " + firstCat + " »" : "") + ".", "ok");
  }
  function renderPacks() {
    var box = byId("skPacks"); if (!box) return;
    box.innerHTML = (A.SKILL_PACKS || []).map(function (p) {
      var have = p.skills.filter(function (x) { return existing(x); }).length;
      return '<button type="button" class="chip' + (have === p.skills.length ? " on" : "") + '" data-pack="' + p.id + '" title="' + esc(p.description) + '">' + esc(p.title) +
        ' (' + p.skills.length + ')' + (have === p.skills.length ? " ✓" : have ? " · " + have + " déjà là" : "") + '</button>';
    }).join("");
    var cats = {}; A.db.skills.forEach(function (s) { (s.categories || []).forEach(function (c) { cats[c] = 1; }); });
    byId("skCatList").innerHTML = Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }
  var TEMPLATE_MD = "# Position spatiale\n\n## Voiture — conducteur\nExplication : le personnage conduit, filmé depuis le siège passager.\nCible : image et vidéo\nAction : the character sits in the driver's seat of a car, hands on the steering wheel, filmed from the passenger seat\n\n" +
    "## Selfie bras tendu\nExplication : le personnage se filme lui-même.\nCatégories : Position spatiale, UGC\nAction : handheld selfie point of view, the character talks to camera\n\n# Style visuel\n\n" +
    "## Animé japonais\nExplication : dessin animé japonais 2D.\nAction : Japanese anime style, 2D cel-shaded animation, clean line art\n\n" +
    "Format court, un skill par ligne sous une catégorie :\n# Lumière\n- Néon rose : pink neon light, glowing reflections\n- Contre-jour : strong backlight, rim light around the subject\n";
  var TEMPLATE_CSV = "nom;catégories;action;explication;cible\n" +
    "Voiture — conducteur;Position spatiale;the character sits in the driver's seat of a car, hands on the steering wheel;Le personnage conduit.;image et vidéo\n" +
    "Animé japonais;Style visuel;Japanese anime style, 2D cel-shaded animation;Dessin animé japonais 2D.;image et vidéo\n" +
    "Zoom brusque;Mouvement, Brainrot;sudden punchy zoom-in on the face;Zoom comique rapide.;vidéo\n";
  function download(text, name, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function initImport() {
    var drop = byId("skDrop");
    drop.addEventListener("click", function (e) { if (e.target.id !== "skillImport") byId("skillImport").click(); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); byId("skillImport").click(); } });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });
    byId("skillImport").addEventListener("change", function () { if (this.files.length) readFiles(this.files); });
    byId("skPasteBtn").addEventListener("click", function () { var t = byId("skPaste").value; if (t.trim()) addPending(parseSkillText(t, "Texte collé")); });
    byId("skPacks").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pack]"); if (!b) return;
      var p = (A.SKILL_PACKS || []).find(function (x) { return x.id === b.getAttribute("data-pack"); }); if (!p) return;
      addPending(p.skills.map(function (x) { return Object.assign({}, x, { categories: x.categories.slice() }); }), p.title);
    });
    ["skImpCat", "skImpDup", "skImpReplace"].forEach(function (id) { byId(id).addEventListener(id === "skImpCat" ? "input" : "change", renderPreview); });
    byId("skPreview").addEventListener("change", function (e) { var i = e.target.getAttribute("data-pi"); if (i != null) { pending[+i].on = e.target.checked; renderPreview(); } });
    byId("skPreview").addEventListener("click", function (e) {
      if (e.target.id === "skImpGo") applyImport();
      if (e.target.id === "skImpCancel") { pending = []; renderPreview(); }
      if (e.target.id === "skImpAll") { var on = !pending.every(function (x) { return x.on; }); pending.forEach(function (x) { x.on = on; }); renderPreview(); }
    });
    byId("skTplMd").addEventListener("click", function () { download(TEMPLATE_MD, "modele-skills.md", "text/markdown"); });
    byId("skTplCsv").addEventListener("click", function () { download("\ufeff" + TEMPLATE_CSV, "modele-skills.csv", "text/csv"); });
    byId("skillGoImport").addEventListener("click", function () { byId("skImportBox").scrollIntoView({ behavior: "smooth", block: "start" }); });
    renderPacks();
  }
  A.parseSkillText = parseSkillText; A.parseSkillCsv = parseSkillCsv;   // réutilisés ailleurs (tests, extensions)

  function exportSkills() {
    var data = { format: "agnes-studio-skills", version: 1, exportedAt: new Date().toISOString(), skills: A.db.skills.map(function (s) {
      return { id: s.id, title: s.title, categories: s.categories, description: s.description, action: s.action, target: s.target };
    }) };
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "skills-agnes-studio.json"; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---- Skill → Clip ----
  function createFromSkills() {
    var ids = Array.from(pickState), subject = byId("s2cSubject").value.trim(), mode = byId("s2cMode").value;
    if (!ids.length) { A.toast("Cochez au moins un skill.", "err"); return; }
    if (!subject) { A.toast("Décrivez le sujet ou la scène.", "err"); return; }
    var source = byId("s2cSource").value;
    if ((mode === "i2v" || mode === "i2i") && !source) { A.toast("Choisissez une image source pour ce mode.", "err"); return; }
    var proj = A.getProject(), base = {
      mode: mode, prompt: subject, sourceRef: source, aspect: byId("s2cAspect").value,
      duration: A.clamp(byId("s2cDuration").value, 1, 60), outputs: A.clamp(byId("s2cOutputs").value, 1, 4)
    };
    var created = byId("s2cSplit").value === "each"
      ? ids.map(function (id) { var s = A.newShot(Object.assign({}, base, { skills: [id] }), proj); proj.shots.push(s); return s; })
      : (function () { var s = A.newShot(Object.assign({}, base, { skills: ids }), proj); proj.shots.push(s); return [s]; })();
    A.touch(); A.renderShots();
    if (byId("s2cRunNow").checked) A.enqueueMany(created, proj);
    A.toast(created.length + " clip(s) créé(s) dans le storyboard.", "ok");
  }

  function initSkills() {
    byId("skillList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-sk]"); if (!b) return;
      loadEditor(A.db.skills.find(function (s) { return s.id === b.getAttribute("data-sk"); }));
    });
    byId("skillCatFilter").addEventListener("change", function () { catFilter = this.value; A.renderSkills(); });
    byId("skillSearch").addEventListener("input", A.renderSkills);
    byId("skSaveBtn").addEventListener("click", saveEditor);
    byId("skNewBtn").addEventListener("click", function () { loadEditor(null); byId("skTitle").focus(); });
    byId("skDupBtn").addEventListener("click", function () {
      var s = editingId && A.db.skills.find(function (x) { return x.id === editingId; }); if (!s) return;
      var c = Object.assign({}, s, { id: "u-" + A.uid(), title: s.title + " (copie)", builtin: false });
      A.db.skills.push(c); A.saveDB(); loadEditor(c);
    });
    byId("skDelBtn").addEventListener("click", function () {
      if (!editingId) return; var s = A.db.skills.find(function (x) { return x.id === editingId; });
      if (!s || !window.confirm("Supprimer le skill « " + s.title + " » ? Il sera retiré des plans qui l'utilisent.")) return;
      A.db.skills = A.db.skills.filter(function (x) { return x.id !== editingId; });
      Object.keys(A.db.projects).forEach(function (pid) { A.db.projects[pid].shots.forEach(function (sh) { sh.skills = (sh.skills || []).filter(function (x) { return x !== editingId; }); }); });
      pickState.delete(editingId); A.saveDB(); loadEditor(null); A.renderShots(); A.refreshPickers();
    });
    initImport();
    byId("skillExportBtn").addEventListener("click", exportSkills);
    byId("s2cPick").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick]"); if (!b) return;
      var id = b.getAttribute("data-pick"); if (pickState.has(id)) pickState.delete(id); else pickState.add(id);
      b.classList.toggle("on", pickState.has(id));
    });
    byId("s2cMode").innerHTML = A.optionsHtml([["t2v", A.MODES.t2v.label], ["i2v", A.MODES.i2v.label], ["t2i", A.MODES.t2i.label], ["i2i", A.MODES.i2i.label]], "t2v");
    byId("s2cCreateBtn").addEventListener("click", createFromSkills);
  }

  A.initSkillsBatch = function () { initSkills(); if (A.initBatch) A.initBatch(); };
  // Valeurs par défaut des outils = réglages du projet courant (appelé au démarrage et au changement de projet)
  A.refreshToolDefaults = function () {
    var p = A.getProject(); if (!p) return;
    byId("s2cAspect").innerHTML = A.optionsHtml(A.ASPECTS, p.aspect);
    if (A.refreshBatchDefaults) A.refreshBatchDefaults(p);
  };
})();
