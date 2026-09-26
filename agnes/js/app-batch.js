// js/app-batch.js — Le lot
// Deux façons de travailler :
//  1. Script numéroté : un script avec, pour chaque numéro (01, 02, 03…), un prompt IMAGE et/ou un prompt VIDÉO.
//     Les images déposées sont reliées par le numéro au début de leur nom (01.png, plan_02.jpg, 05a/05b…).
//     Pour chaque numéro, une seule carte : IMAGE + VIDÉO → carte Texte → Vidéo avec prompt image (l'image est
//     générée avec les références du numéro, validée, puis animée) ; IMAGE seule → Texte → Image ; VIDÉO seule →
//     Texte → Vidéo ; image déposée → Image → Vidéo. Références par numéro : ligne « RÉF : Léa, Marc » ou noms
//     de la Bibliothèque cités dans les prompts.
//  2. Opérations sur des fichiers : un plan (ou un ingrédient) par fichier, même prompt pour tous.
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId, esc = A.esc;
  var AGNES_ASPECTS = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4]];
  var TEXT_EXT = /\.(txt|md|markdown|json|csv|tsv)$/i;
  var batch = [];            // fichiers déposés : { id, file, url, isVideo, name, num, role, w, h }
  var edits = {};            // modifications faites dans la vérification, par clé de ligne
  var excluded = {};         // lignes décochées

  // =========================================================
  // NOMS DE FICHIERS : numéro au début
  // =========================================================
  A.parseShotFileName = function (name) {
    var base = String(name || "").replace(/\.[^.]+$/, "");
    var m = base.match(/^\s*(?:plan|shot|sc[eè]ne|scene|still|image|img|p)?[\s_\-.#]*(\d{1,4})(?:[\s_\-.]*(a|b|start|end|debut|début|fin|first|last|in|out))?(?=$|[\s_\-.()\[\]])/i);
    if (!m) return { num: null, role: "single", base: base };
    var suf = (m[2] || "").toLowerCase(), role = "single";
    if (/^(a|start|debut|début|first|in)$/.test(suf)) role = "start";
    if (/^(b|end|fin|last|out)$/.test(suf)) role = "end";
    return { num: parseInt(m[1], 10), role: role, base: base };
  };
  function natural(a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" }); }
  function pad(n) { return n == null ? "—" : String(n).padStart(2, "0"); }

  // =========================================================
  // SCRIPT : lecture des prompts IMAGE / VIDÉO par numéro
  // =========================================================
  var IMG_LABEL = "(?:prompt\\s+)?(?:image|img|photo|visuel|still|t2i)(?:\\s+prompt)?";
  var VID_LABEL = "(?:prompt\\s+)?(?:vid[ée]o|anim(?:ation)?|mouvement|motion|i2v)(?:\\s+prompt)?";
  var REF_LABEL = "(?:r[ée]f(?:[ée]rence)?s?|personnages?|casting|avec)";
  var SKILL_LABEL = "(?:skills?|effets?)";
  var RE_LABEL = new RegExp("^(" + IMG_LABEL + "|" + VID_LABEL + "|" + REF_LABEL + "|" + SKILL_LABEL + ")\\s*(\\d{1,4})?\\s*[:：\\-–—=>]+\\s*(.*)$", "i");
  var RE_IMG = new RegExp("^" + IMG_LABEL + "$", "i"), RE_REF = new RegExp("^" + REF_LABEL + "$", "i"), RE_SKILL = new RegExp("^" + SKILL_LABEL + "$", "i");
  function labelField(l) { l = l.trim(); return RE_IMG.test(l) ? "img" : RE_REF.test(l) ? "ref" : RE_SKILL.test(l) ? "skill" : "vid"; }
  var RE_NUM = /^(?:plan|shot|sc[eè]ne|scene|s[ée]quence|p)?\s*[#n°]*\s*(\d{1,4})(?=\s*$|\s*[:：.)\]\-–—|]|\s+(?:prompt|image|img|photo|visuel|still|vid|anim|mouvement|motion)\b)\s*[:：.)\]\-–—|]*\s*(.*)$/i;

  function cleanLine(l) {
    return l.replace(/\r/g, "").replace(/\*\*|__/g, "").replace(/^\s*(?:[-*•>]\s+|#{1,6}\s*)/, "")
      .replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, "").replace(/^\s*\[(\d{1,4})\]/, "$1").trim();
  }
  function emptyEntry(num) { return { num: num, img: "", vid: "", ref: "", skill: "", other: "", title: "" }; }

  // Tableau Markdown ou CSV : colonnes numéro / image / vidéo
  function columnsFromHeader(cells) {
    var idx = { img: -1, vid: -1, ref: -1, skill: -1 };
    cells.forEach(function (c, i) {
      if (idx.img < 0 && /image|img|photo|visuel|still/i.test(c)) idx.img = i;
      else if (idx.vid < 0 && /vid[ée]o|anim|mouvement|motion/i.test(c)) idx.vid = i;
      else if (idx.ref < 0 && /r[ée]f|personnage|casting/i.test(c)) idx.ref = i;
      else if (idx.skill < 0 && /skill|effet/i.test(c)) idx.skill = i;
    });
    return idx.img >= 0 || idx.vid >= 0 ? idx : null;
  }
  function entryFromCells(cells, cols) {
    var m = String(cells[0] || "").match(/(\d{1,4})/);
    if (!m) return null;
    var e = emptyEntry(parseInt(m[1], 10));
    if (cols) { e.img = cols.img >= 0 ? (cells[cols.img] || "") : ""; e.vid = cols.vid >= 0 ? (cells[cols.vid] || "") : ""; e.ref = cols.ref >= 0 ? (cells[cols.ref] || "") : ""; e.skill = cols.skill >= 0 ? (cells[cols.skill] || "") : ""; }
    else if (cells.length >= 3) { e.img = cells[1] || ""; e.vid = cells[2] || ""; }
    else e.other = cells[1] || "";
    e.img = e.img.trim(); e.vid = e.vid.trim(); e.ref = e.ref.trim(); e.skill = e.skill.trim(); e.other = e.other.trim();
    return e;
  }

  A.parseBatchScript = function (text, fileName) {
    var entries = {}, order = [];
    function get(num) { if (!entries[num]) { entries[num] = emptyEntry(num); order.push(num); } return entries[num]; }
    function merge(e) { if (!e) return; var t = get(e.num); ["img", "vid", "other"].forEach(function (k) { if (e[k]) t[k] = t[k] ? t[k] + " " + e[k] : e[k]; }); if (e.ref) t.ref = t.ref ? t.ref + ", " + e.ref : e.ref; if (e.skill) t.skill = t.skill ? t.skill + ", " + e.skill : e.skill; }
    text = String(text || "");

    // JSON
    if (/\.json$/i.test(fileName || "") || /^\s*[\[{]/.test(text)) {
      try {
        var j = JSON.parse(text), list = Array.isArray(j) ? j : Object.keys(j).map(function (k) { var v = j[k]; return typeof v === "string" ? { n: k, prompt: v } : Object.assign({ n: k }, v); });
        list.forEach(function (x, i) {
          if (typeof x === "string") x = { prompt: x };
          if (!x || typeof x !== "object") return;
          var n = String(x.n != null ? x.n : x.num != null ? x.num : x.numero != null ? x.numero : x.plan != null ? x.plan : x.shot != null ? x.shot : x.id != null ? x.id : i + 1).match(/\d{1,4}/);
          merge({ num: n ? parseInt(n[0], 10) : i + 1,
            img: x.image || x.img || x.image_prompt || x.imagePrompt || x.prompt_image || x.promptImage || x.t2i || "",
            vid: x.video || x.vid || x.video_prompt || x.videoPrompt || x.prompt_video || x.promptVideo || x.animation || x.motion || "",
            other: x.prompt || x.text || x.description || "",
            ref: [].concat(x.refs || x.references || x.ref || x.personnages || []).join(", "),
            skill: [].concat(x.skills || x.skill || []).join(", ") });
        });
        return finish();
      } catch (e) { /* pas du JSON : lecture comme texte */ }
    }

    var lines = text.replace(/\r/g, "").split("\n");
    // CSV / TSV : même séparateur sur la plupart des lignes, première colonne = numéro
    if (/\.(csv|tsv)$/i.test(fileName || "")) {
      var sep = /\t/.test(lines[0]) ? "\t" : (lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",");
      var cols = null;
      lines.filter(function (l) { return l.trim(); }).forEach(function (l, i) {
        var cells = splitCsv(l, sep);
        if (i === 0 && !/\d/.test(cells[0])) { cols = columnsFromHeader(cells); return; }
        merge(entryFromCells(cells, cols));
      });
      return finish();
    }

    // Texte libre / Markdown
    var cur = null, field = null, tableCols = null;
    lines.forEach(function (raw) {
      var trimmed = raw.trim();
      if (!trimmed) { field = null; return; }
      // Tableau Markdown
      if (/^\|.*\|\s*$/.test(trimmed)) {
        var cells = trimmed.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.replace(/\*\*/g, "").trim(); });
        if (cells.every(function (c) { return /^:?-{2,}:?$/.test(c) || !c; })) return;
        if (!/\d/.test(cells[0])) { tableCols = columnsFromHeader(cells); return; }
        merge(entryFromCells(cells, tableCols)); cur = null; field = null; return;
      }
      var line = cleanLine(raw), m;
      // « IMAGE : … » / « VIDÉO 03 : … »
      if ((m = line.match(RE_LABEL))) {
        if (m[2]) cur = get(parseInt(m[2], 10));
        if (!cur) return;
        field = labelField(m[1]);
        cur[field] = cur[field] ? cur[field] + (field === "ref" || field === "skill" ? ", " : " ") + m[3].trim() : m[3].trim();
        if (field === "ref" || field === "skill") field = null;
        return;
      }
      // « 01 », « Plan 02 — titre », « 03 : prompt », « 04 IMAGE : … »
      if ((m = line.match(RE_NUM))) {
        cur = get(parseInt(m[1], 10)); field = null;
        var rest = (m[2] || "").trim(), lm = rest.match(RE_LABEL);
        if (lm) { field = labelField(lm[1]); cur[field] = lm[3].trim(); if (field === "ref" || field === "skill") field = null; }
        else if (rest) { cur.other = rest; field = "other"; }
        return;
      }
      // Suite d'un prompt sur plusieurs lignes
      if (cur) { var f = field || "other"; cur[f] = cur[f] ? cur[f] + " " + line : line; field = f; }
    });
    return finish();

    function finish() {
      order.sort(function (a, b) { return a - b; });
      order.forEach(function (n) {
        var e = entries[n];
        // Un texte sans étiquette sert de prompt vidéo si le numéro n'a ni IMAGE ni VIDÉO ; sinon c'est un titre
        if (e.other) { if (!e.img && !e.vid) e.vid = e.other; else e.title = e.other; }
        e.img = e.img.trim(); e.vid = e.vid.trim(); e.ref = e.ref.trim(); e.skill = (e.skill || "").trim();
      });
      return { entries: entries, order: order };
    }
  };
  function splitCsv(line, sep) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim()); return out;
  }

  // =========================================================
  // RÉFÉRENCES PAR NUMÉRO
  // =========================================================
  function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function refLibrary() { var p = A.getProject(); return p ? (p.library || []).filter(function (l) { return l.kind !== "source"; }) : []; }
  // « RÉF : Léa, Marc » → ingrédients de la bibliothèque ; sans ligne RÉF : noms de la bibliothèque cités dans les prompts
  function matchRefs(entry, lib) {
    var max = A.settings.maxRefs || 5, ids = [], missing = [];
    if (entry.ref) {
      entry.ref.split(/[,;\/+]|\s+et\s+/i).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (name) {
        var n = norm(name), hit = lib.find(function (l) { return norm(l.name) === n; }) ||
          lib.find(function (l) { var ln = norm(l.name); return ln && (ln.indexOf(n) === 0 || n.indexOf(ln) === 0); });
        if (hit) { if (ids.indexOf(hit.id) === -1) ids.push(hit.id); } else missing.push(name);
      });
      return { ids: ids.slice(0, max), missing: missing, auto: false };
    }
    var text = " " + norm(entry.img + " " + entry.vid) + " ";
    lib.forEach(function (l) { var ln = norm(l.name); if (ln.length >= 2 && text.indexOf(" " + ln + " ") !== -1 && ids.indexOf(l.id) === -1) ids.push(l.id); });
    return { ids: ids.slice(0, max), missing: [], auto: true };
  }

  // « SKILLS : Voiture — conducteur, UGC smartphone » → skills de l'app (nom exact, sans tenir compte des accents ni de la casse)
  function matchSkills(text) {
    var ids = [], missing = [];
    String(text || "").split(/[,;|]/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (name) {
      var n = norm(name), hit = A.db.skills.find(function (s) { return norm(s.title) === n; }) ||
        A.db.skills.find(function (s) { var t = norm(s.title); return t && (t.indexOf(n) === 0 || n.indexOf(t) === 0); });
      if (hit) { if (ids.indexOf(hit.id) === -1) ids.push(hit.id); } else missing.push(name);
    });
    return { ids: ids, missing: missing };
  }

  // =========================================================
  // PLAN DE CRÉATION (mode script)
  // =========================================================
  function nearestAspect(w, h) {
    var r = w / h, best = AGNES_ASPECTS[0];
    AGNES_ASPECTS.forEach(function (a) { if (Math.abs(Math.log(a[1] / r)) < Math.abs(Math.log(best[1] / r))) best = a; });
    return best[0];
  }
  function scriptPlan() {
    var parsed = A.parseBatchScript(byId("batchScript").value, ""), rows = [], seen = {}, lib = refLibrary();
    var images = batch.filter(function (b) { return !b.isVideo; });
    var nums = parsed.order.slice();
    images.forEach(function (b) { if (b.num != null && nums.indexOf(b.num) === -1) nums.push(b.num); });
    nums.sort(function (a, b) { return a - b; });
    nums.forEach(function (n) {
      var e = parsed.entries[n] || emptyEntry(n), mine = images.filter(function (b) { return b.num === n; });
      var start = mine.find(function (b) { return b.role === "start"; }), end = mine.find(function (b) { return b.role === "end"; });
      var singles = mine.filter(function (b) { return b.role === "single" || (b.role === "start" && !end) || (b.role === "end" && !start); });
      if (start && end) rows.push(makeRow(n, e, { start: start, end: end }));
      singles.forEach(function (b, i) { rows.push(makeRow(n, e, { image: b }, i)); });
      if (!(start && end) && !singles.length) rows.push(makeRow(n, e, {}));
    });
    // Images sans numéro : à la fin, sans prompt tant qu'on ne l'écrit pas
    images.filter(function (b) { return b.num == null; }).sort(natural).forEach(function (b) { rows.push(makeRow(null, emptyEntry(null), { image: b })); });
    rows.forEach(function (r) { if (r.num != null) seen[r.num] = (seen[r.num] || 0) + 1; });
    rows.forEach(function (r) { r.dup = r.num != null && seen[r.num] > 1; });
    return rows.filter(function (r) { return r.type; });

    function makeRow(n, e, media, k) {
      var key = (n == null ? "x" : n) + ":" + (media.image ? media.image.id : media.start ? "pair" : "gen") + (k ? ":" + k : "");
      var ed = edits[key] || {};
      var r = { key: key, num: n, title: e.title, image: media.image, start: media.start, end: media.end,
        img: ed.img != null ? ed.img : e.img, vid: ed.vid != null ? ed.vid : e.vid, on: !excluded[key] };
      var mr = matchRefs({ ref: e.ref, img: r.img, vid: r.vid }, lib);
      r.refs = ed.refs ? ed.refs.slice() : mr.ids; r.missing = ed.refs ? [] : mr.missing; r.autoRefs = !ed.refs && mr.auto;
      var ms = matchSkills(e.skill); r.skills = ms.ids; r.skillsMissing = ms.missing;
      if (r.start) r.type = "frames";
      else if (r.image) r.type = "i2v";
      else if (r.img) r.type = r.vid ? "t2i+i2v" : "t2i";
      else if (r.vid) r.type = "t2v";
      else r.type = ed.img != null || ed.vid != null ? "empty" : null;
      return r;
    }
  }
  var TYPE_LABEL = {
    frames: "Début + fin → Vidéo", i2v: "Image déposée → Vidéo", "t2i+i2v": "Texte → Image → Vidéo",
    t2i: "Image seule", t2v: "Texte → Vidéo", empty: "Aucun prompt"
  };

  // =========================================================
  // AFFICHAGE
  // =========================================================
  function isScript() { return byId("batchOp").value === "script"; }

  function renderFiles() {
    var files = batch.slice().sort(natural);
    byId("batchGrid").innerHTML = files.map(function (b) {
      return '<div class="batch-item">' + (b.isVideo ? '<video src="' + b.url + '" muted></video>' : '<img src="' + b.url + '" alt="">') +
        '<span>' + (b.isVideo ? "▶ " : "") + esc(b.name) + '</span><button class="small-btn" data-rm="' + b.id + '" aria-label="Retirer">✕</button></div>';
    }).join("");
    byId("batchDrop").firstChild.textContent = batch.length
      ? batch.length + " fichier(s) — ajoutez-en d'autres en les glissant ici"
      : (isScript() ? "Glissez ici vos images numérotées (01.png, 02.png…) et/ou votre script (.txt, .md, .csv, .json) — ou cliquez pour choisir. Les images sont facultatives."
        : "Glissez vos images / vidéos ici, ou cliquez pour les choisir");
  }

  // light = true : met à jour le résumé et les étiquettes sans redessiner les lignes (garde le focus et les clics en cours)
  function renderReview(light) {
    var card = byId("batchReviewCard");
    if (!isScript()) { card.style.display = "none"; return; }
    var rows = scriptPlan();
    card.style.display = rows.length ? "" : "none";
    if (!rows.length) return;
    renderSummary(rows);
    var shown = Array.from(byId("batchRows").querySelectorAll("[data-bk]")).map(function (el) { return el.getAttribute("data-bk"); });
    if (light && shown.join("|") === rows.map(function (r) { return r.key; }).join("|")) {
      var els = byId("batchRows").querySelectorAll("[data-bk]");
      rows.forEach(function (r, i) {
        var el = els[i], tag = el.querySelector(".ext-tag");
        tag.textContent = TYPE_LABEL[r.type]; tag.className = "ext-tag" + (rowBad(r) ? " err" : "");
        el.classList.toggle("batch-off", !r.on);
        var ph = el.querySelector(".batch-ph"); if (ph) ph.innerHTML = r.img ? "image<br>à générer" : "vidéo<br>seule";
        var rb = el.querySelector(".batch-refs"), html = refsRowHtml(r);
        if (rb) { if (html) rb.outerHTML = html; else rb.remove(); }
        else if (html) el.querySelector(".grow").insertAdjacentHTML("beforeend", html);
      });
      return;
    }
    renderRows(rows);
  }
  function rowBad(r) { return r.type === "empty" || r.dup || ((r.type === "i2v" || r.type === "frames") && !r.vid); }
  function usesRefs(r) { return r.type === "t2i+i2v" || r.type === "t2i" || r.type === "t2v"; }
  function skillsRowHtml(r) {
    if (!r.skills.length && !r.skillsMissing.length) return "";
    var names = r.skills.map(function (id) { var s = A.db.skills.find(function (x) { return x.id === id; }); return s ? '<span class="ext-tag">' + esc(s.title) + '</span>' : ""; }).join(" ");
    var miss = r.skillsMissing.map(function (n) { return '<span class="ext-tag err" title="Aucun skill de ce nom (onglet Skills)">' + esc(n) + ' ?</span>'; }).join(" ");
    return '<div class="chips" style="margin-top:4px"><span class="hint" style="margin:0">Skills :</span>' + names + miss + '</div>';
  }
  function refsRowHtml(r) {
    if (!usesRefs(r)) return "";
    var lib = refLibrary(), byIdL = {}; lib.forEach(function (l) { byIdL[l.id] = l; });
    var chips = r.refs.map(function (id) {
      var l = byIdL[id]; if (!l) return "";
      return '<button type="button" class="chip on" data-b="rmref" data-ref="' + id + '" title="Retirer">' + (l.thumb ? '<img src="' + l.thumb + '" alt="">' : "") + esc(l.name) + ' <span class="x">✕</span></button>';
    }).join("");
    var miss = r.missing.map(function (n) { return '<span class="ext-tag err" title="Aucune image de ce nom dans la Bibliothèque">' + esc(n) + ' ?</span>'; }).join("");
    var add = lib.filter(function (l) { return r.refs.indexOf(l.id) === -1; });
    return '<div class="chips batch-refs" style="margin-top:4px"><span class="hint" style="margin:0">Réf.' + (r.autoRefs && r.refs.length ? " (trouvées dans le prompt)" : "") + ' :</span>' + chips + miss +
      (add.length ? '<select data-b="addref" style="width:auto;font-size:11px"><option value="">+ ajouter</option>' + add.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join("") + '</select>'
        : (lib.length ? "" : '<span class="hint" style="margin:0">Bibliothèque vide</span>')) + '</div>';
  }
  function renderSummary(rows) {
    var on = rows.filter(function (r) { return r.on; });
    var nShots = on.filter(function (r) { return r.type !== "empty"; }).length;
    var count = function (t) { return on.filter(function (r) { return r.type === t; }).length; };
    var noVid = on.filter(function (r) { return (r.type === "i2v" || r.type === "frames") && !r.vid; }).length;
    var dups = rows.filter(function (r) { return r.dup; }).map(function (r) { return pad(r.num); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var noNum = rows.filter(function (r) { return r.num == null; }).length;
    var noRef = on.filter(function (r) { return r.missing.length; }).length, noSkill = on.filter(function (r) { return r.skillsMissing.length; }).length;
    var parts = [];
    if (count("t2i+i2v")) parts.push(count("t2i+i2v") + " texte → image → vidéo");
    if (count("i2v")) parts.push(count("i2v") + " image(s) déposée(s) à animer");
    if (count("frames")) parts.push(count("frames") + " début + fin");
    if (count("t2v")) parts.push(count("t2v") + " texte → vidéo");
    if (count("t2i")) parts.push(count("t2i") + " image(s) seule(s)");
    byId("batchSummary").innerHTML = "<b>" + nShots + " plan(s) à créer</b>" + (parts.length ? " : " + parts.join(" · ") : "") +
      (noVid ? ' · <span style="color:var(--danger)">' + noVid + " image(s) sans prompt vidéo</span>" : "") +
      (dups.length ? ' · <span style="color:var(--danger)">numéro(s) en double : ' + dups.join(", ") + "</span>" : "") +
      (noNum ? ' · <span style="color:var(--danger)">' + noNum + " image(s) sans numéro (placées à la fin)</span>" : "") +
      (noRef ? ' · <span style="color:var(--danger)">' + noRef + " numéro(s) avec une référence introuvable</span>" : "") +
      (noSkill ? ' · <span style="color:var(--danger)">' + noSkill + " numéro(s) avec un skill inconnu</span>" : "");
  }
  function renderRows(rows) {
    byId("batchRows").innerHTML = rows.map(function (r) {
      var thumbs = r.start ? [r.start, r.end] : r.image ? [r.image] : [];
      var media = thumbs.length ? thumbs.map(function (b) { return '<img class="ext-thumb" src="' + b.url + '" alt="" title="' + esc(b.name) + '" style="width:72px;height:72px">'; }).join("")
        : '<div class="ext-thumb batch-ph">' + (r.img ? "image<br>à générer" : "vidéo<br>seule") + '</div>';
      var imgBox = r.start || r.image ? "" :
        '<label class="hint" style="margin:0">Prompt image</label><textarea data-b="img" rows="2" placeholder="Laissez vide pour un plan Texte → Vidéo">' + esc(r.img) + '</textarea>';
      return '<div class="ext-row' + (r.on ? "" : " batch-off") + '" data-bk="' + esc(r.key) + '">' +
        '<input type="checkbox" data-b="on"' + (r.on ? " checked" : "") + ' aria-label="Créer le plan ' + pad(r.num) + '">' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:44px"><b style="font-size:16px">' + pad(r.num) + '</b></div>' +
        media +
        '<div style="display:flex;flex-direction:column;gap:4px;width:150px">' +
        '<span class="ext-tag' + (rowBad(r) ? " err" : "") + '">' + TYPE_LABEL[r.type] + '</span>' +
        (r.title ? '<span class="hint" style="margin:0">' + esc(r.title) + '</span>' : "") +
        (thumbs.length ? '<span class="hint" style="margin:0">' + esc(thumbs.map(function (b) { return b.name; }).join(" + ")) + '</span>' : "") + '</div>' +
        '<div class="grow">' + imgBox +
        '<label class="hint" style="margin:0">Prompt vidéo' + (r.type === "t2i" ? " (vide : l'image reste une image fixe)" : "") + '</label>' +
        '<textarea data-b="vid" rows="2" placeholder="Décrivez le mouvement : elle lève lentement les yeux…">' + esc(r.vid) + '</textarea>' + refsRowHtml(r) + skillsRowHtml(r) + '</div></div>';
    }).join("");
  }

  function updateOpUI() {
    var op = byId("batchOp").value, script = op === "script";
    byId("batchScriptBox").style.display = script ? "" : "none";
    byId("batchScriptOpts").style.display = script ? "" : "none";
    byId("batchKindField").style.display = op === "ingredient" || op === "v2ingredient" ? "" : "none";
    byId("batchPromptLabel").textContent = script
      ? "Texte ajouté à chaque prompt vidéo (facultatif)"
      : "Prompt commun — {nom} est remplacé par le nom du fichier";
    byId("batchPrompt").placeholder = script ? "Ex. realistic handheld feel, natural light" : "Ex. léger mouvement de caméra, le personnage respire, cheveux dans le vent";
    byId("batchOpHint").innerHTML = OP_HINTS[op] || "";
    byId("batchCreateBtn").textContent = script ? "Créer les plans" : "Créer le lot";
    byId("batchFiles").setAttribute("accept", script ? "image/*,.txt,.md,.json,.csv,.tsv" : "image/*,video/*");
    renderFiles(); renderReview();
  }
  var OP_HINTS = {
    script: "Pour chaque numéro : <b>IMAGE</b> seule → une image · <b>IMAGE + VIDÉO</b> → l'image est générée puis animée · <b>VIDÉO</b> seule → Texte → Vidéo · image déposée <b>01.png</b> → elle est animée avec le prompt vidéo du 01.",
    i2v: "Un plan Image → Vidéo par image déposée, avec le prompt commun.",
    i2i: "Un plan Image → Image par image déposée (variantes, changement de style).",
    frames: "Les images sont triées par nom puis prises par paires (01+02, 03+04…) : un plan Première + dernière frame par paire.",
    ingredient: "Les images vont dans la Bibliothèque avec le type choisi.",
    v2ingredient: "La première et la dernière image de chaque vidéo vont dans la Bibliothèque.",
    v2next: "La dernière image de chaque vidéo devient la source d'un nouveau plan qui prolonge l'action."
  };

  // =========================================================
  // FICHIERS DÉPOSÉS
  // =========================================================
  function addBatchFiles(files) {
    var chain = Promise.resolve(), texts = [];
    Array.from(files).forEach(function (f) {
      if (TEXT_EXT.test(f.name) || /^text\//.test(f.type) || f.type === "application/json") { texts.push(f); return; }
      if (!/^(image|video)\//.test(f.type)) return;
      var isVideo = f.type.indexOf("video") === 0, p = A.parseShotFileName(f.name);
      var item = { id: A.uid(), file: f, url: URL.createObjectURL(f), isVideo: isVideo, name: f.name, num: p.num, role: p.role, w: 0, h: 0 };
      batch.push(item);
      if (!isVideo) chain = chain.then(function () { return A.loadImage(item.url).then(function (img) { item.w = img.naturalWidth; item.h = img.naturalHeight; }, function () { }); });
    });
    texts.forEach(function (f) {
      chain = chain.then(function () {
        return f.text().then(function (t) { appendScript(t, f.name); });
      });
    });
    if (texts.length && !isScript()) { byId("batchOp").value = "script"; }
    chain.then(updateOpUI);
    renderFiles();
  }
  // Ajoute un fichier de script dans la zone de texte (JSON / CSV convertis en texte lisible)
  function appendScript(text, name) {
    var out = text;
    if (/\.(json|csv|tsv)$/i.test(name)) {
      var p = A.parseBatchScript(text, name);
      out = p.order.map(function (n) {
        var e = p.entries[n];
        return pad(n) + (e.title ? " — " + e.title : "") + (e.img ? "\nIMAGE : " + e.img : "") + (e.vid ? "\nVIDÉO : " + e.vid : "");
      }).join("\n\n");
    }
    var ta = byId("batchScript");
    ta.value = (ta.value.trim() ? ta.value.trim() + "\n\n" : "") + out.trim();
  }
  function clearBatch() {
    batch.forEach(function (b) { URL.revokeObjectURL(b.url); });
    batch = []; edits = {}; excluded = {};
    renderFiles(); renderReview();
  }

  // =========================================================
  // CRÉATION — mode script
  // =========================================================
  function readCommon() {
    var skill = byId("batchSkill").value;
    return {
      aspect: byId("batchAspect").value, resolution: byId("batchRes").value,
      duration: A.clamp(byId("batchDuration").value, 1, 18), outputs: A.clamp(byId("batchOutputs").value, 1, 4),
      skills: skill ? [skill] : []
    };
  }
  function runScript() {
    var rows = scriptPlan().filter(function (r) { return r.on && r.type !== "empty"; });
    if (!rows.length) { A.toast("Rien à créer : écrivez un script ou déposez des images numérotées.", "err"); return; }
    var missing = rows.filter(function (r) { return (r.type === "i2v" || r.type === "frames") && !r.vid; });
    if (missing.length && !window.confirm(missing.length + " image(s) n'ont pas de prompt vidéo (" + missing.map(function (r) { return pad(r.num); }).join(", ") +
      "). Elles seront animées avec le seul texte commun. Continuer ?")) return;

    var proj = A.getProject(), common = readCommon(), extra = byId("batchPrompt").value.trim();
    var auto = byId("batchChain").value === "auto", strategy = byId("batchStrategy").value, motion = byId("batchMotion").value;
    var lock = byId("batchLock").checked, imgOutputs = A.clamp(byId("batchImgOutputs").value, 1, 4);
    var created = [], toRun = [], btn = byId("batchCreateBtn"), chain = Promise.resolve();
    function vidPrompt(r) { return [r.vid, extra].filter(Boolean).join(", "); }
    function push(r, opts) {
      var skills = (common.skills || []).concat(r.skills || []).filter(function (id, i, a) { return a.indexOf(id) === i; });
      var s = A.newShot(Object.assign({}, common, { lock: lock, batchNo: r.num, skills: skills }, opts), proj);
      proj.shots.push(s); created.push(s); toRun.push(s); return s;
    }
    function toLib(b, label) { return A.addLibraryItem(b.file, { name: label, kind: "source" }, proj); }
    btn.disabled = true;

    rows.forEach(function (r, i) {
      chain = chain.then(function () {
        A.toast("Lot : plan " + (i + 1) + " / " + rows.length + "…");
        var n = pad(r.num);
        if (r.type === "frames") {
          return Promise.all([toLib(r.start, "Plan " + n + " — début"), toLib(r.end, "Plan " + n + " — fin")]).then(function (it) {
            push(r, { mode: "frames", startRef: it[0].id, endRef: it[1].id, prompt: vidPrompt(r), aspect: r.start.w ? nearestAspect(r.start.w, r.start.h) : common.aspect });
          });
        }
        if (r.type === "i2v") {
          return toLib(r.image, "Plan " + n).then(function (it) {
            push(r, { mode: "i2v", sourceRef: it.id, prompt: vidPrompt(r), i2v: strategy, motion: motion, aspect: r.image.w ? nearestAspect(r.image.w, r.image.h) : common.aspect });
          });
        }
        if (r.type === "t2v") { push(r, { mode: "t2v", prompt: vidPrompt(r), ingredients: r.refs.slice() }); return; }
        if (r.type === "t2i") { push(r, { mode: "t2i", prompt: r.img, ingredients: r.refs.slice(), outputs: imgOutputs }); return; }
        // Une seule carte : image générée avec les références du numéro, puis animée
        push(r, { mode: "t2v", imagePrompt: r.img, prompt: vidPrompt(r), ingredients: r.refs.slice(), keyOutputs: imgOutputs,
          i2v: strategy, motion: motion, autoAnimate: auto });
      });
    });

    chain.then(function () {
      A.touch(proj); A.render();
      var runNow = byId("batchRunNow").checked, two = created.filter(A.isTwoStep).length;
      if (runNow && toRun.length) A.enqueueMany(toRun, proj);
      A.toast(created.length + " plan(s) créé(s) dans l'ordre des numéros" + (runNow ? " et mis en file" : "") +
        (two && !auto ? ". Pour les " + two + " plan(s) Texte → Image → Vidéo, choisissez l'image sur la carte puis « Animer »." : "."), "ok");
      batch.forEach(function (b) { URL.revokeObjectURL(b.url); });
      batch = []; edits = {}; excluded = {};
      renderFiles(); renderReview();
      A.showView("viewStoryboard");
    }).catch(function (e) { A.toast("Lot interrompu : " + (e.display || e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  }

  // =========================================================
  // CRÉATION — opérations sur fichiers
  // =========================================================
  function runFiles() {
    if (!batch.length) { A.toast("Ajoutez d'abord des images ou des vidéos.", "err"); return; }
    var op = byId("batchOp").value, proj = A.getProject(), kind = byId("batchKind").value;
    var prompt = byId("batchPrompt").value.trim(), common = readCommon();
    var sorted = batch.slice().sort(natural);
    var images = sorted.filter(function (b) { return !b.isVideo; }), videos = sorted.filter(function (b) { return b.isVideo; });
    var needVideo = op === "v2ingredient" || op === "v2next", items = needVideo ? videos : images;
    var skipped = batch.length - items.length, created = [], added = 0;
    if (!items.length) { A.toast(needVideo ? "Cette opération demande des vidéos." : "Cette opération demande des images.", "err"); return; }
    function nameOf(b) { return b.name.replace(/\.[^.]+$/, ""); }
    function promptFor(b) { return prompt.replace(/\{nom\}/g, nameOf(b)); }
    function toLib(blob, name, k) { added++; return A.addLibraryItem(blob, { name: name, kind: k }, proj); }
    function push(opts) { var s = A.newShot(Object.assign({}, common, opts), proj); proj.shots.push(s); created.push(s); }
    var chain = Promise.resolve(), btn = byId("batchCreateBtn"); btn.disabled = true;

    if (op === "frames") {
      if (items.length % 2) { skipped++; A.toast("Nombre d'images impair : la dernière est ignorée.", "err"); }
      for (var i = 0; i + 1 < items.length; i += 2) (function (a, b) {
        chain = chain.then(function () { return Promise.all([toLib(a.file, nameOf(a), "source"), toLib(b.file, nameOf(b), "source")]); })
          .then(function (r) { push({ mode: "frames", startRef: r[0].id, endRef: r[1].id, prompt: promptFor(a) }); });
      })(items[i], items[i + 1]);
    } else {
      items.forEach(function (b, idx) {
        chain = chain.then(function () {
          A.toast("Lot : " + (idx + 1) + " / " + items.length + "…");
          if (op === "ingredient") return toLib(b.file, nameOf(b), kind);
          if (op === "i2v" || op === "i2i") return toLib(b.file, nameOf(b), "source").then(function (item) { push({ mode: op, sourceRef: item.id, prompt: promptFor(b) }); });
          if (op === "v2ingredient") return A.videoFrame(b.url, "first").then(function (f1) { return toLib(f1, nameOf(b) + " — début", kind); })
            .then(function () { return A.videoFrame(b.url, "last"); }).then(function (f2) { return toLib(f2, nameOf(b) + " — fin", kind); });
          if (op === "v2next") return A.videoFrame(b.url, "last").then(function (f) { return toLib(f, nameOf(b) + " — fin", "source"); }).then(function (item) {
            push({ mode: "i2v", sourceRef: item.id, prompt: promptFor(b) || "suite directe du plan précédent, même personnage, même lumière" });
          });
        });
      });
    }
    chain.then(function () {
      A.touch(proj); A.render();
      var msg = [];
      if (created.length) msg.push(created.length + " plan(s) créé(s)");
      if (added) msg.push(added + " image(s) ajoutée(s) à la bibliothèque");
      if (skipped) msg.push(skipped + " fichier(s) ignoré(s)");
      A.toast(msg.join(", ") + ".", "ok");
      if (created.length && byId("batchRunNow").checked) A.enqueueMany(created, proj);
      clearBatch();
    }).catch(function (e) { A.toast("Lot interrompu : " + (e.display || e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  }

  // =========================================================
  // INITIALISATION
  // =========================================================
  A.initBatch = function () {
    var drop = byId("batchDrop");
    drop.addEventListener("click", function (e) { if (e.target === drop || e.target.nodeType === 3) byId("batchFiles").click(); });
    byId("batchFiles").addEventListener("change", function () { addBatchFiles(this.files); this.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { addBatchFiles(e.dataTransfer.files); });
    byId("batchGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"); if (!b) return;
      var id = b.getAttribute("data-rm"), it = batch.find(function (x) { return x.id === id; });
      if (it) { URL.revokeObjectURL(it.url); batch.splice(batch.indexOf(it), 1); }
      renderFiles(); renderReview();
    });
    byId("batchKind").innerHTML = A.optionsHtml(A.LIB_KINDS, "personnage");
    byId("batchStrategy").innerHTML = A.optionsHtml(A.I2V_STRATEGIES.filter(function (s) { return s[0] !== "refs"; }), "anchor");
    byId("batchMotion").innerHTML = A.optionsHtml(A.MOTIONS, "subtle");
    byId("batchOp").addEventListener("change", updateOpUI);
    var t = null;
    // Le script reste la référence : le modifier remplace les corrections faites dans la vérification
    byId("batchScript").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { edits = {}; renderReview(); }, 300); });
    byId("batchScriptFile").addEventListener("change", function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      f.text().then(function (txt) { appendScript(txt, f.name); edits = {}; renderReview(); });
    });
    byId("batchScriptExample").addEventListener("click", function () {
      var ta = byId("batchScript");
      if (ta.value.trim() && !window.confirm("Remplacer le script actuel par l'exemple ?")) return;
      ta.value = EXAMPLE; edits = {}; renderReview();
    });
    byId("batchRows").addEventListener("input", function (e) {
      var row = e.target.closest("[data-bk]"), f = e.target.getAttribute("data-b"); if (!row || (f !== "img" && f !== "vid")) return;
      var k = row.getAttribute("data-bk"); edits[k] = edits[k] || {}; edits[k][f] = e.target.value;
    });
    function rowRefs(k) { var r = scriptPlan().find(function (x) { return x.key === k; }); return r ? r.refs.slice() : []; }
    byId("batchRows").addEventListener("click", function (e) {
      var b = e.target.closest('[data-b="rmref"]'), row = b && b.closest("[data-bk]"); if (!row) return;
      var k = row.getAttribute("data-bk"), id = b.getAttribute("data-ref");
      edits[k] = edits[k] || {}; edits[k].refs = rowRefs(k).filter(function (x) { return x !== id; });
      renderReview();
    });
    byId("batchRows").addEventListener("change", function (e) {
      var row = e.target.closest("[data-bk]"); if (!row) return;
      var f = e.target.getAttribute("data-b"), k = row.getAttribute("data-bk");
      if (f === "addref") {
        if (!e.target.value) return;
        var list = rowRefs(k), max = A.settings.maxRefs || 5;
        if (list.length >= max) { A.toast(max + " références maximum par plan.", "err"); renderReview(); return; }
        edits[k] = edits[k] || {}; edits[k].refs = list.concat(e.target.value); renderReview(); return;
      }
      if (f === "on") excluded[k] = !e.target.checked;
      renderReview(true);   // le type d'un plan peut changer (prompt image ajouté ou vidé)
    });
    byId("batchCreateBtn").addEventListener("click", function () { if (isScript()) runScript(); else runFiles(); });
    byId("batchClearBtn").addEventListener("click", function () {
      if (isScript() && byId("batchScript").value.trim() && window.confirm("Vider aussi le script ?")) byId("batchScript").value = "";
      clearBatch();
    });
    // Les références proposées suivent la bibliothèque du projet
    var prev = A.refreshPickers;
    A.refreshPickers = function () { prev.apply(this, arguments); if (byId("viewBatch").classList.contains("active")) renderReview(true); };
    updateOpUI();
  };
  A.refreshBatchDefaults = function (p) {
    byId("batchAspect").innerHTML = A.optionsHtml(A.ASPECTS, p.aspect);
    byId("batchRes").innerHTML = A.optionsHtml(A.RESOLUTIONS, p.resolution);
    byId("batchDuration").value = p.duration || 5; byId("batchOutputs").value = p.outputs || 1;
    edits = {}; renderReview();
  };

  var EXAMPLE = [
    "01 — Arrivée",
    "IMAGE : Léa, plan large, entre dans un hall administratif, néons froids, matin gris",
    "VIDÉO : Elle avance lentement vers le comptoir, la porte vitrée se referme derrière elle",
    "",
    "02 — L'agent",
    "IMAGE : Gros plan d'un agent derrière son écran, lunettes, regard fatigué",
    "RÉF : Marc",
    "VIDÉO : Il lève les yeux de son écran sans se lever",
    "",
    "03 — Le dossier",
    "VIDÉO : Très gros plan, une main pose un dossier cartonné sur le comptoir",
    "",
    "04",
    "IMAGE : Le comptoir vide, le néon grésille"
  ].join("\n");
})();
