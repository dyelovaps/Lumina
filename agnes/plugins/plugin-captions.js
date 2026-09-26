// plugins/plugin-captions.js — AutoCaption : sous-titres animés et stylés, posés APRÈS la génération.
// Les vidéos restent sans texte ; les sous-titres sont une couche séparée :
//  - dessinés image par image dans l'Assemblage (navigateur) ;
//  - incrustés par le kit FFmpeg (fichier sous-titres.ass) ;
//  - exportables en .srt / .ass (CapCut, Premiere, plateformes).
// Source : les dialogues de l'onglet Voix (toujours synchronisés avec le montage) ou une liste modifiable (import .srt possible).
AgnesPlugins.register("captions", {
  name: "AutoCaption",
  version: "1.0",

  FONTS: ["Arial Black", "Impact", "Arial", "Verdana", "Trebuchet MS", "Tahoma", "Georgia"],
  PRESETS: {
    tiktok: { label: "TikTok — mot actif jaune", font: "Arial Black", size: 7, color: "#FFFFFF", active: "#FFE600", activeMode: "color", stroke: "#000000", strokeW: 6, shadow: true, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "bottom", margin: 24, upper: true, maxWords: 3, anim: "pop" },
    karaoke: { label: "Karaoké — les mots se colorent", font: "Arial Black", size: 6.5, color: "#FFFFFF", active: "#00E5FF", activeMode: "karaoke", stroke: "#000000", strokeW: 5, shadow: true, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "bottom", margin: 24, upper: false, maxWords: 6, anim: "fade" },
    word: { label: "Mot par mot — plein écran", font: "Impact", size: 11, color: "#FFFFFF", active: "#FFFFFF", activeMode: "none", stroke: "#000000", strokeW: 8, shadow: true, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "middle", margin: 0, upper: true, maxWords: 1, anim: "pop" },
    boxed: { label: "Mot surligné (encadré)", font: "Arial Black", size: 6.5, color: "#FFFFFF", active: "#FF2D55", activeMode: "box", stroke: "#000000", strokeW: 4, shadow: false, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "bottom", margin: 24, upper: true, maxWords: 4, anim: "pop" },
    classic: { label: "Sous-titre classique (bandeau)", font: "Arial", size: 4.6, color: "#FFFFFF", active: "#FFFFFF", activeMode: "none", stroke: "#000000", strokeW: 0, shadow: false, bg: "box", bgColor: "#000000", bgOpacity: 0.6, position: "bottom", margin: 12, upper: false, maxWords: 9, anim: "fade" },
    cyber: { label: "Cyber-noir — mot actif rouge", font: "Arial Black", size: 6.5, color: "#FFFFFF", active: "#E63946", activeMode: "color", stroke: "#000000", strokeW: 5, shadow: true, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "bottom", margin: 24, upper: true, maxWords: 3, anim: "pop" },
    neon: { label: "Néon — halo lumineux", font: "Verdana", size: 6, color: "#FFFFFF", active: "#00FFD0", activeMode: "color", stroke: "#00FFD0", strokeW: 2, shadow: true, glow: true, bg: "none", bgColor: "#000000", bgOpacity: 0.55, position: "bottom", margin: 24, upper: false, maxWords: 4, anim: "fade" }
  },

  init: function (core) {
    var self = this, App = window.AgnesApp;
    this.core = core;
    core.ui.addTab("captions", "AutoCaption",
      '<div class="card"><h2>AutoCaption — sous-titres animés</h2>' +
      '<p class="hint" style="margin-top:0">Les vidéos restent sans texte : les sous-titres sont posés <b>après la génération</b>, pendant l\'Assemblage et par le kit FFmpeg. ' +
      'Ils suivent vos dialogues (onglet Voix) et restent synchronisés si vous modifiez le montage.</p>' +
      '<div class="row-inline"><label class="inline cap-main"><input type="checkbox" id="capOn"> Incruster les sous-titres dans l\'Assemblage et le kit FFmpeg</label></div></div>' +

      '<div class="cap-grid">' +
      '<div class="card"><h3>Texte</h3>' +
      '<div class="row-inline"><label class="inline"><input type="radio" name="capSrc" value="dialogues"> Dialogues de l\'onglet Voix (synchronisés)</label>' +
      '<label class="inline"><input type="radio" name="capSrc" value="manual"> Liste modifiable</label></div>' +
      '<div class="row-inline" id="capUnvoicedBox" style="margin-top:6px"><label class="inline"><input type="checkbox" id="capUnvoiced"> Inclure les dialogues sans voix générée (durée estimée)</label></div>' +
      '<div class="row-inline" style="margin-top:12px"><button class="small-btn" id="capToManual" type="button">Convertir en liste modifiable</button>' +
      '<label class="small-btn">Importer un .srt<input type="file" id="capSrtIn" accept=".srt,.vtt" hidden></label></div>' +
      '<div class="row-inline" style="margin-top:8px"><button class="small-btn" id="capSrtOut" type="button">Exporter .srt</button>' +
      '<button class="small-btn" id="capAssOut" type="button">Exporter .ass (styles compris)</button></div>' +
      '<div id="capList" style="margin-top:12px"></div></div>' +

      '<div class="card"><h3>Style</h3><div id="capPresets" class="chips" style="margin:0 0 14px"></div>' +
      '<div class="cap-layout"><div id="capStyle"></div>' +
      '<div class="cap-preview"><canvas id="capPreview" width="270" height="480"></canvas><p class="hint">Aperçu animé au format du montage.</p></div></div></div>' +
      '</div>');

    function $(id) { return document.getElementById(id); }
    this.$ = $;

    $("capOn").addEventListener("change", function () { self.state().on = this.checked; self.save(); });
    Array.from(document.querySelectorAll('input[name="capSrc"]')).forEach(function (r) {
      r.addEventListener("change", function () { self.state().source = this.value; self.save(); self.render(); });
    });
    $("capUnvoiced").addEventListener("change", function () { self.state().unvoiced = this.checked; self.save(); self.render(); });
    $("capToManual").addEventListener("click", function () {
      var st = self.state();
      if (st.cues.length && !window.confirm("Remplacer la liste modifiable actuelle par les dialogues ?")) return;
      core.getMontageTimeline().then(function (tl) {
        st.cues = self.cuesFromDialogues(tl.marks.map(function (m) { return { t: m.t, len: m.len, shot: m.it.shot }; }), true).map(function (c) { return { start: c.start, end: c.end, text: c.text }; });
        st.source = "manual"; self.save(); self.render();
        core.toast(st.cues.length ? st.cues.length + " sous-titre(s) : modifiez-les librement. Attention : ils ne suivent plus les changements du montage." : "Aucun dialogue trouvé dans le montage.", st.cues.length ? "ok" : "err");
      });
    });
    $("capSrtIn").addEventListener("change", function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      f.text().then(function (t) {
        var cues = self.parseSrt(t); if (!cues.length) { core.toast("Aucun sous-titre lisible dans ce fichier.", "err"); return; }
        var st = self.state(); st.cues = cues; st.source = "manual"; self.save(); self.render();
        core.toast(cues.length + " sous-titre(s) importé(s).", "ok");
      });
    });
    $("capSrtOut").addEventListener("click", function () { self.exportFile("srt"); });
    $("capAssOut").addEventListener("click", function () { self.exportFile("ass"); });
    $("capList").addEventListener("change", function (e) {
      var row = e.target.closest("[data-cue]"); if (!row) return;
      var c = self.state().cues[+row.getAttribute("data-cue")], f = e.target.getAttribute("data-cf");
      if (f === "text") c.text = e.target.value; else c[f] = self.parseTime(e.target.value);
      if (c.end <= c.start) c.end = c.start + 0.5;
      self.save(); self.render();
    });
    $("capList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cact]"); if (!b) return;
      var st = self.state(), act = b.getAttribute("data-cact");
      if (act === "add") { var last = st.cues[st.cues.length - 1]; st.cues.push({ start: last ? last.end + 0.2 : 0, end: (last ? last.end + 0.2 : 0) + 2, text: "Nouveau sous-titre" }); }
      if (act === "del") st.cues.splice(+b.closest("[data-cue]").getAttribute("data-cue"), 1);
      self.save(); self.render();
    });
    $("capPresets").addEventListener("click", function (e) {
      var b = e.target.closest("[data-preset]"); if (!b) return;
      var st = self.state(); st.style = Object.assign({}, self.PRESETS[b.getAttribute("data-preset")]); st.style.preset = b.getAttribute("data-preset");
      self.save(); self.render();
    });
    $("capStyle").addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-sf"); if (!f) return;
      var s = self.state().style, v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (["size", "strokeW", "bgOpacity", "margin", "maxWords"].indexOf(f) !== -1) v = Number(v);
      s[f] = v; s.preset = ""; self.save();
      if (e.target.type === "range") { var o = e.target.parentNode.querySelector("output"); if (o) o.textContent = v; }
      if (e.target.tagName === "SELECT" || e.target.type === "checkbox") self.renderStyle();
      self.renderPresets();
    });

    // Couche de l'Assemblage : préparée au lancement du rendu, dessinée à chaque image
    App.montageOverlays = App.montageOverlays || [];
    App.montageOverlays.push(function (ctx) { return self.prepareOverlay(ctx); });

    core.on("project:change", function () { self.render(); });
    core.on("view:change", function (id) { if (id === "view_captions") { self.render(); self.startPreview(); } else self.stopPreview(); });
  },

  // =========================================================
  // DONNÉES
  // =========================================================
  state: function () {
    var p = this.core.getProject();
    if (!p.captions) p.captions = { on: false, source: "dialogues", unvoiced: true, cues: [], style: Object.assign({ preset: "tiktok" }, this.PRESETS.tiktok) };
    return p.captions;
  },
  save: function () { this.core.saveProject(); },

  // Dialogues → sous-titres (temps absolus dans le film). marks : [{ t, len, shot }]
  cuesFromDialogues: function (marks, withUnvoiced) {
    var self = this, out = [], st = this.state(), all = withUnvoiced == null ? st.unvoiced : withUnvoiced;
    marks.forEach(function (mk) {
      var s = mk.shot, v = s.voice, text = v && v.text != null ? v.text : s.voiceDraft, voiced = v && v.key;
      if (!text || !String(text).trim() || (!voiced && !all)) return;
      var segs = self.parseDialogue(text); if (!segs.length) return;
      var chars = segs.reduce(function (a, x) { return a + x.length; }, 0) || 1;
      var off = voiced ? Math.max(0, Number(v.offset) || 0) : 0.2;
      var dur = voiced && v.dur ? v.dur : Math.min(mk.len - off, chars / 15 + 0.4 * segs.length);   // ~15 caractères/s à l'oral
      var span = Math.max(0.4, Math.min(dur, mk.len - off)), at = mk.t + off;
      segs.forEach(function (txt) {
        var d = span * txt.length / chars;
        out.push({ start: at, end: at + d, text: txt }); at += d;
      });
    });
    return out;
  },
  // « LÉA : [whispers] Tu savais ? » → « Tu savais ? » ; une réplique par ligne
  parseDialogue: function (text) {
    var segs = [], cur = null;
    String(text).split(/\r?\n/).forEach(function (line) {
      var l = line.trim(); if (!l) return;
      var m = l.match(/^([A-ZÀ-ÖØ-Þa-zà-öø-ÿ0-9' .\-]{1,30}?)\s*(?:\([^)]*\))?\s*:\s*(.+)$/);
      // « LÉA : », « Léa : », « Voix-off : » = nom de qui parle (au plus 3 mots, commençant par une majuscule)
      var isName = m && /^[A-ZÀ-ÖØ-Þ]/.test(m[1].trim()) && m[1].trim().split(/\s+/).length <= 3;
      if (isName) { cur = m[2]; segs.push(cur); }
      else if (segs.length && !m) segs[segs.length - 1] += " " + l;
      else segs.push(l);
    });
    return segs.map(function (t) { return t.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim(); }).filter(Boolean);
  },
  // Sous-titres → groupes affichés (N mots à la fois), avec le minutage de chaque mot
  chunks: function (cues) {
    var st = this.state().style, max = Math.max(1, Math.min(12, st.maxWords || 3)), out = [];
    cues.forEach(function (c) {
      // « dit ? » : la ponctuation isolée (espace française avant ? ! : ; ») reste collée au mot précédent
      var words = [];
      String(c.text).split(/\s+/).filter(Boolean).forEach(function (w) {
        if (words.length && /^[?!:;»…,.)]+$/.test(w)) words[words.length - 1] += "\u00A0" + w;
        else if (words.length && /^«$/.test(words[words.length - 1])) words[words.length - 1] += "\u00A0" + w;
        else words.push(w);
      });
      if (!words.length) return;
      var weights = words.map(function (w) { return w.length + 2; }), tot = weights.reduce(function (a, b) { return a + b; }, 0), t = c.start, span = c.end - c.start;
      var timed = words.map(function (w, i) { var d = span * weights[i] / tot, x = { text: w, start: t, end: t + d }; t += d; return x; });
      var group = [];
      timed.forEach(function (w, i) {
        group.push(w);
        var endSentence = /[.!?…]$/.test(w.text) && group.length >= 2;
        if (group.length >= max || endSentence || i === timed.length - 1) {
          out.push({ start: group[0].start, end: i === timed.length - 1 ? c.end : group[group.length - 1].end, words: group }); group = [];
        }
      });
    });
    return out;
  },
  cuesFor: function (marks) {
    var st = this.state();
    return st.source === "manual" ? st.cues.slice().sort(function (a, b) { return a.start - b.start; }) : this.cuesFromDialogues(marks);
  },

  // =========================================================
  // RENDU NAVIGATEUR (Assemblage + aperçu)
  // =========================================================
  prepareOverlay: function (info) {
    var st = this.state(); if (!st.on) return null;
    var chunks = this.chunks(this.cuesFor(info.marks)); if (!chunks.length) return null;
    var self = this, style = Object.assign({}, st.style);
    return function (ctx, now) {
      var ch = null;
      for (var i = 0; i < chunks.length; i++) if (now >= chunks[i].start && now < chunks[i].end) { ch = chunks[i]; break; }
      if (ch) self.drawChunk(ctx, info.W, info.H, ch, now, style);
    };
  },
  hexA: function (hex, a) {
    var h = String(hex || "#000000").replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
  },
  roundRect: function (ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },
  fontCss: function (s, px) {
    var heavy = /black|impact/i.test(s.font);
    return (heavy ? "" : "bold ") + Math.round(px) + 'px "' + s.font + '", "Arial Black", Arial, sans-serif';
  },
  drawChunk: function (ctx, W, H, ch, now, s) {
    var self = this, base = Math.min(W, H), fs = base * (s.size || 7) / 100 * (W > H ? 0.75 : 1);
    var words = ch.words.map(function (w) { return { text: s.upper ? w.text.toUpperCase() : w.text, start: w.start, end: w.end }; });
    ctx.save(); ctx.font = this.fontCss(s, fs); ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
    var space = ctx.measureText(" ").width, maxW = W * 0.86, lines = [[]], lw = [0];
    words.forEach(function (w) {
      w.w = ctx.measureText(w.text).width;
      var L = lines.length - 1, add = (lines[L].length ? space : 0) + w.w;
      if (lines[L].length && lw[L] + add > maxW) { lines.push([w]); lw.push(w.w); } else { lines[L].push(w); lw[L] += add; }
    });
    var lh = fs * 1.22, blockH = lines.length * lh, marginPx = H * (s.margin || 0) / 100;
    var y0 = s.position === "top" ? marginPx + lh / 2 : s.position === "middle" ? H / 2 - blockH / 2 + lh / 2 : H - marginPx - blockH + lh / 2;
    // Apparition du groupe
    var appear = Math.min(1, (now - ch.start) / 0.12), alpha = s.anim === "fade" ? appear : 1;
    ctx.globalAlpha = alpha;
    var activeIdx = -1; words.forEach(function (w, i) { if (now >= w.start) activeIdx = i; });
    var sw = (s.strokeW || 0) * base / 1080 * 2;
    // Fond : bandeau derrière chaque ligne
    if (s.bg === "box") {
      ctx.fillStyle = this.hexA(s.bgColor, s.bgOpacity == null ? 0.6 : s.bgOpacity);
      lines.forEach(function (line, li) { var pad = fs * 0.35; self.roundRect(ctx, W / 2 - lw[li] / 2 - pad, y0 + li * lh - lh / 2 + fs * 0.02, lw[li] + pad * 2, lh, fs * 0.22); ctx.fill(); });
    }
    var k = 0;
    lines.forEach(function (line, li) {
      var x = W / 2 - lw[li] / 2, y = y0 + li * lh;
      line.forEach(function (w) {
        var i = k++, isActive = i === activeIdx, done = i <= activeIdx;
        var fill = s.activeMode === "color" && isActive ? s.active : s.activeMode === "karaoke" && done ? s.active : s.color;
        var scale = 1;
        if (s.anim === "pop" && (isActive || s.maxWords === 1)) scale = 1 + 0.18 * (1 - Math.min(1, (now - (s.maxWords === 1 ? ch.start : w.start)) / 0.14));
        var cx = x + w.w / 2;
        ctx.save(); ctx.translate(cx, y); ctx.scale(scale, scale);
        if (s.activeMode === "box" && isActive) { ctx.fillStyle = s.active; var p = fs * 0.14; self.roundRect(ctx, -w.w / 2 - p, -lh / 2 + fs * 0.08, w.w + p * 2, lh - fs * 0.1, fs * 0.18); ctx.fill(); }
        if (sw > 0) { ctx.strokeStyle = s.stroke; ctx.lineWidth = sw; ctx.strokeText(w.text, -w.w / 2, 0); }
        if (s.glow) { ctx.shadowColor = s.active; ctx.shadowBlur = fs * 0.45; }
        else if (s.shadow) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = fs * 0.12; ctx.shadowOffsetY = fs * 0.06; }
        ctx.fillStyle = fill; ctx.fillText(w.text, -w.w / 2, 0);
        ctx.restore();
        x += w.w + space;
      });
    });
    ctx.restore();
  },

  // =========================================================
  // KIT FFMPEG ET EXPORTS (.ass / .srt)
  // =========================================================
  assColor: function (hex, alpha) {
    var h = String(hex || "#FFFFFF").replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var a = Math.round(255 * (1 - (alpha == null ? 1 : alpha))).toString(16).padStart(2, "0");
    return ("&H" + a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
  },
  assTime: function (t) {
    t = Math.max(0, t); var cs = Math.round(t * 100), h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60;
    return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(cs % 100).padStart(2, "0");
  },
  assEsc: function (t) { return String(t).replace(/\\/g, "＼").replace(/[{}]/g, ""); },
  // Fichier .ass complet pour une taille d'image W×H et des plans [{ t, len, shot }]
  buildAss: function (W, H, marks) {
    var self = this, s = this.state().style, chunks = this.chunks(this.cuesFor(marks));
    var base = Math.min(W, H), fs = Math.round(base * (s.size || 7) / 100 * (W > H ? 0.75 : 1)), heavy = /black|impact/i.test(s.font);
    var align = s.position === "top" ? 8 : s.position === "middle" ? 5 : 2, marginV = s.position === "middle" ? 0 : Math.round(H * (s.margin || 0) / 100);
    var boxed = s.bg === "box", outline = boxed ? Math.round(fs * 0.3) : Math.round((s.strokeW || 0) * base / 1080 * 2 / 2);
    var primary = s.activeMode === "karaoke" ? s.active : s.color, secondary = s.activeMode === "karaoke" ? s.color : s.active;
    var outlineCol = boxed ? this.assColor(s.bgColor, s.bgOpacity == null ? 0.6 : s.bgOpacity) : this.assColor(s.glow ? s.active : s.stroke, 1);
    var shadow = s.shadow || s.glow ? Math.max(1, Math.round(fs * 0.05)) : 0;
    var head = ["[Script Info]", "; AutoCaption — Agnes Studio Pro", "ScriptType: v4.00+", "PlayResX: " + W, "PlayResY: " + H, "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Caption," + s.font + "," + fs + "," + this.assColor(primary, 1) + "," + this.assColor(secondary, 1) + "," + outlineCol + "," + this.assColor("#000000", s.glow ? 0.35 : 0.55) + "," +
        (heavy ? 0 : -1) + ",0,0,0,100,100,0,0," + (boxed ? 3 : 1) + "," + outline + "," + (boxed ? 0 : shadow) + "," + align + "," + Math.round(W * 0.07) + "," + Math.round(W * 0.07) + "," + marginV + ",1", "",
      "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"];
    var ev = [];
    function up(t) { return self.assEsc(s.upper ? t.toUpperCase() : t); }
    function line(a, b, txt) { if (b - a >= 0.01) ev.push("Dialogue: 0," + self.assTime(a) + "," + self.assTime(b) + ",Caption,,0,0,0,," + txt); }
    var fade = s.anim === "fade" ? "{\\fad(120,0)}" : "";
    chunks.forEach(function (ch) {
      var ws = ch.words;
      if (s.activeMode === "karaoke") {
        line(ch.start, ch.end, fade + ws.map(function (w) { return "{\\kf" + Math.max(1, Math.round((w.end - w.start) * 100)) + "}" + up(w.text); }).join(" "));
      } else if (s.activeMode === "none" || ws.length === 1) {
        var pop1 = s.anim === "pop" ? "{\\fscx118\\fscy118\\t(0,140,\\fscx100\\fscy100)}" : "";
        line(ch.start, ch.end, fade + pop1 + ws.map(function (w) { return up(w.text); }).join(" "));
      } else {
        // Un événement par mot actif : le mot en cours est coloré (ou encadré) et « saute »
        ws.forEach(function (w, i) {
          var a = i === 0 ? ch.start : w.start, b = i === ws.length - 1 ? ch.end : ws[i + 1].start;
          var txt = ws.map(function (x, j) {
            if (j !== i) return up(x.text);
            var on = s.activeMode === "box" ? "{\\3c" + self.assColor(s.active, 1) + "\\bord" + Math.round(fs * 0.22) + "\\shad0}" : "{\\c" + self.assColor(s.active, 1) + "}";
            var pop = s.anim === "pop" ? "{\\fscx115\\fscy115\\t(0,140,\\fscx100\\fscy100)}" : "";
            return pop + on + up(x.text) + "{\\r}";
          }).join(" ");
          line(a, b, (i === 0 ? fade : "") + txt);
        });
      }
    });
    return head.concat(ev).join("\r\n") + "\r\n";
  },
  // Appelé par le kit FFmpeg avec ses propres positions de plans
  kitAss: function (W, H, marks) {
    var st = this.state(); if (!st.on) return null;
    var ass = this.buildAss(W, H, marks);
    return /\nDialogue:/.test(ass) ? ass : null;
  },
  srtTime: function (x) { var ms = Math.max(0, Math.round(x * 1000)); return String(Math.floor(ms / 3600000)).padStart(2, "0") + ":" + String(Math.floor(ms / 60000) % 60).padStart(2, "0") + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0") + "," + String(ms % 1000).padStart(3, "0"); },
  parseTime: function (v) {
    var m = String(v).trim().replace(",", ".").match(/^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/); if (!m) return 0;
    var parts = [m[1], m[2], m[3]].filter(function (x) { return x != null; }).map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  },
  fmtTime: function (t) { var m = Math.floor(t / 60), s = (t - m * 60).toFixed(2); return m + ":" + (s < 10 ? "0" : "") + s; },
  parseSrt: function (t) {
    var self = this, out = [];
    String(t).replace(/\r/g, "").split(/\n{2,}/).forEach(function (block) {
      var lines = block.split("\n").filter(function (l) { return l.trim() && l.trim() !== "WEBVTT"; });
      var i = lines.findIndex(function (l) { return /-->/.test(l); }); if (i < 0) return;
      var m = lines[i].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/); if (!m) return;
      var text = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim(); if (!text) return;
      out.push({ start: self.parseTime(m[1]), end: self.parseTime(m[2]), text: text });
    });
    return out;
  },
  exportFile: function (kind) {
    var self = this, core = this.core, App = window.AgnesApp, proj = core.getProject();
    core.getMontageTimeline().then(function (tl) {
      var marks = tl.marks.map(function (m) { return { t: m.t, len: m.len, shot: m.it.shot }; }), cues = self.cuesFor(marks);
      if (!cues.length) { core.toast("Aucun sous-titre : ajoutez des dialogues (onglet Voix) ou une liste.", "err"); return; }
      var o = Object.assign({ aspect: proj.aspect, res: "1080p" }, proj.montage.opts || {}), size = App.computeSize(o.aspect, o.res);
      var body = kind === "ass" ? self.buildAss(size.w, size.h, marks)
        : cues.map(function (c, i) { return (i + 1) + "\n" + self.srtTime(c.start) + " --> " + self.srtTime(c.end) + "\n" + c.text + "\n"; }).join("\n");
      core.download(new Blob([body], { type: "text/plain;charset=utf-8" }), App.slugify(proj.name) + "_sous-titres." + kind);
    });
  },

  // =========================================================
  // INTERFACE
  // =========================================================
  render: function () {
    if (!this.core.getProject() || !this.$("capOn")) return;
    var st = this.state(), $ = this.$;
    $("capOn").checked = !!st.on;
    Array.from(document.querySelectorAll('input[name="capSrc"]')).forEach(function (r) { r.checked = r.value === st.source; });
    $("capUnvoiced").checked = st.unvoiced !== false;
    $("capUnvoicedBox").style.display = st.source === "dialogues" ? "" : "none";
    this.renderList(); this.renderPresets(); this.renderStyle();
  },
  renderList: function () {
    var self = this, st = this.state(), esc = window.AgnesApp.esc, el = this.$("capList");
    if (st.source === "dialogues") {
      var n = this.core.getShots().filter(function (s) { var t = s.voice && s.voice.text != null ? s.voice.text : s.voiceDraft; return t && String(t).trim() && (st.unvoiced !== false || (s.voice && s.voice.key)); }).length;
      el.innerHTML = '<p class="hint" style="margin:0">' + (n ? n + " plan(s) avec dialogue. Le texte se modifie dans l'onglet <b>Voix</b> ; le minutage suit la voix de chaque plan et le montage réel." :
        "Aucun dialogue pour l'instant : écrivez-les dans l'onglet Voix (ou importez un scénario), ou passez en « Liste modifiable ».") + '</p>';
      return;
    }
    el.innerHTML = '<div class="cap-cues">' + st.cues.map(function (c, i) {
      return '<div class="cap-cue" data-cue="' + i + '"><input type="text" data-cf="start" value="' + self.fmtTime(c.start) + '" title="Début (min:s)">' +
        '<input type="text" data-cf="end" value="' + self.fmtTime(c.end) + '" title="Fin (min:s)"><input type="text" class="grow" data-cf="text" value="' + esc(c.text) + '">' +
        '<button class="small-btn" data-cact="del" title="Supprimer">✕</button></div>';
    }).join("") + '</div><button class="small-btn" data-cact="add" style="margin-top:6px">+ Ajouter un sous-titre</button>' +
      '<p class="hint">Temps en minutes:secondes dans le film monté. Une liste ne suit plus les changements du montage : régénérez-la après avoir modifié l\'ordre ou les durées des plans.</p>';
  },
  renderPresets: function () {
    var st = this.state(), P = this.PRESETS, esc = window.AgnesApp.esc;
    this.$("capPresets").innerHTML = Object.keys(P).map(function (k) { return '<button type="button" class="chip' + (st.style.preset === k ? " on" : "") + '" data-preset="' + k + '">' + esc(P[k].label) + '</button>'; }).join("");
  },
  renderStyle: function () {
    var s = this.state().style, esc = window.AgnesApp.esc;
    function sel(f, opts) { return '<select data-sf="' + f + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(s[f]) === String(o[0]) ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>'; }
    function range(f, min, max, step) { return '<span class="cap-range"><input type="range" data-sf="' + f + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + s[f] + '"><output>' + s[f] + '</output></span>'; }
    function color(f, title) { return '<input type="color" class="cap-color" data-sf="' + f + '" value="' + esc(s[f]) + '" title="' + esc(title || "Couleur") + '">'; }
    function field(label, html) { return '<div class="field"><label>' + label + '</label>' + html + '</div>'; }
    function check(f, label) { return '<label class="inline"><input type="checkbox" data-sf="' + f + '"' + (s[f] ? " checked" : "") + '> ' + label + '</label>'; }
    this.$("capStyle").innerHTML =
      '<div class="grid2">' +
      field("Police", sel("font", this.FONTS.map(function (f) { return [f, f]; }))) +
      field("Taille (% de l\'image)", range("size", 3, 14, 0.1)) +
      field("Mot prononcé", '<div class="cap-inline">' + sel("activeMode", [["none", "Aucun effet"], ["color", "Change de couleur"], ["karaoke", "Karaoké"], ["box", "Encadré"]]) + (s.activeMode !== "none" ? color("active", "Couleur du mot prononcé") : "") + '</div>') +
      field("Couleur du texte", '<div class="cap-inline">' + color("color", "Couleur du texte") + '</div>') +
      field("Contour", '<div class="cap-inline">' + color("stroke", "Couleur du contour") + range("strokeW", 0, 14, 1) + '</div>') +
      field("Fond", '<div class="cap-inline">' + sel("bg", [["none", "Aucun"], ["box", "Bandeau"]]) + (s.bg === "box" ? color("bgColor", "Couleur du bandeau") : "") + '</div>' +
        (s.bg === "box" ? '<label style="margin-top:8px">Opacité du bandeau</label>' + range("bgOpacity", 0.1, 1, 0.05) : "")) +
      field("Position", sel("position", [["bottom", "Bas"], ["middle", "Centre"], ["top", "Haut"]]) +
        (s.position !== "middle" ? '<label style="margin-top:8px">Marge (% de la hauteur)</label>' + range("margin", 0, 45, 1) : "")) +
      field("Mots à l\'écran", range("maxWords", 1, 12, 1)) +
      field("Animation", sel("anim", [["none", "Aucune"], ["pop", "Pop (le mot rebondit)"], ["fade", "Fondu"]])) +
      field("Options", '<div class="row-inline">' + check("upper", "MAJUSCULES") + check("shadow", "Ombre") + check("glow", "Halo") + '</div>') +
      '</div><p class="hint" style="margin-top:0">Pour TikTok, Reels et Shorts, gardez une marge basse de 20 % ou plus : les boutons et la légende y sont affichés.</p>';
  },

  // Aperçu animé : première image du montage (ou un dégradé) + une phrase qui défile en boucle
  startPreview: function () {
    var self = this, cv = this.$("capPreview"); if (!cv || this._raf) return;
    var proj = this.core.getProject(), o = Object.assign({ aspect: proj.aspect }, proj.montage.opts || {}), size = window.AgnesApp.computeSize(o.aspect, "720p");
    var k = 480 / Math.max(size.w, size.h); cv.width = Math.round(size.w * k); cv.height = Math.round(size.h * k);
    var bg = null, sample = null;
    var shot = this.core.getShots().find(function (s) { var t = self.core.getSelectedTake(s); return t && t.thumb; });
    if (shot) { var im = new Image(); im.onload = function () { bg = im; }; im.src = this.core.getSelectedTake(shot).thumb; }
    var first = this.core.getShots().map(function (s) { var t = s.voice && s.voice.text != null ? s.voice.text : s.voiceDraft; return t ? self.parseDialogue(t)[0] : null; }).find(Boolean);
    sample = first || "Tu savais depuis le début, et tu n'as rien dit ?";
    var t0 = performance.now(), ctx = cv.getContext("2d");
    function loop() {
      var W = cv.width, H = cv.height, len = Math.max(2.5, sample.length / 13), now = ((performance.now() - t0) / 1000) % (len + 0.8);
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, W, H);
      if (bg) { var s = Math.max(W / bg.width, H / bg.height); ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s); }
      else { var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1d3557"); g.addColorStop(1, "#6d2e46"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      var ch = self.chunks([{ start: 0, end: len, text: sample }]).find(function (c) { return now >= c.start && now < c.end; });
      if (ch) self.drawChunk(ctx, W, H, ch, now, self.state().style);
      self._raf = requestAnimationFrame(loop);
    }
    loop();
  },
  stopPreview: function () { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
});
