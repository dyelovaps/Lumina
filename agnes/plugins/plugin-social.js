// plugins/plugin-social.js — Publication (TikTok, Reels, YouTube Shorts, YouTube)
// Onglet « Publication » : fiche d'épisode, textes prêts à coller pour chaque plateforme (accroche, description,
// hashtags, chapitres YouTube), prompt d'aide pour ChatGPT/Claude, couverture/miniature avec titre,
// vérification des zones masquées par l'interface des applis, et kit de publication (.zip).
// La mise en ligne reste manuelle : TikTok, Instagram et YouTube exigent une application validée côté serveur
// pour publier par API — le kit réunit tout ce qu'il faut pour publier en deux minutes.
AgnesPlugins.register("social", {
  name: "Publication réseaux sociaux",
  version: "1.0",

  // Zones masquées par l'interface (approximatives, en fraction de l'image 9:16)
  SAFE: {
    tiktok: { label: "TikTok", top: 0.07, bottom: 0.20, right: 0.13, left: 0.02 },
    reels: { label: "Reels", top: 0.11, bottom: 0.22, right: 0.12, left: 0.02 },
    shorts: { label: "Shorts", top: 0.08, bottom: 0.20, right: 0.15, left: 0.02 }
  },
  FORMATS: { "9:16": [1080, 1920], "16:9": [1280, 720], "1:1": [1080, 1080], "4:5": [1080, 1350] },

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.film = null; this.cover = { img: null, srcLabel: "" };

    var view = core.ui.addTab("publication", "Publication",
      '<div class="ext-cols">' +
      '<div class="card"><h3>Fiche de l\'épisode</h3>' +
      '<div class="ext-cols"><div class="field"><label>Série</label><input type="text" data-p="serie" placeholder="BlackLaw"></div>' +
      '<div class="field"><label>Épisode / partie</label><input type="number" data-p="ep" min="1" style="width:90px"></div></div>' +
      '<div class="field"><label>Titre de l\'épisode</label><input type="text" data-p="titre" placeholder="Le témoin qui mentait"></div>' +
      '<div class="field"><label>Accroche (les 2 premières secondes)</label><input type="text" data-p="hook" placeholder="Il a signé sans lire. Grave erreur."></div>' +
      '<div class="field"><label>Résumé (sans spoiler)</label><textarea data-p="resume" rows="3"></textarea></div>' +
      '<div class="field"><label>Hashtags (séparés par des espaces)</label><input type="text" data-p="tags" placeholder="#droit #thriller #histoirevraie"></div>' +
      '<div class="field"><label>Appel à l\'action</label><input type="text" data-p="cta" placeholder="Partie 2 demain à 19h — abonne-toi pour la suite."></div>' +
      '<div class="field"><label>Publication prévue</label><input type="datetime-local" data-p="date"></div>' +
      '<div class="row-inline"><button class="primary-btn" id="soGen">Générer les textes</button><button class="small-btn" id="soPrompt">Prompt d\'aide (ChatGPT / Claude)</button></div>' +
      '</div>' +
      '<div class="card"><h3>Durée & plateformes</h3><div id="soDur" class="hint">—</div></div>' +
      '</div>' +
      '<div class="card"><h3>Textes prêts à coller</h3><p class="hint">Modifiables ; enregistrés dans le projet.</p><div id="soTexts"></div></div>' +
      '<div class="card"><h3>Couverture / miniature</h3>' +
      '<div class="ext-cols"><div>' +
      '<div class="field"><label>Image source</label><select id="soSrc"></select></div>' +
      '<div class="field" id="soAtWrap"><label>Moment de la vidéo (s)</label><input type="number" id="soAt" min="0" step="0.1" value="0.5" style="width:90px"></div>' +
      '<div class="field"><label>Format</label><select id="soFmt"><option value="9:16">9:16 — TikTok / Reels / Shorts</option><option value="16:9">16:9 — miniature YouTube</option><option value="1:1">1:1</option><option value="4:5">4:5 — publication Instagram</option></select></div>' +
      '<div class="field"><label>Style</label><select id="soStyle"><option value="noir">Cyber-noir (blanc, trait rouge)</option><option value="drama">Drame (jaune contouré)</option><option value="clean">Épuré (serif)</option><option value="none">Sans texte</option></select></div>' +
      '<div class="field"><label>Titre sur l\'image</label><input type="text" id="soTitle"></div>' +
      '<div class="field"><label>Sous-titre / étiquette</label><input type="text" id="soSub" placeholder="ÉPISODE 1"></div>' +
      '<div class="field"><label>Position du texte</label><select id="soPos"><option value="top">Haut (zone sûre)</option><option value="center">Centre</option><option value="bottom">Bas (zone sûre)</option></select></div>' +
      '<div class="field"><label>Aperçu des zones masquées</label><select id="soSafe"><option value="">Aucun</option><option value="tiktok">TikTok</option><option value="reels">Reels</option><option value="shorts">Shorts</option></select></div>' +
      '<div class="row-inline"><button class="primary-btn" id="soCoverDl">Télécharger la couverture (PNG)</button></div>' +
      '</div><div><canvas id="soCanvas" class="ext-canvas"></canvas><p class="hint">Les zones rouges (aperçu seulement) sont couvertes par les boutons et la légende de l\'appli : gardez-y ni visage ni texte.</p></div></div></div>' +
      '<div class="card"><h3>Kit de publication</h3><p class="hint" id="soFilmInfo">Rendez le film dans l\'onglet Assemblage : il sera ajouté au kit automatiquement.</p>' +
      '<div class="row-inline"><button class="primary-btn" id="soKit">Télécharger le kit (.zip)</button></div></div>');
    this.view = view;
    var $ = function (id) { return view.querySelector("#" + id); };

    // ---------- Fiche ----------
    function pub() {
      var p = core.getProject();
      if (!p.publish) p.publish = { serie: p.name, ep: 1, titre: "", hook: "", resume: "", tags: "", cta: "", date: "", texts: {}, cover: {} };
      if (!p.publish.texts) p.publish.texts = {};
      if (!p.publish.cover) p.publish.cover = {};
      return p.publish;
    }
    this.pub = pub;
    function fillSheet() {
      var d = pub();
      view.querySelectorAll("[data-p]").forEach(function (el) { var k = el.getAttribute("data-p"); el.value = d[k] == null ? "" : d[k]; });
    }
    view.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-p");
      if (k) { pub()[k] = k === "ep" ? Math.max(1, parseInt(e.target.value, 10) || 1) : e.target.value; core.saveProject(); return; }
      var t = e.target.getAttribute("data-t");
      if (t) { pub().texts[t] = e.target.value; core.saveProject(); }
    });

    // ---------- Textes ----------
    var PLATFORMS = [
      ["tiktok", "TikTok — légende"], ["reels", "Instagram Reels — légende"],
      ["shortsTitle", "YouTube Shorts — titre"], ["shortsDesc", "YouTube Shorts — description"],
      ["ytTitle", "YouTube — titre"], ["ytDesc", "YouTube — description (avec chapitres)"]
    ];
    function renderTexts() {
      var t = pub().texts;
      if (!Object.keys(t).length) { $("soTexts").innerHTML = '<p class="hint">Remplissez la fiche puis « Générer les textes ».</p>'; return; }
      $("soTexts").innerHTML = PLATFORMS.map(function (p) {
        var v = t[p[0]] || "", lim = { tiktok: 2200, reels: 2200, shortsTitle: 100, ytTitle: 100, shortsDesc: 5000, ytDesc: 5000 }[p[0]];
        return '<div class="field"><label>' + p[1] + ' <span class="ext-tag' + (v.length > lim ? " err" : "") + '">' + v.length + ' / ' + lim + '</span></label>' +
          '<textarea data-t="' + p[0] + '" rows="' + (/Title/.test(p[0]) ? 2 : 5) + '">' + esc(v) + '</textarea>' +
          '<button class="small-btn" data-copy="' + p[0] + '">Copier</button></div>';
      }).join("");
    }
    $("soTexts").addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]"); if (!b) return;
      self.copy(pub().texts[b.getAttribute("data-copy")] || "");
    });
    $("soGen").addEventListener("click", function () {
      self.buildTexts().then(function () { renderTexts(); core.toast("Textes générés — relisez-les avant de publier.", "ok"); });
    });
    $("soPrompt").addEventListener("click", function () { self.copy(self.helperPrompt(), "Prompt copié — collez-le dans ChatGPT ou Claude."); });

    // ---------- Couverture ----------
    function fillSources() {
      var opts = [], shots = core.getShots();
      shots.forEach(function (s, i) {
        var t = core.getSelectedTake(s); if (!t) return;
        opts.push(['take:' + s.id, "Plan #" + (i + 1) + " — " + (t.kind === "video" ? "vidéo" : "image") + " — " + (s.prompt || "").slice(0, 40)]);
      });
      core.getLibrary().forEach(function (l) { opts.push(["lib:" + l.id, "Bibliothèque — " + l.name]); });
      var cur = pub().cover.src || (opts[0] && opts[0][0]) || "";
      $("soSrc").innerHTML = opts.length ? App.optionsHtml(opts, cur) : '<option value="">Aucune image disponible</option>';
      var c = pub().cover;
      $("soFmt").value = c.fmt || (core.getProject().aspect === "16:9" ? "16:9" : "9:16");
      $("soStyle").value = c.style || "noir"; $("soPos").value = c.pos || "bottom"; $("soAt").value = c.at == null ? 0.5 : c.at;
      $("soTitle").value = c.title != null ? c.title : (pub().titre || pub().hook || "");
      $("soSub").value = c.sub != null ? c.sub : ("ÉPISODE " + (pub().ep || 1));
    }
    function saveCover() {
      var c = pub().cover;
      c.src = $("soSrc").value; c.fmt = $("soFmt").value; c.style = $("soStyle").value; c.pos = $("soPos").value;
      c.at = Number($("soAt").value) || 0; c.title = $("soTitle").value; c.sub = $("soSub").value; core.saveProject();
    }
    function loadSource() {
      var v = $("soSrc").value; self.cover.img = null;
      if (!v) return Promise.resolve(drawCover());
      var kind = v.split(":")[0], id = v.slice(kind.length + 1), blobP, isVideo = false;
      if (kind === "take") {
        var s = core.getShot(id), t = s && core.getSelectedTake(s); if (!t) return Promise.resolve(drawCover());
        isVideo = t.kind === "video"; blobP = core.getTakeBlobOrFetch(t);
      } else {
        var l = core.getLibrary().find(function (x) { return x.id === id; }); blobP = l ? core.getLibBlob(l) : Promise.resolve(null);
      }
      $("soAtWrap").style.display = isVideo ? "" : "none";
      return blobP.then(function (b) {
        if (!b) throw new Error("média indisponible");
        var u = URL.createObjectURL(b);
        var p = isVideo ? App.videoFrame(u, Number($("soAt").value) || 0.05, 1920).then(function (fb) { URL.revokeObjectURL(u); return URL.createObjectURL(fb); }) : Promise.resolve(u);
        return p.then(App.loadImage).then(function (img) { self.cover.img = img; drawCover(); });
      }).catch(function (e) { drawCover(); core.toast("Couverture : " + e.message, "err"); });
    }
    function drawCover(forExport) {
      var fmt = self.FORMATS[$("soFmt").value] || self.FORMATS["9:16"];
      var cv = forExport ? document.createElement("canvas") : $("soCanvas");
      self.renderCover(cv, fmt[0], fmt[1], {
        img: self.cover.img, style: $("soStyle").value, pos: $("soPos").value,
        title: $("soTitle").value, sub: $("soSub").value, safe: forExport ? "" : $("soSafe").value
      });
      return cv;
    }
    ["soSrc", "soAt"].forEach(function (id) { $(id).addEventListener("change", function () { saveCover(); loadSource(); }); });
    ["soFmt", "soStyle", "soPos", "soSafe"].forEach(function (id) { $(id).addEventListener("change", function () { saveCover(); drawCover(); }); });
    ["soTitle", "soSub"].forEach(function (id) { $(id).addEventListener("input", function () { saveCover(); drawCover(); }); });
    $("soCoverDl").addEventListener("click", function () {
      App.canvasToBlob(drawCover(true), "image/png").then(function (b) {
        core.download(b, App.slugify((pub().serie || "serie") + "-ep" + (pub().ep || 1)) + "_couverture_" + $("soFmt").value.replace(":", "x") + ".png");
      });
    });
    this.drawCover = drawCover;

    // ---------- Kit ----------
    core.on("montage:done", function (d) {
      if (d && d.blob) { self.film = { blob: d.blob, projectId: core.getProject().id }; if (view.classList.contains("active")) filmInfo(); }
    });
    function filmInfo() {
      var f = self.film && self.film.projectId === core.getProject().id ? self.film : null;
      $("soFilmInfo").textContent = f ? "Film prêt pour le kit : " + (f.blob.size / 1048576).toFixed(1) + " Mo (" + (/mp4/.test(f.blob.type) ? "MP4" : "WebM") + ")."
        : "Rendez le film dans l'onglet Assemblage : il sera ajouté au kit automatiquement (sinon le kit contient les textes et la couverture).";
    }
    $("soKit").addEventListener("click", function () { self.exportKit(); });

    function refresh() {
      fillSheet(); renderTexts(); fillSources(); loadSource(); filmInfo();
      self.durations().then(function (d) { $("soDur").innerHTML = self.durationHtml(d); });
    }
    core.on("view:change", function (v) { if (v === "view_publication") refresh(); });
    core.on("project:change", function () { if (view.classList.contains("active")) refresh(); });
    core.ui.addToolbarButton("montage", "→ Publication", function () { App.showView("view_publication"); });
  },

  copy: function (text, msg) {
    var core = this.core;
    var ok = function () { core.toast(msg || "Copié.", "ok"); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(ok, fallback);
    fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) { core.toast("Copie impossible — sélectionnez le texte à la main.", "err"); } ta.remove();
    }
  },

  // Durées réelles des plans du montage → chronologie { total, marks:[{t, shot}] }
  durations: function () { return this.core.getMontageTimeline(); },
  fmtTime: function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); },
  durationHtml: function (d) {
    if (!d.marks.length) return "Aucun plan terminé dans le montage.";
    var t = d.total, f = this.fmtTime(t);
    var rows = [
      ["TikTok", t <= 600, t < 20 ? "court : pensez à la boucle" : t <= 90 ? "idéal pour une partie de série" : t <= 180 ? "OK — accroche forte indispensable" : "long : découpez en parties"],
      ["Reels", t <= 180, t <= 90 ? "idéal" : t <= 180 ? "limite des 3 min" : "trop long pour un Reel"],
      ["Shorts", t <= 180, t <= 60 ? "idéal" : t <= 180 ? "accepté (jusqu'à 3 min)" : "trop long : publiez en vidéo YouTube"],
      ["YouTube", true, t >= 480 ? "8 min+ : mi-roll possible" : "format long OK"]
    ];
    return '<p style="margin:0 0 8px">Durée estimée du film : <b>' + f + '</b> (' + d.marks.length + ' plans).</p>' + rows.map(function (r) {
      return '<div class="ext-row" style="padding:6px 0"><span style="width:80px">' + r[0] + '</span><span class="ext-tag ' + (r[1] ? "ok" : "err") + '">' + (r[1] ? "compatible" : "trop long") + '</span><span class="hint" style="margin:0">' + r[2] + '</span></div>';
    }).join("");
  },

  hashtags: function (d, max) {
    var base = String(d.tags || "").split(/[\s,]+/).filter(Boolean).map(function (h) { return h.charAt(0) === "#" ? h : "#" + h; });
    var serie = d.serie ? "#" + d.serie.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "") : "";
    var all = [];
    [serie].concat(base).forEach(function (h) { if (h && h.length > 1 && all.indexOf(h) === -1) all.push(h); });
    return all.slice(0, max || 6);
  },

  buildTexts: function () {
    var self = this, d = this.pub();
    var ep = "Épisode " + (d.ep || 1), head = (d.serie || "") + (d.serie ? " — " : "") + ep + (d.titre ? " : " + d.titre : "");
    var hook = (d.hook || "").trim(), cta = (d.cta || "").trim(), resume = (d.resume || "").trim();
    return this.durations().then(function (dur) {
      var t = d.texts;
      t.tiktok = [hook, head, cta, self.hashtags(d, 5).join(" ")].filter(Boolean).join("\n\n");
      t.reels = [hook, head + (resume ? "\n" + resume : ""), cta, self.hashtags(d, 5).join(" ")].filter(Boolean).join("\n\n");
      t.shortsTitle = ((hook || d.titre || head) + " | " + (d.serie || "") + " Ép." + (d.ep || 1)).replace(/\s+\|\s+$/, "").slice(0, 92) + " #Shorts";
      t.shortsDesc = [head, resume, cta, self.hashtags(d, 3).join(" ") + " #Shorts"].filter(Boolean).join("\n\n");
      t.ytTitle = (head || hook).slice(0, 100);
      var chapters = self.chapters(dur);
      t.ytDesc = [hook, resume, chapters ? "Chapitres\n" + chapters : "", cta, self.hashtags(d, 3).join(" ")].filter(Boolean).join("\n\n");
      self.core.saveProject();
    });
  },
  // Chapitres YouTube : 1er à 0:00, au moins 3, chacun ≥ 10 s (sinon YouTube les ignore)
  chapters: function (dur) {
    var groups = [], cur = null;
    dur.marks.forEach(function (m) {
      if (!cur || cur.len >= 10) { cur = { t: m.t, len: 0, name: (m.it.shot.chapter || m.it.shot.prompt || "Plan " + m.it.index).split(/[.,;\n]/)[0].trim().slice(0, 50) }; groups.push(cur); }
      cur.len += m.len;
    });
    if (groups.length > 1 && groups[groups.length - 1].len < 10) { var last = groups.pop(); groups[groups.length - 1].len += last.len; }
    if (groups.length < 3) return "";
    var self = this;
    return groups.map(function (g, i) { return (i === 0 ? "0:00" : self.fmtTime(g.t)) + " " + g.name; }).join("\n");
  },

  helperPrompt: function () {
    var d = this.pub(), shots = this.core.getShots();
    return [
      "Tu es un expert des séries courtes sur TikTok, Reels et YouTube Shorts en France.",
      "Série : " + (d.serie || "—") + " — Épisode " + (d.ep || 1) + (d.titre ? " « " + d.titre + " »" : ""),
      d.resume ? "Résumé : " + d.resume : "",
      "Déroulé des plans :", shots.map(function (s, i) { return (i + 1) + ". " + (s.voice && s.voice.text ? "[dialogue : " + s.voice.text.replace(/\n/g, " / ") + "] " : "") + (s.prompt || ""); }).join("\n"),
      "",
      "Propose-moi, en français :",
      "1. 10 accroches de 8 mots maximum pour les 2 premières secondes (sans révéler la fin) ;",
      "2. 5 titres pour YouTube Shorts (moins de 70 caractères) ;",
      "3. une légende TikTok de 2 à 3 lignes qui donne envie de voir la suite, avec 4 hashtags pertinents (pas de #fyp) ;",
      "4. une idée de texte court pour la couverture (4 mots maximum) ;",
      "5. la meilleure phrase de fin pour inciter à regarder l'épisode suivant."
    ].filter(function (x) { return x !== ""; }).join("\n");
  },

  // ---------- Rendu de la couverture ----------
  renderCover: function (cv, W, H, o) {
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0b0c0e"; ctx.fillRect(0, 0, W, H);
    if (o.img) {
      var iw = o.img.naturalWidth || o.img.width, ih = o.img.naturalHeight || o.img.height, sc = Math.max(W / iw, H / ih);
      ctx.drawImage(o.img, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    } else {
      ctx.fillStyle = "#555"; ctx.font = "500 " + Math.round(W / 22) + "px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Choisissez une image source", W / 2, H / 2);
    }
    var unit = Math.min(W, H), vertical = H > W;
    var z = this.SAFE.tiktok, padTop = vertical ? H * (z.top + 0.03) : H * 0.08, padBottom = vertical ? H * (z.bottom + 0.03) : H * 0.1;
    var sideL = W * 0.07, sideR = vertical ? W * (z.right + 0.02) : W * 0.07, maxW = W - sideL - sideR;
    if (o.style !== "none" && (o.title || o.sub)) {
      // Dégradé de lisibilité
      var g, gh = H * 0.45;
      if (o.pos === "top") { g = ctx.createLinearGradient(0, 0, 0, gh); g.addColorStop(0, "rgba(0,0,0,.75)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, gh); }
      else if (o.pos === "bottom") { g = ctx.createLinearGradient(0, H - gh, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.8)"); ctx.fillStyle = g; ctx.fillRect(0, H - gh, W, gh); }
      else { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, W, H); }

      var st = {
        noir: { font: "700 {s}px 'Space Grotesk', 'Arial Narrow', Arial, sans-serif", color: "#f2f2f2", upper: true, stroke: 0, accent: "#d9262c", size: 0.085, subColor: "#d9262c" },
        drama: { font: "900 {s}px Impact, 'Arial Black', Arial, sans-serif", color: "#ffd400", upper: true, stroke: 0.12, accent: null, size: 0.1, subColor: "#ffffff" },
        clean: { font: "500 {s}px Fraunces, Georgia, 'Times New Roman', serif", color: "#ffffff", upper: false, stroke: 0, accent: null, size: 0.08, subColor: "#d0d0d0" }
      }[o.style] || null;
      if (st) {
        var size = Math.round(unit * st.size), title = st.upper ? (o.title || "").toUpperCase() : (o.title || "");
        ctx.font = st.font.replace("{s}", size);
        var lines = this.wrap(ctx, title, maxW);
        while (lines.length > 4 && size > 20) { size = Math.round(size * 0.88); ctx.font = st.font.replace("{s}", size); lines = this.wrap(ctx, title, maxW); }
        var lh = size * 1.08, subSize = Math.round(size * 0.42), block = lines.length * lh + (o.sub ? subSize * 1.8 : 0);
        var y0 = o.pos === "top" ? padTop : o.pos === "center" ? (H - block) / 2 : H - padBottom - block;
        ctx.textBaseline = "top"; ctx.textAlign = "left";
        if (o.sub) {
          ctx.font = "700 " + subSize + "px 'Space Grotesk', Arial, sans-serif"; ctx.fillStyle = st.subColor;
          var sub = o.sub.toUpperCase();
          if (st.accent) { ctx.fillRect(sideL, y0 + subSize * 0.15, subSize * 0.22, subSize * 0.9); ctx.fillStyle = "#f2f2f2"; ctx.fillText(sub, sideL + subSize * 0.5, y0); }
          else ctx.fillText(sub, sideL, y0);
          y0 += subSize * 1.8;
        }
        ctx.font = st.font.replace("{s}", size);
        lines.forEach(function (l, i) {
          var y = y0 + i * lh;
          if (st.stroke) { ctx.lineJoin = "round"; ctx.lineWidth = size * st.stroke; ctx.strokeStyle = "#000"; ctx.strokeText(l, sideL, y); }
          ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = st.stroke ? 0 : size * 0.25;
          ctx.fillStyle = st.color; ctx.fillText(l, sideL, y); ctx.shadowBlur = 0;
        });
        if (st.accent) { ctx.fillStyle = st.accent; ctx.fillRect(sideL, y0 + lines.length * lh + size * 0.15, Math.min(maxW, size * 2.2), Math.max(3, size * 0.07)); }
      }
    }
    if (o.safe && this.SAFE[o.safe] && vertical) {
      var s = this.SAFE[o.safe];
      ctx.fillStyle = "rgba(224,60,60,.28)";
      ctx.fillRect(0, 0, W, H * s.top); ctx.fillRect(0, H * (1 - s.bottom), W, H * s.bottom);
      ctx.fillRect(W * (1 - s.right), H * s.top, W * s.right, H * (1 - s.top - s.bottom));
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "600 " + Math.round(unit * 0.03) + "px sans-serif"; ctx.textBaseline = "top";
      ctx.fillText("Zones masquées " + s.label + " (approx.)", W * 0.04, H * s.top + 10);
    }
  },
  wrap: function (ctx, text, maxW) {
    var words = String(text || "").split(/\s+/).filter(Boolean), lines = [], cur = "";
    words.forEach(function (w) {
      var test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  },

  exportKit: function () {
    var self = this, core = this.core, App = window.AgnesApp, d = this.pub();
    if (typeof JSZip === "undefined") return core.toast("Module ZIP indisponible.", "err");
    var base = App.slugify((d.serie || core.getProject().name) + "-ep" + (d.ep || 1));
    var zip = new JSZip();
    var ready = Object.keys(d.texts).length ? Promise.resolve() : this.buildTexts();
    core.toast("Préparation du kit de publication…");
    ready.then(function () {
      var t = d.texts;
      zip.file("textes/tiktok.txt", t.tiktok || ""); zip.file("textes/instagram-reels.txt", t.reels || "");
      zip.file("textes/youtube-shorts.txt", (t.shortsTitle || "") + "\n\n" + (t.shortsDesc || ""));
      zip.file("textes/youtube.txt", (t.ytTitle || "") + "\n\n" + (t.ytDesc || ""));
      zip.file("textes/prompt-aide.txt", self.helperPrompt());
      // Couvertures 9:16 et 16:9 avec les réglages courants
      var covers = ["9:16", "16:9"].map(function (fmt) {
        var cv = document.createElement("canvas"), c = d.cover || {}, sz = self.FORMATS[fmt];
        self.renderCover(cv, sz[0], sz[1], { img: self.cover.img, style: c.style || "noir", pos: c.pos || "bottom", title: c.title != null ? c.title : (d.titre || d.hook || ""), sub: c.sub != null ? c.sub : "ÉPISODE " + (d.ep || 1), safe: "" });
        return App.canvasToBlob(cv, "image/png").then(function (b) { zip.file("couverture_" + fmt.replace(":", "x") + ".png", b); });
      });
      return Promise.all(covers);
    }).then(function () {
      var f = self.film && self.film.projectId === core.getProject().id ? self.film.blob : null;
      if (f) zip.file(base + "." + (/mp4/.test(f.type) ? "mp4" : "webm"), f);
      zip.file("LISEZMOI.txt", [
        "Kit de publication — " + (d.serie || "") + " épisode " + (d.ep || 1), d.date ? "Publication prévue : " + d.date.replace("T", " à ") : "", "",
        f ? "Film : " + base + (/mp4/.test(f.type) ? ".mp4" : ".webm") + (/mp4/.test(f.type) ? "" : " (WebM : convertissez-le en MP4 avec le kit FFmpeg ou CapCut si l'appli le refuse)") : "Film : non inclus (rendez-le dans l'onglet Assemblage, ou utilisez le kit FFmpeg).",
        "Couvertures : couverture_9x16.png (TikTok/Reels/Shorts), couverture_16x9.png (miniature YouTube).",
        "Textes : dossier textes/ — prêts à coller.", "",
        "Avant de publier :",
        "- TikTok : ajoutez l'épisode à la playlist de la série, choisissez la couverture, épinglez l'épisode 1 sur le profil.",
        "- Reels : cochez « Partager aussi dans le fil », recadrez la vignette de profil en 1:1.",
        "- Shorts : reliez la vidéo à l'épisode suivant (« Vidéo associée »).",
        "- YouTube : importez la miniature 16:9 ; les chapitres ne s'affichent que s'il y en a au moins 3 de 10 s ou plus.",
        "- Si une voix ou un visage est généré par IA de façon réaliste, activez l'étiquette « contenu généré par IA » de la plateforme."
      ].filter(function (x, i) { return x !== "" || i > 1; }).join("\r\n"));
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) { core.download(blob, base + "_publication.zip"); core.toast("Kit de publication prêt.", "ok"); })
      .catch(function (e) { core.toast("Kit de publication : " + (e.message || e), "err"); });
  }
});
