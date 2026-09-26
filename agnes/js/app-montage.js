// js/app-montage.js — assemblage des plans (rendu navigateur) et export .zip
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId, esc = A.esc;
  var rendering = null;

  function opts(proj) {
    proj = proj || A.getProject();
    var o = Object.assign({ aspect: proj.aspect, res: proj.resolution === "2160p" || proj.resolution === "1440p" ? "1080p" : proj.resolution, fps: 30, fit: "cover", trans: "cut", still: 3, audio: true, ken: true, up: "net" }, proj.montage.opts || {});
    return o;
  }
  function itemCfg(proj, shotId) {
    var m = proj.montage.items; if (!m[shotId]) m[shotId] = { on: true, dur: "", tin: "", tout: "", trans: "", tdur: 0.6 };
    return m[shotId];
  }

  // Plan de montage : plans terminés, dans l'ordre, avec leur prise sélectionnée
  A.montagePlan = function (proj) {
    proj = proj || A.getProject(); var o = opts(proj);
    return A.sortedShots(proj).map(function (s, i) {
      var take = A.selectedTake(s); if (!take) return null;
      var c = itemCfg(proj, s.id);
      return {
        index: i + 1, shot: s, take: take, kind: take.kind, on: c.on !== false,
        still: take.kind === "image" ? (Number(c.dur) || o.still) : null,
        tin: Number(c.tin) || 0, tout: c.tout === "" || c.tout == null ? null : Number(c.tout),
        trans: c.trans || o.trans, tdur: Number(c.tdur) || 0.6,
        voice: s.voice && s.voice.key ? s.voice : null
      };
    }).filter(Boolean);
  };

  // Chronologie réelle du montage (durées mesurées des clips) → { total, marks: [{ t, len, it }] }
  A.montageTimeline = function (proj) {
    var plan = A.montagePlan(proj).filter(function (it) { return it.on; }), lens = [], chain = Promise.resolve();
    plan.forEach(function (it, i) {
      chain = chain.then(function () {
        var fallback = Number(it.shot.duration) || 5;
        if (it.kind === "image") { lens[i] = it.still; return; }
        return A.getTakeBlobOrFetch(it.take).then(function (b) {
          if (!b) { lens[i] = fallback; return; }
          return new Promise(function (res) {
            var v = document.createElement("video"), u = URL.createObjectURL(b); v.preload = "metadata";
            function done(d) { URL.revokeObjectURL(u); var tin = Math.min(Math.max(0, it.tin || 0), Math.max(0, d - 0.2)); lens[i] = Math.max(0.2, (it.tout == null ? d : Math.min(d, Math.max(tin + 0.2, it.tout))) - tin); res(); }
            v.onloadedmetadata = function () {
              if (isFinite(v.duration)) return done(v.duration);
              // WebM sans durée dans l'en-tête : forcer le calcul
              v.ontimeupdate = function () { v.ontimeupdate = null; done(isFinite(v.duration) ? v.duration : fallback); }; v.currentTime = 1e6;
            };
            v.onerror = function () { URL.revokeObjectURL(u); lens[i] = fallback; res(); };
            v.src = u;
          });
        }).catch(function () { lens[i] = fallback; });
      });
    });
    return chain.then(function () {
      var t = 0, marks = [];
      plan.forEach(function (it, i) {
        marks.push({ t: t, len: lens[i], it: it });
        var next = plan[i + 1];
        t += lens[i] - (next && it.trans === "fade" ? Math.min(it.tdur, lens[i] / 2, lens[i + 1] / 2) : 0);
      });
      return { total: t, marks: marks };
    });
  };

  // =========================================================
  // ÉTALONNAGE (partagé : rendu navigateur, aperçu de l'extension, kit FFmpeg)
  // g = { on, contrast, saturation, brightness, temperature (-1..1), sepia (0..1), vignette (0..1), grain (0..1), sharpen (0..1), skip:[shotId] }
  // =========================================================
  A.gradeActive = function (proj) { var g = (proj || A.getProject()).grade; return g && g.on ? g : null; };
  A.gradeCss = function (g) {
    if (!g) return "none";
    var f = [];
    if (g.contrast != null && g.contrast != 1) f.push("contrast(" + g.contrast + ")");
    if (g.saturation != null && g.saturation != 1) f.push("saturate(" + g.saturation + ")");
    if (g.brightness != null && g.brightness != 1) f.push("brightness(" + g.brightness + ")");
    if (g.sepia) f.push("sepia(" + g.sepia + ")");
    return f.length ? f.join(" ") : "none";
  };
  var grainTile = null;
  A.drawGradeOverlay = function (ctx, W, H, g, frame) {
    if (!g) return;
    ctx.save();
    var T = Number(g.temperature) || 0;
    if (T) { ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = T > 0 ? "rgba(255,140,40," + (Math.abs(T) * 0.45) + ")" : "rgba(40,120,255," + (Math.abs(T) * 0.45) + ")"; ctx.fillRect(0, 0, W, H); }
    var V = Number(g.vignette) || 0;
    if (V) {
      ctx.globalCompositeOperation = "source-over";
      var r = Math.hypot(W, H) / 2, gr = ctx.createRadialGradient(W / 2, H / 2, r * (0.75 - 0.4 * V), W / 2, H / 2, r);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0," + (0.35 + 0.55 * V) + ")");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    var G = Number(g.grain) || 0;
    if (G) {
      if (!grainTile) {
        grainTile = document.createElement("canvas"); grainTile.width = grainTile.height = 256;
        var gc = grainTile.getContext("2d"), id = gc.createImageData(256, 256);
        for (var i = 0; i < id.data.length; i += 4) { var v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
        gc.putImageData(id, 0, 0);
      }
      ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.min(0.5, G * 0.35);
      var ox = ((frame || 0) * 97) % 256, oy = ((frame || 0) * 57) % 256;
      ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grainTile, "repeat"); ctx.fillRect(ox, oy, W, H);
    }
    ctx.restore();
  };
  A.gradeFfmpeg = function (g, lutFile) {
    if (!g) return "";
    var f = [];
    if (lutFile) f.push("lut3d=file=" + lutFile);
    var c = g.contrast == null ? 1 : +g.contrast, s = g.saturation == null ? 1 : +g.saturation, b = g.brightness == null ? 1 : +g.brightness;
    if (c !== 1 || s !== 1 || b !== 1) f.push("eq=contrast=" + c.toFixed(2) + ":saturation=" + s.toFixed(2) + ":brightness=" + ((b - 1) * 0.35).toFixed(3));
    var a = +g.sepia || 0;
    if (a) f.push("colorchannelmixer=" + [1 - a + a * .393, a * .769, a * .189, 0, a * .349, 1 - a + a * .686, a * .168, 0, a * .272, a * .534, 1 - a + a * .131].map(function (x) { return x.toFixed(3); }).join(":"));
    var T = +g.temperature || 0;
    if (T) f.push("colorbalance=rs=" + (T * 0.2).toFixed(3) + ":bs=" + (-T * 0.2).toFixed(3) + ":rm=" + (T * 0.12).toFixed(3) + ":bm=" + (-T * 0.12).toFixed(3));
    if (+g.sharpen) f.push("unsharp=5:5:" + (g.sharpen * 1.5).toFixed(2));
    if (+g.vignette) f.push("vignette=angle=" + (0.25 + 0.55 * g.vignette).toFixed(3));
    if (+g.grain) f.push("noise=alls=" + Math.round(g.grain * 25) + ":allf=t+u");
    return f.join(",");
  };

  A.renderMontage = function () {
    var proj = A.getProject(), o = opts(proj), plan = A.montagePlan(proj);
    byId("mxAspect").innerHTML = A.optionsHtml(A.ASPECTS, o.aspect);
    byId("mxRes").innerHTML = A.optionsHtml(A.RESOLUTIONS.slice(0, 3), o.res);
    byId("mxFps").value = o.fps; byId("mxFit").value = o.fit; byId("mxTrans").value = o.trans; byId("mxStill").value = o.still;
    byId("mxAudio").checked = o.audio; byId("mxKen").checked = o.ken;
    byId("mxUp").innerHTML = A.optionsHtml(A.UPSCALE_MODES, o.up || "net");
    byId("mxEmpty").style.display = plan.length ? "none" : "block";
    var tOpts = [["", "Transition : par défaut"], ["cut", "Cut"], ["fade", "Fondu enchaîné"], ["black", "Fondu au noir"]];
    byId("mxList").innerHTML = plan.map(function (it, k) {
      var c = itemCfg(proj, it.shot.id), last = k === plan.length - 1;
      return '<div class="tl-row' + (it.on ? "" : " off") + '" data-mx="' + it.shot.id + '">' +
        '<input type="checkbox" data-mf="on"' + (it.on ? " checked" : "") + ' aria-label="Inclure le plan ' + it.index + '">' +
        '<div class="tl-thumb">' + (it.take.thumb ? '<img src="' + it.take.thumb + '" alt="">' : '') + '</div>' +
        '<div class="tl-fields"><div class="tl-title">#' + it.index + ' · ' + (it.kind === "video" ? "vidéo" : "image") + ' — ' + esc(it.shot.prompt || "(sans description)") + '</div>' +
        (it.kind === "image"
          ? '<label class="inline">Durée <input type="number" step="0.5" min="0.5" data-mf="dur" value="' + esc(c.dur) + '" placeholder="' + o.still + '"> s</label>'
          : '<label class="inline">Début <input type="number" step="0.1" min="0" data-mf="tin" value="' + esc(c.tin) + '" placeholder="0"> s</label>' +
          '<label class="inline">Fin <input type="number" step="0.1" min="0" data-mf="tout" value="' + esc(c.tout) + '" placeholder="fin"> s</label>') +
        (last ? '' : '<select data-mf="trans">' + A.optionsHtml(tOpts, c.trans || "") + '</select>' +
          '<label class="inline">durée <input type="number" step="0.1" min="0.1" max="3" data-mf="tdur" value="' + esc(c.tdur) + '"> s</label>') +
        '</div></div>';
    }).join("");
  };
  function saveOpts() {
    var p = A.getProject();
    p.montage.opts = { aspect: byId("mxAspect").value, res: byId("mxRes").value, fps: A.clamp(byId("mxFps").value, 12, 60), fit: byId("mxFit").value,
      trans: byId("mxTrans").value, still: A.clamp(byId("mxStill").value, 0.5, 30), audio: byId("mxAudio").checked, ken: byId("mxKen").checked, up: byId("mxUp").value };
    A.touch();
  }

  // =========================================================
  // RENDU (canvas + MediaRecorder, en temps réel)
  // =========================================================
  A.pickVideoMime = function () { return pickMime(); };
  function pickMime() {
    var list = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (var i = 0; i < list.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    return "";
  }
  function waitEvent(el, ev, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("délai dépassé")); }, ms || 15000);
      el.addEventListener(ev, function h() { clearTimeout(t); el.removeEventListener(ev, h); resolve(); });
      el.addEventListener("error", function () { clearTimeout(t); reject(new Error("média illisible")); }, { once: true });
    });
  }
  // Agrandissement de qualité (js/upscale.js) quand la source est plus petite que la sortie (ex. 720P → 1080p)
  function drawFit(ctx, src, sw, sh, W, H, fit, zoom, mode) { A.drawScaled(ctx, src, sw, sh, W, H, fit, zoom, mode); }

  function renderFilm() {
    if (rendering) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { A.toast("Ce navigateur ne sait pas enregistrer une vidéo (utilisez Chrome ou Edge récents).", "err"); return; }
    saveOpts();
    var proj = A.getProject(), o = opts(proj), plan = A.montagePlan(proj).filter(function (it) { return it.on; });
    if (!plan.length) { A.toast("Aucun plan à assembler.", "err"); return; }
    var size = A.computeSize(o.aspect, o.res), W = size.w, H = size.h;
    var canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)(), dest = audioCtx.createMediaStreamDestination();
    var urls = [], skipped = 0, state = { stop: false };
    rendering = state;
    byId("mxRenderBtn").disabled = true; byId("mxStopBtn").style.display = "inline-block"; byId("mxOut").innerHTML = "";
    status("Chargement des médias…");

    var items = [], voices = [], beds = [], grade = A.gradeActive(proj), gradeCss = A.gradeCss(grade), frameNo = 0;
    var skipGrade = new Set(grade && grade.skip || []);
    // Voix-off / dialogue attachés au plan (extension Voix) : mixés au démarrage du plan
    function attachVoice(it) {
      if (!it.voice) return;
      return AgnesStore.getBlob(it.voice.key).then(function (vb) {
        if (!vb) return;
        var owner = items[items.length - 1]; if (!owner || owner.it !== it) return;
        var au = new Audio(), vu = URL.createObjectURL(vb); urls.push(vu); au.src = vu; au.preload = "auto";
        try {
          var g = audioCtx.createGain(); audioCtx.createMediaElementSource(au).connect(g); g.connect(dest);
          g.gain.value = A.clamp(it.voice.volume == null ? 1 : it.voice.volume, 0, 2);
          owner.voice = { el: au, gain: g, offset: Math.max(0, Number(it.voice.offset) || 0), vol: g.gain.value, duck: it.voice.duck == null ? 0.35 : Number(it.voice.duck) };
          voices.push(owner.voice);
        } catch (e) { }
      });
    }
    var chain = Promise.resolve();
    plan.forEach(function (it) {
      chain = chain.then(function () {
        return A.getTakeBlobOrFetch(it.take).then(function (blob) {
          if (!blob) { skipped++; return; }
          var url = URL.createObjectURL(blob); urls.push(url);
          if (it.kind === "image") return A.loadImage(url).then(function (img) {
            items.push({ it: it, el: img, sw: img.naturalWidth, sh: img.naturalHeight, len: it.still, image: true });
          });
          var v = document.createElement("video");
          v.src = url; v.playsInline = true; v.preload = "auto"; v.muted = !o.audio;
          return waitEvent(v, "loadedmetadata").then(function () {
            var d = v.duration || 5, tin = Math.min(Math.max(0, it.tin), Math.max(0, d - 0.2));
            var tout = it.tout == null ? d : Math.min(d, Math.max(tin + 0.2, it.tout));
            v.currentTime = tin;
            return waitEvent(v, "seeked").then(function () {
              var item = { it: it, el: v, sw: v.videoWidth, sh: v.videoHeight, len: tout - tin, tin: tin, tout: tout, video: true };
              if (o.audio) { try { var srcNode = audioCtx.createMediaElementSource(v), g = audioCtx.createGain(); srcNode.connect(g); g.connect(dest); item.gain = g; } catch (e) { } }
              items.push(item);
            });
          });
        }).then(function () { return attachVoice(it); }).catch(function () { skipped++; });
      });
    });

    // Musiques / ambiances / bruitages (extension Musique) : proj.audioBeds
    (proj.audioBeds || []).forEach(function (b) {
      if (!b.key || b.mute) return;
      chain = chain.then(function () {
        return AgnesStore.getBlob(b.key).then(function (bl) {
          if (!bl) return;
          var el = new Audio(), u = URL.createObjectURL(bl); urls.push(u); el.src = u; el.loop = !!b.loop; el.preload = "auto";
          var g = audioCtx.createGain(); g.gain.value = 0;
          try { audioCtx.createMediaElementSource(el).connect(g); g.connect(dest); } catch (e) { return; }
          return waitEvent(el, "loadedmetadata").then(function () {
            try { el.currentTime = Math.max(0, Number(b.offset) || 0); } catch (e) { }
            beds.push({ b: b, el: el, gain: g });
          });
        }).catch(function () { });
      });
    });

    chain.then(function () {
      if (!items.length) throw new Error("aucun média lisible (les rendus distants non téléchargés ne peuvent pas être assemblés)");
      // Chronologie avec chevauchement pour les fondus enchaînés
      var t = 0;
      items.forEach(function (x, i) {
        var next = items[i + 1];
        x.start = t; x.trans = next ? x.it.trans : "cut";
        x.overlapOut = next && x.trans === "fade" ? Math.min(x.it.tdur, x.len / 2, next.len / 2) : 0;
        x.blackOut = next && x.trans === "black" ? Math.min(x.it.tdur / 2, x.len / 2) : 0;
        if (next) { next.overlapIn = x.overlapOut; next.blackIn = x.blackOut ? Math.min(x.it.tdur / 2, next.len / 2) : 0; }
        t += x.len - x.overlapOut;
      });
      var total = t;
      // Couches dessinées par-dessus l'image (ex. AutoCaption) : préparées une fois avec les vraies positions des plans
      var overlays = (A.montageOverlays || []).map(function (prep) {
        try { return prep({ proj: proj, W: W, H: H, total: total, marks: items.map(function (x) { return { t: x.start, len: x.len, shot: x.it.shot }; }) }); }
        catch (e) { console.warn("[Assemblage] couche ignorée :", e); return null; }
      }).filter(Boolean);
      beds.forEach(function (bd) {
        var from = items.find(function (x) { return x.it.shot.id === bd.b.from; }), to = items.find(function (x) { return x.it.shot.id === bd.b.to; });
        bd.start = (from ? from.start : 0) + Math.max(0, Number(bd.b.delay) || 0);
        bd.end = to ? to.start + to.len : total; if (bd.end <= bd.start) bd.end = total;
        bd.vol = A.clamp(bd.b.volume == null ? 0.6 : bd.b.volume, 0, 2);
        bd.fi = Math.max(0, Number(bd.b.fadeIn) || 0); bd.fo = Math.max(0, Number(bd.b.fadeOut) || 0);
        bd.duck = bd.b.duck == null ? 0.4 : A.clamp(bd.b.duck, 0, 1);
      });
      // Piste audio additionnelle
      var trackFile = byId("mxTrack").files && byId("mxTrack").files[0], trackEl = null;
      if (trackFile) {
        trackEl = new Audio(); var tu = URL.createObjectURL(trackFile); urls.push(tu); trackEl.src = tu;
        try { audioCtx.createMediaElementSource(trackEl).connect(dest); } catch (e) { trackEl = null; }
      }
      var stream = canvas.captureStream(o.fps);
      var hasAudio = (o.audio && items.some(function (x) { return x.gain; })) || trackEl || voices.length || beds.length;
      if (hasAudio) dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
      var mime = pickMime(), bitrate = H >= 1080 || W >= 1080 ? 10e6 : H >= 720 || W >= 720 ? 6e6 : 3e6;
      var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var preview = byId("mxPreview"); preview.srcObject = new MediaStream(stream.getVideoTracks()); preview.style.display = "block"; preview.play().catch(function () { });

      return audioCtx.resume().then(function () {
        return new Promise(function (resolve) {
          rec.onstop = function () { resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }), total: total }); };
          rec.start(1000);
          if (trackEl) trackEl.play().catch(function () { });
          var t0 = performance.now(), lastUi = 0;
          function frame() {
            var now = (performance.now() - t0) / 1000;
            if (state.stop || now >= total) {
              items.forEach(function (x) { if (x.video) x.el.pause(); if (x.voice) x.voice.el.pause(); });
              if (trackEl) trackEl.pause();
              beds.forEach(function (bd) { bd.el.pause(); });
              setTimeout(function () { rec.stop(); }, 150); return;
            }
            ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); frameNo++;
            var voiceOn = voices.some(function (v) { return v.started && !v.done && !v.el.ended; });
            beds.forEach(function (bd) {
              if (!bd.started && now >= bd.start && now < bd.end) { bd.started = true; bd.el.play().catch(function () { }); }
              if (bd.started && !bd.done && now >= bd.end) { bd.done = true; bd.el.pause(); }
              if (!bd.started || bd.done) return;
              var f = 1;
              if (bd.fi) f = Math.min(f, (now - bd.start) / bd.fi);
              if (bd.fo) f = Math.min(f, (bd.end - now) / bd.fo);
              bd.gain.gain.value = bd.vol * Math.max(0, Math.min(1, f)) * (voiceOn ? bd.duck : 1);
            });
            items.forEach(function (x) {
              var local = now - x.start;
              if (local < 0 || local >= x.len) {
                if (x.video && x.playing && local >= x.len) { x.el.pause(); x.playing = false; x.ended = true; }
                if (x.voice && x.voice.started && !x.voice.done && local >= x.len) { x.voice.el.pause(); x.voice.done = true; }
                return;
              }
              if (x.voice && !x.voice.started && local >= x.voice.offset) { x.voice.started = true; x.voice.el.play().catch(function () { }); }
              if (x.video && !x.playing && !x.ended) { x.el.play().catch(function () { }); x.playing = true; }
              var a = 1;
              if (x.overlapIn && local < x.overlapIn) a = local / x.overlapIn;
              if (x.blackIn && local < x.blackIn) a = Math.min(a, local / x.blackIn);
              if (x.blackOut && local > x.len - x.blackOut) a = Math.min(a, (x.len - local) / x.blackOut);
              a = Math.max(0, Math.min(1, a));
              if (x.gain) x.gain.gain.value = a * (x.voice && x.voice.started && !x.voice.done && !x.voice.el.ended ? x.voice.duck : 1);
              if (x.voice) x.voice.gain.gain.value = x.voice.vol * a;
              ctx.globalAlpha = a;
              var zoom = x.image && o.ken ? 1 + 0.06 * (local / x.len) : 1;
              var graded = grade && !skipGrade.has(x.it.shot.id);
              if (graded && gradeCss !== "none") ctx.filter = gradeCss;
              drawFit(ctx, x.el, x.sw || W, x.sh || H, W, H, o.fit, zoom, o.up || "net");
              ctx.filter = "none"; ctx.globalAlpha = 1;
            });
            if (grade) A.drawGradeOverlay(ctx, W, H, grade, frameNo);
            overlays.forEach(function (draw) { try { draw(ctx, now); } catch (e) { } });
            if (now - lastUi > 0.25) { lastUi = now; byId("mxProgress").style.width = Math.round(now / total * 100) + "%"; status("Assemblage : " + now.toFixed(1) + " / " + total.toFixed(1) + " s — gardez cet onglet visible"); }
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
      });
    }).then(function (res) {
      var ext = /mp4/.test(res.blob.type) ? "mp4" : "webm", url = URL.createObjectURL(res.blob), name = A.slugify(proj.name) + "_montage." + ext;
      byId("mxOut").innerHTML = '<video src="' + url + '" controls playsinline></video>' +
        '<div class="row-inline" style="margin-top:8px;"><a class="primary-btn" href="' + url + '" download="' + name + '">Télécharger le film (' + ext.toUpperCase() + ', ' + (res.blob.size / 1048576).toFixed(1) + ' Mo)</a></div>';
      status(state.stop ? "Assemblage arrêté — voici la partie rendue." : "Film assemblé (" + res.total.toFixed(1) + " s)" + (skipped ? " — " + skipped + " plan(s) ignoré(s) car indisponibles" : "") + ".");
      AgnesCore.emit("montage:done", { blob: res.blob });
    }).catch(function (e) {
      status(""); A.toast("Assemblage impossible : " + (e.message || e), "err");
    }).finally(function () {
      rendering = null; byId("mxRenderBtn").disabled = false; byId("mxStopBtn").style.display = "none";
      byId("mxProgress").style.width = "0%";
      var pv = byId("mxPreview"); pv.srcObject = null; pv.style.display = "none";
      setTimeout(function () { urls.forEach(URL.revokeObjectURL); }, 1000);
      audioCtx.close().catch(function () { });
    });
  }
  function status(t) { byId("mxStatus").textContent = t; }

  // =========================================================
  // EXPORT .ZIP
  // =========================================================
  function exportZip() {
    if (typeof JSZip === "undefined") { A.toast("Module ZIP indisponible — vérifiez la connexion internet et rechargez la page.", "err"); return; }
    var p = A.getProject(), shots = A.sortedShots(p), all = byId("exportAllTakes").checked;
    if (!shots.length) { A.toast("Aucun plan à exporter.", "err"); return; }
    var zip = new JSZip(), lines = [], missing = [], libName = {};
    p.library.forEach(function (l) { libName[l.id] = l.name; });
    function refName(id) { return id === A.PREV_REF ? "dernière image du plan précédent" : (libName[id] || ""); }
    var manifest = { name: p.name, styleGuide: p.styleGuide, negative: p.negative, seed: p.seed, aspect: p.aspect, resolution: p.resolution, exportedAt: new Date().toISOString(),
      grade: p.grade || null, audioBeds: (p.audioBeds || []).map(function (b) { return { name: b.name, type: b.type, volume: b.volume, loop: b.loop }; }), shots: [] };
    A.toast("Préparation du .zip…");
    var chain = Promise.resolve();
    shots.forEach(function (s, i) {
      var base = String(i + 1).padStart(2, "0") + "_" + A.slugify(s.prompt);
      var takes = all ? s.takes : (A.selectedTake(s) ? [A.selectedTake(s)] : []);
      manifest.shots.push({
        order: i + 1, mode: s.mode, modeLabel: A.MODES[s.mode].label, prompt: s.prompt, finalPrompt: A.buildPrompt(s, p),
        aspect: s.aspect, resolution: s.resolution, duration: A.modeKind(s.mode) === "video" ? s.duration : null, outputs: s.outputs, seed: s.seed,
        source: refName(s.sourceRef), start: refName(s.startRef), end: refName(s.endRef),
        ingredients: (s.ingredients || []).map(refName),
        skills: (s.skills || []).map(function (id) { var k = A.db.skills.find(function (x) { return x.id === id; }); return k ? k.title : id; }),
        status: s.status, takes: (s.takes || []).length,
        voice: s.voice && s.voice.key ? { text: s.voice.text || "", offset: s.voice.offset || 0, volume: s.voice.volume == null ? 1 : s.voice.volume } : null
      });
      lines.push((i + 1) + ". [" + A.MODES[s.mode].label + (A.modeKind(s.mode) === "video" ? " " + s.duration + " s" : "") + "] " + (s.prompt || "(sans description)"));
      takes.forEach(function (t, k) {
        chain = chain.then(function () {
          return A.getTakeBlobOrFetch(t).then(function (b) {
            var fname = base + (takes.length > 1 ? "_prise" + (k + 1) : "") + (t.kind === "video" ? ".mp4" : ".png");
            if (b) zip.file(fname, b); else missing.push(fname + " → " + (t.remoteUrl || "indisponible"));
          });
        });
      });
    });
    shots.forEach(function (s, i) {
      if (!s.voice || !s.voice.key) return;
      chain = chain.then(function () { return AgnesStore.getBlob(s.voice.key).then(function (b) {
        if (b) zip.file("voix/" + String(i + 1).padStart(2, "0") + "_" + A.slugify(s.prompt) + "." + A.audioExt(b), b);
      }); });
    });
    (p.audioBeds || []).forEach(function (b, k) {
      if (!b.key) return;
      chain = chain.then(function () { return AgnesStore.getBlob(b.key).then(function (bl) {
        if (bl) zip.file("musique/" + String(k + 1).padStart(2, "0") + "_" + A.slugify(b.name || "piste") + "." + A.audioExt(bl), bl);
      }); });
    });
    p.library.forEach(function (l) {
      chain = chain.then(function () { return A.getLibBlob(l).then(function (b) { if (b) zip.file("ingredients/" + A.slugify(l.name) + "_" + l.id.slice(-4) + ".png", b); }); });
    });
    chain.then(function () {
      if (missing.length) lines.push("", "Fichiers non récupérables (téléchargez-les via le lien) :", missing.join("\n"));
      zip.file("projet.json", JSON.stringify(manifest, null, 2));
      zip.file("montage.txt", lines.join("\n"));
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = A.slugify(p.name) + ".zip";
      document.body.appendChild(a); a.click(); a.remove(); A.toast("Export terminé.", "ok");
    }).catch(function (e) { A.toast("Échec de l'export : " + (e.message || e), "err"); });
  }

  A.initMontage = function () {
    ["mxAspect", "mxRes", "mxFps", "mxFit", "mxTrans", "mxStill", "mxAudio", "mxKen"].forEach(function (id) { byId(id).addEventListener("change", function () { saveOpts(); A.renderMontage(); }); });
    var list = byId("mxList");
    function onEdit(e) {
      var el = e.target, f = el.getAttribute("data-mf"); if (!f) return;
      var row = el.closest("[data-mx]"), c = itemCfg(A.getProject(), row.getAttribute("data-mx"));
      c[f] = el.type === "checkbox" ? el.checked : el.value; A.touch();
      if (f === "on") row.classList.toggle("off", !el.checked);
    }
    list.addEventListener("input", onEdit); list.addEventListener("change", onEdit);
    byId("mxRenderBtn").addEventListener("click", renderFilm);
    byId("mxStopBtn").addEventListener("click", function () { if (rendering) rendering.stop = true; });
    byId("exportZipBtn").addEventListener("click", exportZip);
  };
})();
