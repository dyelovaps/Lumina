// plugins/plugin-grade.js — Étalonnage & finition de l'image
// Un « look » commun appliqué à tous les plans du film pour gommer les écarts de couleur entre générations :
// préréglages (cyber-noir, réalisme brut, drame chaud…), réglages fins, grain, vignette, netteté, LUT .cube.
// Appliqué par l'Assemblage (aperçu fidèle, hors netteté et LUT) et par le kit FFmpeg (qualité finale,
// agrandissement Lanczos). Un plan peut être exclu (ex. un carton).
AgnesPlugins.register("etalonnage", {
  name: "Étalonnage",
  version: "1.0",
  FIELDS: [
    ["contrast", "Contraste", 0.5, 1.6, 0.01, 1], ["saturation", "Saturation", 0, 1.8, 0.01, 1], ["brightness", "Luminosité", 0.6, 1.4, 0.01, 1],
    ["temperature", "Température (froid ↔ chaud)", -1, 1, 0.01, 0], ["sepia", "Sépia", 0, 1, 0.01, 0], ["vignette", "Vignettage", 0, 1, 0.01, 0],
    ["grain", "Grain", 0, 1, 0.01, 0], ["sharpen", "Netteté (kit FFmpeg)", 0, 1, 0.01, 0]
  ],
  PRESETS: {
    neutre: ["Neutre", {}],
    brut: ["Réalisme brut", { contrast: 1.05, saturation: 0.9, brightness: 1, temperature: 0, vignette: 0.15, grain: 0.22, sharpen: 0.25 }],
    noir: ["Cyber-noir", { contrast: 1.25, saturation: 0.75, brightness: 0.92, temperature: -0.45, vignette: 0.55, grain: 0.15, sharpen: 0.3 }],
    chaud: ["Drame chaud", { contrast: 1.1, saturation: 1.05, brightness: 1, temperature: 0.4, vignette: 0.35, grain: 0.1 }],
    nuit: ["Nuit bleue", { contrast: 1.15, saturation: 0.7, brightness: 0.85, temperature: -0.7, vignette: 0.5, grain: 0.12 }],
    bleach: ["Sans blanchiment (bleach bypass)", { contrast: 1.35, saturation: 0.45, brightness: 0.97, temperature: -0.05, vignette: 0.3, grain: 0.2 }],
    vintage: ["Vintage 70", { contrast: 0.92, saturation: 0.8, brightness: 1.03, temperature: 0.35, sepia: 0.25, vignette: 0.45, grain: 0.45 }],
    nb: ["Noir & blanc", { contrast: 1.3, saturation: 0, brightness: 0.95, vignette: 0.5, grain: 0.3 }],
    anim: ["Animation vive (3D)", { contrast: 1.08, saturation: 1.3, brightness: 1.05, temperature: 0.1, sharpen: 0.2 }]
  },

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.img = null; this.split = 50;
    var presetOpts = Object.keys(this.PRESETS).map(function (k) { return [k, self.PRESETS[k][0]]; });

    var view = core.ui.addTab("etalonnage", "Étalonnage",
      '<div class="ext-cols"><div class="card"><h3>Look du film</h3>' +
      '<label class="hint" style="display:block;margin-bottom:10px"><input type="checkbox" id="grOn"> Appliquer l\'étalonnage à l\'Assemblage et au kit FFmpeg</label>' +
      '<div class="field"><label>Préréglage</label><select id="grPreset">' + App.optionsHtml(presetOpts, "") + '</select></div>' +
      '<div id="grSliders"></div>' +
      '<div class="field"><label>LUT .cube (appliquée par le kit FFmpeg)</label><div class="row-inline"><label class="small-btn" style="cursor:pointer">Importer une LUT<input type="file" id="grLut" accept=".cube" hidden></label><span id="grLutName" class="hint" style="margin:0"></span><button class="small-btn" id="grLutDel" style="display:none">Retirer</button></div></div>' +
      '<p class="hint">Agrandissement : le kit FFmpeg redimensionne en Lanczos à la résolution de l\'Assemblage (jusqu\'en 4K) avec la netteté réglée ici. Pour un vrai agrandissement par IA, passez le film final dans un outil dédié (Topaz Video, Real-ESRGAN).</p>' +
      '</div>' +
      '<div class="card"><h3>Aperçu avant / après</h3>' +
      '<div class="field"><label>Image</label><select id="grSrc"></select></div>' +
      '<canvas id="grCanvas" class="ext-canvas"></canvas>' +
      '<label class="hint" style="display:block;margin-top:6px">Séparation <input type="range" id="grSplit" min="0" max="100" value="50" style="width:60%"></label>' +
      '<p class="hint">Gauche : original. Droite : étalonné (sans la netteté ni la LUT, visibles seulement dans le kit).</p></div></div>' +
      '<div class="card"><h3>Plans exclus de l\'étalonnage</h3><div id="grSkip" class="row-inline"></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };

    function g() {
      var p = core.getProject();
      if (!p.grade) p.grade = Object.assign({ on: false, preset: "neutre", skip: [] }, self.values("neutre"));
      if (!p.grade.skip) p.grade.skip = [];
      return p.grade;
    }
    this.g = g;
    function renderSliders() {
      var gr = g();
      $("grSliders").innerHTML = self.FIELDS.map(function (f) {
        var v = gr[f[0]] == null ? f[5] : gr[f[0]];
        return '<div class="field" style="margin-bottom:6px"><label>' + f[1] + ' <span class="ext-tag" data-val="' + f[0] + '">' + (+v).toFixed(2) + '</span></label>' +
          '<input type="range" data-gr="' + f[0] + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + v + '" style="width:100%"></div>';
      }).join("");
    }
    function fill() {
      var gr = g();
      $("grOn").checked = !!gr.on; $("grPreset").value = gr.preset || "neutre";
      $("grLutName").textContent = gr.lutKey ? (gr.lutName || "LUT importée") : "aucune"; $("grLutDel").style.display = gr.lutKey ? "" : "none";
      renderSliders(); renderSkip(); fillSources();
    }
    function renderSkip() {
      var gr = g(), shots = core.getShots();
      $("grSkip").innerHTML = shots.length ? shots.map(function (s, i) {
        return '<label class="hint" style="margin:0 10px 6px 0"><input type="checkbox" data-skip="' + s.id + '"' + (gr.skip.indexOf(s.id) !== -1 ? " checked" : "") + '> #' + (i + 1) + ' ' + esc((s.prompt || "").slice(0, 26)) + '</label>';
      }).join("") : '<p class="hint">Aucun plan.</p>';
    }
    function fillSources() {
      var opts = core.getShots().map(function (s, i) { var t = core.getSelectedTake(s); return t ? [s.id, "Plan #" + (i + 1) + " — " + (s.prompt || "").slice(0, 36)] : null; }).filter(Boolean);
      var cur = $("grSrc").value;
      $("grSrc").innerHTML = opts.length ? App.optionsHtml(opts, cur || opts[0][0]) : '<option value="">Aucun rendu disponible</option>';
      loadImage();
    }
    function loadImage() {
      var s = core.getShot($("grSrc").value), t = s && core.getSelectedTake(s); self.img = null;
      if (!t) return draw();
      core.getTakeBlobOrFetch(t).then(function (b) {
        if (!b) throw new Error("rendu indisponible");
        var u = URL.createObjectURL(b);
        var p = t.kind === "video" ? App.videoFrame(u, 0.5, 1280).then(function (f) { URL.revokeObjectURL(u); return URL.createObjectURL(f); }) : Promise.resolve(u);
        return p.then(App.loadImage);
      }).then(function (img) { self.img = img; draw(); }).catch(function () { draw(); });
    }
    function draw() { self.drawPreview($("grCanvas"), self.img, g(), self.split); }

    view.addEventListener("input", function (e) {
      var f = e.target.getAttribute("data-gr");
      if (f) { var gr = g(); gr[f] = Number(e.target.value); gr.preset = "perso"; $("grPreset").value = ""; var tag = view.querySelector('[data-val="' + f + '"]'); if (tag) tag.textContent = gr[f].toFixed(2); core.saveProject(); draw(); }
      if (e.target.id === "grSplit") { self.split = Number(e.target.value); draw(); }
    });
    view.addEventListener("change", function (e) {
      var gr = g();
      if (e.target.id === "grOn") { gr.on = e.target.checked; core.saveProject(); core.toast(gr.on ? "Étalonnage activé pour ce projet." : "Étalonnage désactivé."); }
      if (e.target.id === "grPreset" && e.target.value) { Object.assign(gr, self.values(e.target.value), { preset: e.target.value }); if (!gr.on) { gr.on = true; $("grOn").checked = true; } core.saveProject(); renderSliders(); draw(); }
      if (e.target.id === "grSrc") loadImage();
      var sk = e.target.getAttribute("data-skip");
      if (sk) { var i = gr.skip.indexOf(sk); if (e.target.checked && i === -1) gr.skip.push(sk); if (!e.target.checked && i !== -1) gr.skip.splice(i, 1); core.saveProject(); }
      if (e.target.id === "grLut") {
        var file = e.target.files[0]; e.target.value = ""; if (!file) return;
        file.text().then(function (t) {
          if (!/LUT_3D_SIZE/i.test(t)) throw new Error("ce fichier n'est pas une LUT 3D .cube");
          var key = "grade:lut:" + App.uid(), old = gr.lutKey;
          return core.store.put(key, new Blob([t], { type: "text/plain" })).then(function () {
            gr.lutKey = key; gr.lutName = file.name; gr.on = true; core.saveProject(); if (old) core.store.del(old); fill();
            core.toast("LUT importée : elle sera appliquée par le kit FFmpeg.", "ok");
          });
        }).catch(function (err) { core.toast("LUT : " + err.message, "err"); });
      }
    });
    $("grLutDel").addEventListener("click", function () { var gr = g(); if (gr.lutKey) core.store.del(gr.lutKey); delete gr.lutKey; delete gr.lutName; core.saveProject(); fill(); });
    core.on("view:change", function (v) { if (v === "view_etalonnage") fill(); });
    core.on("project:change", function () { if (view.classList.contains("active")) fill(); });
  },

  values: function (key) {
    var base = {}; this.FIELDS.forEach(function (f) { base[f[0]] = f[5]; });
    return Object.assign(base, (this.PRESETS[key] || this.PRESETS.neutre)[1]);
  },
  drawPreview: function (cv, img, g, split) {
    var App = window.AgnesApp, W = 960, H = img ? Math.round(W * (img.naturalHeight / img.naturalWidth)) : 540;
    if (H > 1200) { H = 1200; W = Math.round(H * img.naturalWidth / img.naturalHeight); }
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (!img) { ctx.fillStyle = "#666"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("Générez un plan pour voir l'aperçu", W / 2, H / 2); return; }
    ctx.drawImage(img, 0, 0, W, H);
    var x = Math.round(W * split / 100);
    ctx.save(); ctx.beginPath(); ctx.rect(x, 0, W - x, H); ctx.clip();
    var css = App.gradeCss(g); if (css !== "none") ctx.filter = css;
    ctx.drawImage(img, 0, 0, W, H); ctx.filter = "none";
    App.drawGradeOverlay(ctx, W, H, g, 1);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(x - 1, 0, 2, H);
    ctx.font = "600 13px sans-serif"; ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
    ctx.fillText("AVANT", 10, 10); ctx.textAlign = "right"; ctx.fillText("APRÈS", W - 10, 10);
  }
});
