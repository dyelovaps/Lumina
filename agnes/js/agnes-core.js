// js/agnes-core.js — API publique pour les plugins.
// L'application (js/app-*.js) branche ses fonctions ici au démarrage via AgnesCore._bind(app).
window.AgnesCore = {
  version: "3.2",
  _promptFilters: [],
  _app: null,
  _shotActions: [],
  _refSources: [],    // { label, onClick(shot) } — boutons dans le bloc Références des cartes   // { label, onClick(shot, take) }
  _toolbar: { storyboard: [], montage: [], project: [] },

  _bind: function (app) { this._app = app; },

  // ---- Données ----
  getProject: function () { return this._app.getProject(); },
  getShots: function () { return this._app.sortedShots(); },
  getLibrary: function () { return this._app.getProject().library; },
  getSettings: function () { return Object.assign({}, this._app.settings, { apiKey: undefined }); },
  getSelectedTake: function (shot) { return this._app.selectedTake(shot); },
  getTakeBlob: function (takeId) { return this._app.getTakeBlob(takeId); },
  getMontagePlan: function () { return this._app.montagePlan(); },
  getMontageTimeline: function () { return this._app.montageTimeline(); },
  getProjectById: function (id) { return this._app.db.projects[id] || null; },
  openProject: function (id) { if (this._app.db.projects[id]) this._app.switchProject(id); },
  // Ajoute une étape de transformation du prompt final : fn(prompt, shot, projet, "image"|"video") → prompt
  addPromptFilter: function (fn) { this._promptFilters.push(fn); },
  previewPrompt: function (shot) { return this._app.buildPrompt(shot, this.getProject()); },
  // Plan terminé à partir d'un média (Blob) : carton, récap, arrêt sur image…
  addMediaShot: function (blob, kind, opts, projId) { return this._app.addMediaShot(blob, kind, opts, projId ? this._app.db.projects[projId] : null); },
  addToLibrary: function (blob, meta, projId) { return this._app.addLibraryItem(blob, meta, projId ? this._app.db.projects[projId] : null); },
  sortedShotsOf: function (projId) { var p = this._app.db.projects[projId]; return p ? this._app.sortedShots(p) : []; },
  getShot: function (id) { return this._app.sortedShots().find(function (s) { return s.id === id; }) || null; },
  getAllProjects: function () { var db = this._app.db; return Object.keys(db.projects).map(function (k) { return db.projects[k]; }); },
  getLibBlob: function (item) { return this._app.getLibBlob(item); },
  getTakeBlobOrFetch: function (take) { return this._app.getTakeBlobOrFetch(take); },
  // Stockage persistant (IndexedDB). Préfixez vos clés avec le nom de votre plugin.
  store: {
    get: function (k) { return AgnesStore.getBlob(k); },
    put: function (k, b) { return AgnesStore.putBlob(k, b); },
    del: function (k) { return AgnesStore.delBlob(k); },
    getKV: function (k) { return AgnesStore.getKV(k); },
    setKV: function (k, v) { return AgnesStore.setKV(k, v); }
  },
  // Réglages propres à un plugin (localStorage) : var cfg = core.pluginSettings("tts", {…}); cfg.x = 1; cfg.save();
  pluginSettings: function (id, defaults) {
    var key = "agnes_plugin_" + id, v = {};
    try { v = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { }
    var obj = Object.assign({}, defaults || {}, v);
    Object.defineProperty(obj, "save", { enumerable: false, value: function () { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { } } });
    return obj;
  },

  // ---- Actions ----
  addShot: function (opts) { return this._app.addShot(opts || {}); },
  enqueue: function (shotId) { return this._app.enqueueShotById(shotId); },
  toast: function (msg, type) { this._app.toast(msg, type); },
  saveProject: function () { this._app.touch(); },
  // Modifie un plan (undefined = supprime le champ), enregistre et rafraîchit
  updateShot: function (id, patch) {
    var s = this.getShot(id); if (!s) return null;
    Object.keys(patch).forEach(function (k) { if (patch[k] === undefined) delete s[k]; else s[k] = patch[k]; });
    this._app.touch(); this._app.renderShots(); this.emit("shot:change", s); return s;
  },
  _voiceUsed: function (key) {
    return this.getAllProjects().some(function (p) { return p.shots.some(function (x) { return x.voice && x.voice.key === key; }); });
  },
  // Attache une voix (Blob audio) à un plan. meta : { text, offset (s), volume (0–2), duck (0–1 = volume du son du clip pendant la voix) }
  setShotVoice: function (id, blob, meta) {
    var self = this, s = this.getShot(id); if (!s) return Promise.reject(new Error("plan introuvable"));
    var key = "voice:" + id + ":" + Date.now().toString(36);
    return AgnesStore.putBlob(key, blob).then(function () {
      var old = s.voice && s.voice.key;
      self.updateShot(id, { voice: Object.assign({ offset: 0, volume: 1, duck: 0.35 }, s.voice || {}, meta || {}, { key: key, type: blob.type, size: blob.size }) });
      if (old && !self._voiceUsed(old)) AgnesStore.delBlob(old);
      return self.getShot(id).voice;
    });
  },
  clearShotVoice: function (id) {
    var s = this.getShot(id); if (!s || !s.voice) return;
    var old = s.voice.key; this.updateShot(id, { voice: undefined });
    if (old && !this._voiceUsed(old)) AgnesStore.delBlob(old);
  },
  getShotVoiceBlob: function (id) { var s = this.getShot(id); return s && s.voice && s.voice.key ? AgnesStore.getBlob(s.voice.key) : Promise.resolve(null); },
  download: function (blob, name) {
    var a = document.createElement("a"), u = URL.createObjectURL(blob); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  },

  // ---- Événements : shot:done, shot:error, job:update, project:change, render ----
  events: new EventTarget(),
  on: function (event, cb) { this.events.addEventListener(event, function (e) { cb(e.detail); }); },
  emit: function (event, data) { this.events.dispatchEvent(new CustomEvent(event, { detail: data })); },

  // ---- Interface ----
  ui: {
    // Ajoute un onglet ; retourne l'élément <section> à remplir
    addTab: function (id, title, viewHtml) {
      var app = window.AgnesCore._app;
      var viewId = "view_" + id;
      if (document.getElementById(viewId)) return document.getElementById(viewId);
      var btn = document.createElement("button");
      btn.className = "tab"; btn.setAttribute("role", "tab"); btn.setAttribute("aria-selected", "false");
      btn.setAttribute("data-view", viewId); btn.textContent = title;
      document.getElementById("tabBar").appendChild(btn);
      var section = document.createElement("section");
      section.className = "view"; section.id = viewId; section.innerHTML = viewHtml || "";
      document.querySelector(".shell").appendChild(section);
      if (app && app.bindTab) app.bindTab(btn);
      return section;
    },
    // Panneau latéral (même style que les réglages). Retourne { el, body, open(), close(), setTitle() }
    panel: function (id, title, wide) {
      var ov = document.getElementById("panel_" + id), api;
      if (!ov) {
        ov = document.createElement("div"); ov.className = "overlay"; ov.id = "panel_" + id;
        ov.innerHTML = '<div class="settings-sheet' + (wide ? " wide" : "") + '"><div class="close-row"><button class="icon-btn" data-close aria-label="Fermer">✕</button></div><h2></h2><div class="panel-body"></div></div>';
        document.body.appendChild(ov);
        ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest("[data-close]")) { ov.classList.remove("open"); window.AgnesCore.emit("panel:close", id); } });
      }
      api = {
        el: ov, body: ov.querySelector(".panel-body"),
        open: function () { ov.classList.add("open"); return api; },
        close: function () { ov.classList.remove("open"); window.AgnesCore.emit("panel:close", id); return api; },
        setTitle: function (t) { ov.querySelector("h2").textContent = t; return api; }
      };
      if (title) api.setTitle(title);
      return api;
    },
    // Ajoute un bouton sur chaque carte de plan (reçoit le plan et sa prise sélectionnée)
    addRefSource: function (label, onClick) { window.AgnesCore._refSources.push({ label: label, onClick: onClick }); },
    addShotAction: function (label, onClick) {
      window.AgnesCore._shotActions.push({ label: label, onClick: onClick });
      var app = window.AgnesCore._app; if (app) app.renderShots();
    },
    // Ajoute un bouton dans une barre : "storyboard" | "montage" | "project"
    addToolbarButton: function (zone, label, onClick, primary) {
      var ids = { storyboard: "storyboardToolbar", montage: "montageToolbar", project: "exportCard" };
      var host = document.getElementById(ids[zone]);
      if (!host) return null;
      var b = document.createElement("button");
      b.className = primary ? "primary-btn" : "small-btn"; b.textContent = label; b.onclick = onClick;
      if (zone === "project") { var row = host.querySelector(".row-inline") || host; row.appendChild(b); }
      else host.appendChild(b);
      return b;
    }
  }
};
