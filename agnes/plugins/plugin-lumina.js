// plugins/plugin-lumina.js — Pont avec l'extension Lumina (Grok Imagine + pilote auto)
// Actif seulement quand Agnes est ouverte DEPUIS Lumina (page chrome-extension://…/agnes/index.html) :
// le panneau Lumina et cette page partagent alors la même origine et se parlent par BroadcastChannel.
//   Lumina → Agnes : ping · export (plans → stills / paires + références) · take (rendu Grok → prise du plan)
//   Agnes → Lumina : pong · export:result · take:ok · push (bouton « Envoyer vers Lumina ») · hello (démarrage)
// Hors extension (index.html ouvert directement), le plugin ne fait rien.
AgnesPlugins.register("lumina", {
  name: "Lumina (Grok)",
  version: "1.0",
  CHANNEL: "lumina-agnes",

  init: function (core) {
    var self = this, A = window.AgnesApp;
    this.core = core; this.A = A;
    this.inLumina = location.protocol === "chrome-extension:" && typeof BroadcastChannel === "function";
    if (!this.inLumina) return;
    this.bc = new BroadcastChannel(this.CHANNEL);
    this.bc.onmessage = function (e) { self.onMessage(e.data || {}); };

    core.ui.addToolbarButton("storyboard", "⇢ Grok (Lumina)", function () { self.push(); });
    core.ui.addShotAction("⇢ Grok", function (shot) { self.push([shot.id]); });
    this.post({ type: "hello" });
    core.on("project:change", function () { self.post({ type: "hello" }); });
  },

  post: function (msg) { this.bc.postMessage(Object.assign({ to: "lumina" }, msg)); },

  onMessage: function (m) {
    var self = this;
    if (m.to !== "agnes") return;
    var reply = function (type, body) { self.post(Object.assign({ type: type, rid: m.rid }, body)); };
    var fail = function (e) { reply(m.type + ":error", { error: (e && (e.display || e.message)) || String(e) }); };
    try {
      if (m.type === "ping") return reply("pong", this.status());
      if (m.type === "export") return this.exportShots(m).then(function (data) { reply("export:result", { data: data }); }, fail);
      if (m.type === "take") return this.addTake(m).then(function (shot) { reply("take:ok", { shotId: shot.id }); }, fail);
    } catch (e) { fail(e); }
  },

  status: function () {
    var A = this.A, p = A.getProject();
    return {
      project: { id: p.id, name: p.name, shots: p.shots.length, selected: A.selection ? A.selection.size : 0 },
      projects: this.core.getAllProjects().map(function (x) { return { id: x.id, name: x.name, shots: x.shots.length }; })
    };
  },

  // Bouton « ⇢ Grok (Lumina) » : plans cochés (ou tous) envoyés au panneau Lumina, qui les range dans son lot.
  push: function (ids) {
    var self = this, A = this.A, sel = ids || (A.selection && A.selection.size ? Array.from(A.selection) : null);
    this.exportShots({ ids: sel, withDna: true }).then(function (data) {
      if (!data.shots.length) return self.core.toast("Aucun plan à envoyer vers Grok.", "err");
      self.post({ type: "push", data: data });
      self.core.toast(data.shots.length + " plan(s) envoyés au panneau Lumina (onglet Agnes).", "ok");
    }, function (e) { self.core.toast("Envoi vers Lumina : " + (e.display || e.message || e), "err"); });
  },

  // Prompt final côté Grok : description + skills + style + filtres (ADN Bible), sans les consignes propres à Agnes
  // (verrou d'identité, anti-invention) : Lumina ajoute ses propres règles qualité.
  finalPrompt: function (shot, proj, mode, prompt, withDna) {
    if (!withDna) return String(prompt || "").trim();
    return this.A.buildPrompt(Object.assign({}, shot, { mode: mode, prompt: prompt || "", lock: false, _export: true }), proj);
  },

  libBlob: function (proj, id) {
    var item = id && proj.library.find(function (l) { return l.id === id; });
    return item ? this.A.getLibBlob(item) : Promise.resolve(null);
  },

  // Image de départ du plan : image validée (Texte → Image → Vidéo), sinon image source de la bibliothèque.
  stillOf: function (shot, proj) {
    var A = this.A, key = A.keyTake(shot);
    if (key) return A.getTakeBlobOrFetch(key).then(function (b) { return b ? { blob: b, from: "image validée" } : null; });
    var ref = shot.mode === "i2v" ? shot.sourceRef : shot.mode === "frames" ? shot.startRef : "";
    if (!ref || ref === A.PREV_REF || ref === A.KEY_REF) return Promise.resolve(null);
    return this.libBlob(proj, ref).then(function (b) { return b ? { blob: b, from: "bibliothèque" } : null; });
  },

  // m = { projectId?, ids?: [shotId] | null, scope?: "selected"|"all", withDna? }
  exportShots: function (m) {
    var self = this, A = this.A;
    var proj = (m.projectId && A.db.projects[m.projectId]) || A.getProject();
    var all = A.sortedShots(proj), ids = m.ids;
    if (!ids && m.scope === "selected" && proj === A.getProject() && A.selection && A.selection.size) ids = Array.from(A.selection);
    var withDna = m.withDna !== false, skipped = [], refIds = [];
    var picked = all.map(function (s, i) { return { s: s, num: s.batchNo || s.stillNo || i + 1 }; })
      .filter(function (x) { return !ids || ids.indexOf(x.s.id) !== -1; });

    return Promise.all(picked.map(function (x) {
      var s = x.s, kind = A.modeKind(s.mode);
      if (A.syncMentions) A.syncMentions(s, proj);   // références mentionnées par @[Nom]
      if (s.media) { skipped.push({ num: x.num, reason: "média importé (carton, récap…)" }); return null; }
      var entry = {
        shotId: s.id, num: x.num, duration: s.duration || proj.duration || 6,
        title: String(s.prompt || s.imagePrompt || "plan").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" "),
        refs: [], imagePrompt: "", videoPrompt: "", still: null, stillFrom: "", chainPrev: false
      };
      if (kind === "image") entry.imagePrompt = self.finalPrompt(s, proj, s.mode, s.prompt, withDna);
      else {
        entry.videoPrompt = self.finalPrompt(s, proj, s.mode, s.prompt, withDna);
        if (String(s.imagePrompt || "").trim()) entry.imagePrompt = self.finalPrompt(s, proj, s.keyMode || "t2i", s.imagePrompt, withDna);
        entry.chainPrev = s.mode === "i2v" && s.sourceRef === A.PREV_REF;
      }
      (s.ingredients || []).forEach(function (id) {
        var it = proj.library.find(function (l) { return l.id === id; });
        if (!it || it.kind === "source") return;
        entry.refs.push(it.name);
        if (refIds.indexOf(id) === -1) refIds.push(id);
      });
      if (!entry.imagePrompt && !entry.videoPrompt) { skipped.push({ num: x.num, reason: "prompt vide" }); return null; }
      return (kind === "video" ? self.stillOf(s, proj) : Promise.resolve(null)).then(function (st) {
        if (st) { entry.still = st.blob; entry.stillFrom = st.from; }
        return entry;
      });
    })).then(function (entries) {
      return Promise.all(refIds.map(function (id) {
        var it = proj.library.find(function (l) { return l.id === id; });
        return A.getLibBlob(it).then(function (b) { return b ? { name: it.name, kind: it.kind, blob: b } : null; });
      })).then(function (refs) {
        return {
          project: { id: proj.id, name: proj.name, aspect: proj.aspect },
          shots: entries.filter(Boolean), refs: refs.filter(Boolean), skipped: skipped
        };
      });
    });
  },

  // m = { projectId, shotId, role: "image"|"video", blob, prompt? } — rendu Grok rangé comme nouvelle prise du plan.
  addTake: function (m) {
    var A = this.A, core = this.core;
    var proj = A.db.projects[m.projectId];
    var shot = proj && proj.shots.find(function (s) { return s.id === m.shotId; });
    if (!shot) return Promise.reject(new Error("plan introuvable dans Agnes (supprimé ?)"));
    if (!(m.blob instanceof Blob)) return Promise.reject(new Error("fichier manquant"));
    var take = { id: A.uid(), kind: m.role === "image" ? "image" : "video", createdAt: Date.now(), remoteUrl: "", local: true, source: "grok" };
    return AgnesStore.putBlob("take:" + take.id, m.blob).then(function () {
      if (take.kind === "image") return A.makeThumb(m.blob, 320);
      var u = URL.createObjectURL(m.blob);
      return A.videoFrame(u, "first", 640).then(function (fb) { URL.revokeObjectURL(u); return A.makeThumb(fb, 320); });
    }).catch(function () { return null; }).then(function (thumb) {
      take.thumb = thumb;
      if (take.kind === "image" && A.modeKind(shot.mode) === "video") {
        // Image de départ d'un plan vidéo : elle devient l'image validée (Texte → Image → Vidéo)
        shot.keyTakes = (shot.keyTakes || []).concat([take]); shot.keyTakeId = take.id;
        if (!(shot.takes || []).length) shot.status = "review";
      } else {
        shot.takes = (shot.takes || []).concat([take]); shot.selectedTakeId = take.id;
        shot.status = "done"; shot.errorMsg = "";
      }
      A.touch(proj);
      if (proj === A.getProject()) A.renderShots();
      if (take.kind === "video") core.emit("shot:done", { shot: shot, takes: [take], project: proj });
      return shot;
    });
  }
});
