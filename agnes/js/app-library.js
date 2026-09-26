// js/app-library.js — bibliothèque d'ingrédients : image → ingrédient, vidéo → ingrédient, recadrage
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId, esc = A.esc;
  var libFilter = "all";
  var KIND_LABEL = {}; A.LIB_KINDS.forEach(function (k) { KIND_LABEL[k[0]] = k[1]; });

  // =========================================================
  // RECADRAGE
  // =========================================================
  var crop = { img: null, blob: null, rect: null, scale: 1, drag: null };
  function drawCrop() {
    var c = byId("cropCanvas"), ctx = c.getContext("2d"), img = crop.img; if (!img) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var r = crop.rect;
    if (r && r.w > 4 && r.h > 4) {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, c.width, r.y); ctx.fillRect(0, r.y + r.h, c.width, c.height - r.y - r.h);
      ctx.fillRect(0, r.y, r.x, r.h); ctx.fillRect(r.x + r.w, r.y, c.width - r.x - r.w, r.h);
      ctx.strokeStyle = "#c7ccd2"; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
  }
  function loadIntoCropper(blob) {
    var u = URL.createObjectURL(blob);
    return A.loadImage(u).then(function (img) {
      crop.img = img; crop.blob = blob; crop.rect = null;
      var c = byId("cropCanvas"), maxW = Math.min(720, byId("cropStage").clientWidth || 720);
      crop.scale = Math.min(1, maxW / img.naturalWidth);
      c.width = Math.round(img.naturalWidth * crop.scale); c.height = Math.round(img.naturalHeight * crop.scale);
      byId("cropStage").classList.add("open"); drawCrop();
    });
  }
  function canvasPoint(e) {
    var c = byId("cropCanvas"), r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function initCropper() {
    var c = byId("cropCanvas");
    c.addEventListener("pointerdown", function (e) { if (!crop.img) return; c.setPointerCapture(e.pointerId); crop.drag = canvasPoint(e); crop.rect = null; });
    c.addEventListener("pointermove", function (e) {
      if (!crop.drag) return; var p = canvasPoint(e), d = crop.drag;
      crop.rect = { x: Math.max(0, Math.min(d.x, p.x)), y: Math.max(0, Math.min(d.y, p.y)), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) };
      drawCrop();
    });
    c.addEventListener("pointerup", function () { crop.drag = null; });
    byId("cropResetBtn").addEventListener("click", function () { crop.rect = null; drawCrop(); });
  }
  function croppedBlob() {
    var r = crop.rect;
    if (!r || r.w < 8 || r.h < 8) return Promise.resolve(crop.blob);
    var s = 1 / crop.scale, c = document.createElement("canvas");
    c.width = Math.round(r.w * s); c.height = Math.round(r.h * s);
    c.getContext("2d").drawImage(crop.img, r.x * s, r.y * s, r.w * s, r.h * s, 0, 0, c.width, c.height);
    return A.canvasToBlob(c, "image/png");
  }

  // =========================================================
  // IMPORT (image ou vidéo)
  // =========================================================
  var grabUrl = null;
  function resetImport() {
    byId("libFile").value = ""; byId("libName").value = ""; byId("libSeed").value = ""; byId("libUrl").value = ""; byId("libSheet").checked = false;
    byId("videoStage").classList.remove("open"); byId("cropStage").classList.remove("open");
    if (grabUrl) { URL.revokeObjectURL(grabUrl); grabUrl = null; }
    byId("grabVideo").removeAttribute("src");
    crop.img = null; crop.blob = null; crop.rect = null;
  }
  function grab(at) {
    if (!grabUrl) return;
    var v = byId("grabVideo"), t = at === "now" ? v.currentTime : at;
    A.videoFrame(grabUrl, t).then(loadIntoCropper).then(function () { A.toast("Image capturée — recadrez si besoin, puis ajoutez-la.", "ok"); })
      .catch(function (e) { A.toast("Capture impossible : " + e.message, "err"); });
  }
  function initImport() {
    byId("libKind").innerHTML = A.optionsHtml(A.LIB_KINDS, "personnage");
    byId("libFile").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (!byId("libName").value) byId("libName").value = f.name.replace(/\.[^.]+$/, "");
      byId("cropStage").classList.remove("open");
      if (f.type.indexOf("video") === 0) {
        if (grabUrl) URL.revokeObjectURL(grabUrl);
        grabUrl = URL.createObjectURL(f);
        byId("grabVideo").src = grabUrl; byId("videoStage").classList.add("open");
      } else {
        byId("videoStage").classList.remove("open");
        loadIntoCropper(f).catch(function (e) { A.toast(e.message, "err"); });
      }
    });
    byId("grabFirstBtn").addEventListener("click", function () { grab("first"); });
    byId("grabLastBtn").addEventListener("click", function () { grab("last"); });
    byId("grabNowBtn").addEventListener("click", function () { grab("now"); });
    byId("libAddBtn").addEventListener("click", function () {
      if (!crop.blob) { A.toast(grabUrl ? "Capturez d'abord une image de la vidéo." : "Choisissez une image ou une vidéo.", "err"); return; }
      var proj = A.getProject(), kind = byId("libKind").value;
      var name = byId("libName").value.trim() || (KIND_LABEL[kind] + " " + (proj.library.length + 1));
      var sheet = byId("libSheet").checked, url = byId("libUrl").value.trim();
      croppedBlob().then(function (blob) {
        return A.addLibraryItem(blob, { name: name, kind: kind, seed: byId("libSeed").value.trim(), publicUrl: /^https?:/i.test(url) ? url : "" }, proj);
      }).then(function (item) {
        A.toast("« " + item.name + " » ajouté à la bibliothèque.", "ok");
        if (sheet) createSheetShot(item, proj);
        resetImport(); A.renderLibrary();
      }).catch(function (e) { A.toast("Échec de l'ajout : " + (e.message || e), "err"); });
    });
  }

  // Image → fiche ingrédient IA : un plan Image → Image dont le résultat rejoint la bibliothèque
  function createSheetShot(item, proj) {
    var sheetSkill = A.db.skills.find(function (s) { return s.id === "b-sheet"; });
    var shot = A.addShot({
      mode: "i2i", sourceRef: item.id, aspect: "16:9", outputs: 1,
      prompt: "Planche de référence de " + item.name + (sheetSkill ? "" : ", character reference sheet, front view, side profile and back view, neutral background"),
      skills: sheetSkill ? [sheetSkill.id] : [], toLibrary: { name: item.name + " — fiche", kind: item.kind }
    }, proj);
    A.enqueueMany([shot], proj);
    A.toast("Fiche personnage en cours de génération (plan #" + A.sortedShots(proj).length + ").", "ok");
  }

  // =========================================================
  // GRILLE
  // =========================================================
  A.renderLibrary = function () {
    var proj = A.getProject(), items = proj.library;
    var kinds = {}; items.forEach(function (l) { kinds[l.kind] = (kinds[l.kind] || 0) + 1; });
    byId("libFilter").innerHTML = [["all", "Tout (" + items.length + ")"]].concat(Object.keys(kinds).map(function (k) { return [k, (KIND_LABEL[k] || k) + " (" + kinds[k] + ")"]; }))
      .map(function (k) { return '<button class="chip' + (libFilter === k[0] ? " on" : "") + '" data-filter="' + k[0] + '">' + esc(k[1]) + '</button>'; }).join("");
    var shown = items.filter(function (l) { return libFilter === "all" || l.kind === libFilter; });
    byId("libEmpty").style.display = items.length ? "none" : "block";
    byId("libGrid").innerHTML = shown.map(function (l) {
      return '<div class="lib-card" data-lib="' + l.id + '">' +
        '<div class="lib-thumb" data-libact="view" style="cursor:zoom-in;">' + (l.thumb ? '<img src="' + l.thumb + '" alt="' + esc(l.name) + '">' : '') + '</div>' +
        '<div class="lib-name">' + esc(l.name) + '</div>' +
        '<div class="lib-kind">' + esc(KIND_LABEL[l.kind] || l.kind) + (l.seed ? ", seed " + esc(l.seed) : "") +
        (l.publicUrl ? ' <span class="badge-ok" title="Image en ligne, prête pour l\'API">● en ligne</span>' : "") +
        (l.missing ? ' <span style="color:var(--warn);">à réimporter</span>' : "") + '</div>' +
        '<div class="lib-actions">' +
        '<button class="small-btn" data-libact="i2v">→ Vidéo</button>' +
        '<button class="small-btn" data-libact="i2i">→ Image</button>' +
        '<button class="small-btn" data-libact="sheet" title="Générer une fiche face / profil / dos">Fiche IA</button>' +
        '<button class="small-btn" data-libact="rename">Renommer</button>' +
        '<button class="small-btn" data-libact="del">Retirer</button></div></div>';
    }).join("");
  };
  function initGrid() {
    byId("libFilter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]"); if (!b) return; libFilter = b.getAttribute("data-filter"); A.renderLibrary();
    });
    byId("libGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-libact]"); if (!b) return;
      var proj = A.getProject(), id = b.closest("[data-lib]").getAttribute("data-lib");
      var item = proj.library.find(function (l) { return l.id === id; }); if (!item) return;
      var act = b.getAttribute("data-libact");
      if (act === "view") {
        A.getLibSrc(item).then(function (src) {
          if (!src) return;
          byId("lightboxBody").innerHTML = '<img src="' + esc(src) + '" alt="">'; byId("lightbox").classList.add("open");
        });
      } else if (act === "i2v" || act === "i2i") {
        A.addShot({ mode: act, sourceRef: item.id, prompt: "" }, proj);
        A.showView("viewStoryboard"); A.toast("Plan créé à partir de « " + item.name + " » — décrivez l'action puis générez.", "ok");
        var last = byId("shotList").lastElementChild; if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (act === "sheet") {
        createSheetShot(item, proj);
      } else if (act === "rename") {
        var n = window.prompt("Nouveau nom :", item.name); if (n && n.trim()) { item.name = n.trim(); A.touch(); A.render(); }
      } else if (act === "del") {
        if (!window.confirm('Retirer « ' + item.name + ' » de la bibliothèque ?')) return;
        proj.library = proj.library.filter(function (l) { return l.id !== id; });
        var stillUsed = Object.keys(A.db.projects).some(function (pid) { return A.db.projects[pid].library.some(function (l) { return l.id === id; }); });
        if (!stillUsed) { AgnesStore.delBlob("lib:" + id); A.forgetUrl("lib:" + id); }
        proj.shots.forEach(function (s) {
          ["sourceRef", "startRef", "endRef"].forEach(function (f) { if (s[f] === id) s[f] = ""; });
          s.ingredients = (s.ingredients || []).filter(function (x) { return x !== id; });
        });
        A.touch(); A.render();
      }
    });
  }

  // Listes déroulantes qui dépendent de la bibliothèque / des skills (onglets Lot et Skills)
  A.refreshPickers = function () {
    var proj = A.getProject();
    var src = byId("s2cSource"), cur = src.value;
    src.innerHTML = '<option value="">(aucune)</option>' + proj.library.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join("");
    src.value = cur;
    var bs = byId("batchSkill"), bcur = bs.value; bs.innerHTML = A.skillOptionsHtml("both", "(aucun)"); bs.value = bcur;
    var ss = byId("selSkill"), scur = ss.value; ss.innerHTML = A.skillOptionsHtml("both", "Skill — aucun ajout"); ss.value = scur;
  };

  A.initLibrary = function () { initCropper(); initImport(); initGrid(); };
})();
