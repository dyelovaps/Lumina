// plugins/plugin-episodes.js — Enchaînement d'épisodes
// « Précédemment dans… » monté à partir des plans de l'épisode précédent (autre projet), carton d'ouverture,
// fin d'épisode (arrêt sur image + carton « À suivre »), et raccord : la dernière image de l'épisode
// précédent devient une référence de la bibliothèque pour démarrer celui-ci exactement là où l'autre s'arrête.
AgnesPlugins.register("episodes", {
  name: "Enchaînement d'épisodes",
  version: "1.0",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core;
    var cfg = core.pluginSettings("episodes", { recapDur: 2, recapPart: "end", style: "noir", endFreeze: true, freezeDur: 1.5, cardDur: 2.5 });
    this.cfg = cfg;

    var view = core.ui.addTab("episodes", "Épisodes",
      '<div class="card"><h3>Épisode précédent</h3>' +
      '<div class="row-inline"><select id="epPrev" style="min-width:260px"></select><span class="hint" id="epPrevInfo" style="margin:0"></span></div>' +
      '<div class="ext-cols" style="margin-top:10px">' +
      '<div class="field"><label>Série (pour les cartons)</label><input type="text" id="epSerie"></div>' +
      '<div class="field"><label>N° de cet épisode</label><input type="number" id="epNum" min="1" style="width:90px"></div>' +
      '<div class="field"><label>Style des cartons</label><select id="epStyle"><option value="noir">Cyber-noir</option><option value="drama">Drame (jaune)</option><option value="clean">Épuré (serif)</option></select></div></div></div>' +

      '<div class="card"><h3>« Précédemment dans… »</h3>' +
      '<p class="hint">Cochez les moments clés de l\'épisode précédent. Chaque extrait est coupé à la durée choisie et enchaîné en fondu, après un carton.</p>' +
      '<div class="row-inline"><label class="hint" style="margin:0">Durée par extrait <input type="number" id="epRecapDur" min="0.5" max="8" step="0.5" style="width:70px"> s</label>' +
      '<label class="hint" style="margin:0">Partie du plan <select id="epRecapPart"><option value="end">Fin</option><option value="start">Début</option><option value="middle">Milieu</option></select></label>' +
      '<button class="small-btn" id="epAutoPick">Sélection auto (3 derniers + dialogues)</button></div>' +
      '<div id="epShots" class="row-inline" style="margin-top:10px;align-items:flex-start"></div>' +
      '<div class="row-inline" style="margin-top:10px"><button class="primary-btn" id="epRecap">Insérer le récap au début</button></div></div>' +

      '<div class="card"><h3>Ouverture et fin</h3>' +
      '<div class="ext-cols"><div class="field"><label>Carton d\'ouverture</label><input type="text" id="epOpen" placeholder="Épisode 2 — Le contrat"></div>' +
      '<div class="field"><label>Carton de fin</label><input type="text" id="epEnd" value="À suivre…"></div>' +
      '<div class="field"><label>Sous-titre du carton de fin</label><input type="text" id="epEndSub" placeholder="Épisode 3 — demain 19h"></div></div>' +
      '<label class="hint"><input type="checkbox" id="epFreeze"> Arrêt sur image avant le carton de fin (<input type="number" id="epFreezeDur" min="0.5" max="5" step="0.5" style="width:60px"> s)</label>' +
      '<div class="row-inline" style="margin-top:10px"><button class="small-btn" id="epAddOpen">Insérer le carton d\'ouverture</button><button class="small-btn" id="epAddEnd">Insérer la fin d\'épisode</button>' +
      '<button class="small-btn" id="epClear">Retirer les plans ajoutés ici</button></div>' +
      '<canvas id="epPreview" class="ext-canvas" style="margin-top:10px;max-height:320px"></canvas></div>' +

      '<div class="card"><h3>Raccord avec l\'épisode précédent</h3>' +
      '<p class="hint">Copie la dernière image de l\'épisode précédent dans la bibliothèque, et (option) l\'utilise comme première image du premier plan de cet épisode.</p>' +
      '<label class="hint"><input type="checkbox" id="epLinkFirst" checked> Brancher sur le premier plan (mode Image → Vidéo)</label>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="epRaccord">Créer le raccord</button></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };
    this.$ = $; this.selected = null;

    function others() { var cur = core.getProject().id; return core.getAllProjects().filter(function (p) { return p.id !== cur; }); }
    function prevProject() {
      var p = core.getProject(), id = p.prevEpisodeId, list = others();
      var found = list.find(function (x) { return x.id === id; });
      if (!found && !id) {
        var n = (p.publish && p.publish.ep) || 0;
        found = list.find(function (x) { return x.publish && p.publish && x.publish.serie === p.publish.serie && x.publish.ep === n - 1; }) ||
          list.find(function (x) { return p.bibleSeriesId && x.bibleSeriesId === p.bibleSeriesId; }) || null;
      }
      return found || null;
    }
    this.prevProject = prevProject;
    function meta() {
      var p = core.getProject(); p.publish = p.publish || { serie: p.name, ep: 1, texts: {}, cover: {} };
      return p.publish;
    }
    function fill() {
      var prev = prevProject();
      $("epPrev").innerHTML = '<option value="">— choisir l\'épisode précédent —</option>' + others().map(function (p) {
        return '<option value="' + p.id + '"' + (prev && prev.id === p.id ? " selected" : "") + '>' + esc(p.name) + (p.publish && p.publish.ep ? " (ép. " + p.publish.ep + ")" : "") + '</option>';
      }).join("");
      $("epPrevInfo").textContent = prev ? core.sortedShotsOf(prev.id).filter(function (s) { return s.takes && s.takes.length; }).length + " plan(s) rendus" : "";
      var m = meta();
      $("epSerie").value = m.serie || ""; $("epNum").value = m.ep || 1; $("epStyle").value = cfg.style;
      $("epRecapDur").value = cfg.recapDur; $("epRecapPart").value = cfg.recapPart; $("epFreeze").checked = cfg.endFreeze; $("epFreezeDur").value = cfg.freezeDur;
      if (!$("epOpen").value) $("epOpen").value = "Épisode " + (m.ep || 1) + (m.titre ? " — " + m.titre : "");
      if (!$("epEndSub").value) $("epEndSub").value = "Épisode " + ((m.ep || 1) + 1);
      renderShots(); preview();
    }
    function renderShots() {
      var prev = prevProject();
      if (!prev) { $("epShots").innerHTML = '<p class="hint">Choisissez l\'épisode précédent.</p>'; return; }
      var shots = core.sortedShotsOf(prev.id).filter(function (s) { return s.takes && s.takes.length && !s.media; });
      if (!self.selected || self.selected.prev !== prev.id) self.selected = { prev: prev.id, ids: self.autoPick(shots) };
      $("epShots").innerHTML = shots.map(function (s, i) {
        var t = App.selectedTake(s), on = self.selected.ids.indexOf(s.id) !== -1;
        return '<label style="width:120px;cursor:pointer;display:flex;flex-direction:column;gap:4px;opacity:' + (on ? 1 : .55) + '"><img class="ext-thumb" style="width:120px;height:68px" src="' + (t && t.thumb || "") + '" alt="Plan ' + (i + 1) + '">' +
          '<span class="hint" style="margin:0"><input type="checkbox" data-ep="' + s.id + '"' + (on ? " checked" : "") + '> #' + (i + 1) + (s.voice ? " 🎙" : "") + '</span></label>';
      }).join("") || '<p class="hint">Aucun plan rendu dans cet épisode.</p>';
    }
    function preview() {
      var W = 640, H = core.getProject().aspect === "9:16" ? 1138 : 360;
      self.drawCard($("epPreview"), W, H, [$("epEnd").value || "À suivre…"], $("epEndSub").value, $("epStyle").value);
    }
    view.addEventListener("change", function (e) {
      var id = e.target.id;
      if (e.target.hasAttribute("data-ep")) {
        var sid = e.target.getAttribute("data-ep"), ids = self.selected.ids, i = ids.indexOf(sid);
        if (e.target.checked && i === -1) ids.push(sid); if (!e.target.checked && i !== -1) ids.splice(i, 1);
        return renderShots();
      }
      if (id === "epPrev") { core.getProject().prevEpisodeId = e.target.value || null; core.saveProject(); self.selected = null; return fill(); }
      if (id === "epSerie" || id === "epNum") { var m = meta(); m.serie = $("epSerie").value.trim(); m.ep = Math.max(1, parseInt($("epNum").value, 10) || 1); core.saveProject(); }
      cfg.style = $("epStyle").value; cfg.recapDur = App.clamp($("epRecapDur").value, 0.5, 8); cfg.recapPart = $("epRecapPart").value;
      cfg.endFreeze = $("epFreeze").checked; cfg.freezeDur = App.clamp($("epFreezeDur").value, 0.5, 5); cfg.save(); preview();
    });
    ["epEnd", "epEndSub"].forEach(function (id) { $(id).addEventListener("input", preview); });
    $("epAutoPick").addEventListener("click", function () { self.selected = null; renderShots(); });
    $("epRecap").addEventListener("click", function () { self.insertRecap(); });
    $("epAddOpen").addEventListener("click", function () { self.insertOpening(); });
    $("epAddEnd").addEventListener("click", function () { self.insertEnding(); });
    $("epRaccord").addEventListener("click", function () { self.raccord(); });
    $("epClear").addEventListener("click", function () {
      var ids = core.getShots().filter(function (s) { return s.media === "récap" || s.media === "carton" || s.media === "arrêt sur image"; });
      if (!ids.length) return core.toast("Aucun plan ajouté par cette extension.");
      if (!window.confirm("Retirer " + ids.length + " plan(s) (récap, cartons, arrêt sur image) ?")) return;
      ids.forEach(function (s) { App.deleteShot(s, core.getProject()); }); core.saveProject(); App.render(); core.toast("Plans retirés.", "ok");
    });
    this.fill = fill;
    core.on("view:change", function (v) { if (v === "view_episodes") fill(); });
    core.on("project:change", function () { self.selected = null; if (view.classList.contains("active")) fill(); });
  },

  autoPick: function (shots) {
    var ids = shots.slice(-3).map(function (s) { return s.id; });
    shots.forEach(function (s) { if (s.voice && s.voice.key && ids.length < 5 && ids.indexOf(s.id) === -1) ids.unshift(s.id); });
    return shots.filter(function (s) { return ids.indexOf(s.id) !== -1; }).map(function (s) { return s.id; });
  },

  cardSize: function () { return window.AgnesApp.computeSize(this.core.getProject().aspect, "1080p"); },
  drawCard: function (cv, W, H, lines, sub, style) {
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d"), u = Math.min(W, H);
    ctx.fillStyle = "#050506"; ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, style === "drama" ? "rgba(60,40,0,.35)" : "rgba(30,40,55,.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var st = { noir: ["700 {s}px 'Space Grotesk', Arial, sans-serif", "#f2f2f2", true, "#d9262c"], drama: ["900 {s}px Impact, 'Arial Black', sans-serif", "#ffd400", true, null], clean: ["500 italic {s}px Fraunces, Georgia, serif", "#ffffff", false, null] }[style] || null;
    st = st || ["700 {s}px Arial", "#fff", true, null];
    var size = Math.round(u * 0.085), text = lines.filter(Boolean).join(" ");
    if (st[2]) text = text.toUpperCase();
    ctx.font = st[0].replace("{s}", size);
    var words = text.split(/\s+/), rows = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > W * 0.8 && cur) { rows.push(cur); cur = w; } else cur = t; });
    if (cur) rows.push(cur);
    var lh = size * 1.12, subSize = Math.round(size * 0.42), block = rows.length * lh + (sub ? subSize * 2 : 0), y = (H - block) / 2;
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = st[1];
    if (style === "drama") { ctx.lineWidth = size * 0.1; ctx.strokeStyle = "#000"; ctx.lineJoin = "round"; }
    rows.forEach(function (r, i) { if (style === "drama") ctx.strokeText(r, W / 2, y + i * lh); ctx.fillText(r, W / 2, y + i * lh); });
    y += rows.length * lh;
    if (st[3]) { ctx.fillStyle = st[3]; ctx.fillRect(W / 2 - size, y + size * 0.1, size * 2, Math.max(3, size * 0.07)); }
    if (sub) { ctx.font = "600 " + subSize + "px 'Space Grotesk', Arial, sans-serif"; ctx.fillStyle = "#b8bec5"; ctx.fillText(sub.toUpperCase(), W / 2, y + subSize * 0.9); }
  },
  cardBlob: function (lines, sub, style) {
    var sz = this.cardSize(), cv = document.createElement("canvas");
    this.drawCard(cv, sz.w, sz.h, lines, sub, style);
    return window.AgnesApp.canvasToBlob(cv, "image/png");
  },
  videoDur: function (blob) {
    return new Promise(function (res) {
      var v = document.createElement("video"), u = URL.createObjectURL(blob); v.preload = "metadata";
      v.onloadedmetadata = function () {
        if (isFinite(v.duration)) { URL.revokeObjectURL(u); return res(v.duration); }
        v.ontimeupdate = function () { v.ontimeupdate = null; URL.revokeObjectURL(u); res(isFinite(v.duration) ? v.duration : 5); }; v.currentTime = 1e6;
      };
      v.onerror = function () { URL.revokeObjectURL(u); res(5); }; v.src = u;
    });
  },

  insertRecap: function () {
    var self = this, core = this.core, App = window.AgnesApp, cfg = this.cfg, prev = this.prevProject();
    if (!prev || !this.selected || !this.selected.ids.length) return core.toast("Choisissez l'épisode précédent et au moins un plan.", "err");
    var m = core.getProject().publish || {}, serie = this.$("epSerie").value.trim() || m.serie || prev.name;
    var shots = core.sortedShotsOf(prev.id).filter(function (s) { return self.selected.ids.indexOf(s.id) !== -1; });
    var pos = 0, D = cfg.recapDur, n = 0;
    core.toast("Montage du récap…");
    var chain = this.cardBlob(["Précédemment dans " + serie + "…"], "", cfg.style).then(function (b) {
      return core.addMediaShot(b, "image", { position: pos++, prompt: "[Carton] Précédemment dans " + serie, label: "récap", still: 1.8, trans: "fade", tdur: 0.4 });
    });
    shots.forEach(function (s) {
      chain = chain.then(function () {
        var t = App.selectedTake(s);
        return core.getTakeBlobOrFetch(t).then(function (b) {
          if (!b) return;
          var opts = { position: pos++, prompt: "[Récap] " + (s.prompt || ""), label: "récap", trans: "fade", tdur: 0.35, still: D };
          if (t.kind !== "video") return core.addMediaShot(b, "image", opts).then(function () { n++; });
          return self.videoDur(b).then(function (d) {
            var len = Math.min(D, d), tin = cfg.recapPart === "start" ? 0 : cfg.recapPart === "middle" ? Math.max(0, (d - len) / 2) : Math.max(0, d - len);
            opts.tin = +tin.toFixed(2); opts.tout = +(tin + len).toFixed(2); opts.duration = Math.round(d);
            return core.addMediaShot(b, "video", opts).then(function () { n++; });
          });
        });
      });
    });
    chain.then(function () {
      // coupe franche après le récap
      var list = core.getShots(), last = list[pos - 1];
      if (last) { var mi = core.getProject().montage.items[last.id]; if (mi) mi.trans = "black"; core.saveProject(); }
      core.toast("Récap inséré : carton + " + n + " extrait(s). Réglez-le dans l'Assemblage.", "ok");
    }).catch(function (e) { core.toast("Récap : " + e.message, "err"); });
  },
  insertOpening: function () {
    var core = this.core, cfg = this.cfg, txt = this.$("epOpen").value.trim(), serie = this.$("epSerie").value.trim();
    if (!txt && !serie) return core.toast("Écrivez le texte du carton.", "err");
    var pos = core.getShots().filter(function (s) { return s.media === "récap"; }).length;
    this.cardBlob([serie], txt, cfg.style).then(function (b) {
      return core.addMediaShot(b, "image", { position: pos, prompt: "[Carton] " + (serie + " " + txt).trim(), label: "carton", still: cfg.cardDur, trans: "black", tdur: 0.8 });
    }).then(function () { core.toast("Carton d'ouverture inséré.", "ok"); });
  },
  insertEnding: function () {
    var self = this, core = this.core, App = window.AgnesApp, cfg = this.cfg;
    var shots = core.getShots().filter(function (s) { return s.takes && s.takes.length && !s.media; });
    var chain = Promise.resolve(), last = shots[shots.length - 1];
    if (cfg.endFreeze && last) {
      chain = chain.then(function () {
        var t = App.selectedTake(last);
        return core.getTakeBlobOrFetch(t).then(function (b) {
          if (!b) return;
          var fp = t.kind === "video" ? (function () { var u = URL.createObjectURL(b); return App.videoFrame(u, "last", 1920).then(function (f) { URL.revokeObjectURL(u); return f; }); })() : Promise.resolve(b);
          return fp.then(function (frame) {
            var mi = core.getProject().montage.items[last.id]; if (mi) mi.trans = "cut";
            return core.addMediaShot(frame, "image", { position: "end", prompt: "[Arrêt sur image] " + (last.prompt || ""), label: "arrêt sur image", still: cfg.freezeDur, trans: "black", tdur: 0.8 });
          });
        });
      });
    }
    chain.then(function () { return self.cardBlob([self.$("epEnd").value || "À suivre…"], self.$("epEndSub").value, cfg.style); })
      .then(function (b) { return core.addMediaShot(b, "image", { position: "end", prompt: "[Carton] " + (self.$("epEnd").value || "À suivre…"), label: "carton", still: cfg.cardDur }); })
      .then(function () {
        core.toast("Fin d'épisode insérée" + (cfg.endFreeze && last ? " (arrêt sur image + carton)." : "."), "ok");
      }).catch(function (e) { core.toast("Fin d'épisode : " + e.message, "err"); });
  },
  raccord: function () {
    var self = this, core = this.core, App = window.AgnesApp, prev = this.prevProject();
    if (!prev) return core.toast("Choisissez l'épisode précédent.", "err");
    var shots = core.sortedShotsOf(prev.id).filter(function (s) { return s.takes && s.takes.length && !s.media; }), last = shots[shots.length - 1];
    if (!last) return core.toast("L'épisode précédent n'a aucun plan rendu.", "err");
    var t = App.selectedTake(last), m = prev.publish || {};
    core.getTakeBlobOrFetch(t).then(function (b) {
      if (!b) throw new Error("rendu indisponible");
      if (t.kind !== "video") return b;
      var u = URL.createObjectURL(b); return App.videoFrame(u, "last", 2048).then(function (f) { URL.revokeObjectURL(u); return f; });
    }).then(function (frame) {
      return core.addToLibrary(frame, { name: "Fin ép. " + (m.ep || prev.name), kind: "decor" });
    }).then(function (item) {
      if (self.$("epLinkFirst").checked) {
        var first = core.getShots().find(function (s) { return !s.media; });
        if (first) {
          var patch = App.modeKind(first.mode) === "video" ? { mode: first.mode === "frames" ? "frames" : "i2v" } : { mode: "i2i" };
          if (patch.mode === "frames") patch.startRef = item.id; else patch.sourceRef = item.id;
          core.updateShot(first.id, patch);
        }
      }
      core.toast("Raccord créé : « " + item.name + " » ajouté à la bibliothèque" + (self.$("epLinkFirst").checked ? " et branché sur le premier plan." : "."), "ok");
    }).catch(function (e) { core.toast("Raccord : " + e.message, "err"); });
  }
});
