// js/app-queue.js — liste d'attente globale des générations
(function () {
  "use strict";
  var A = window.AgnesApp;
  A.jobs = [];
  A.queuePaused = false;
  var ACTIVE = ["waiting", "running"];

  A.emitJob = function (job) {
    AgnesCore.emit("job:update", job);
    scheduleRender();
  };
  var renderPending = false;
  function scheduleRender() {
    if (renderPending) return; renderPending = true;
    requestAnimationFrame(function () { renderPending = false; A.renderQueue(); });
  }

  A.enqueueShot = function (shot, opts, proj) {
    proj = proj || A.getProject(); opts = opts || {};
    var existing = A.jobs.find(function (j) { return j.shotId === shot.id && ACTIVE.indexOf(j.status) !== -1; });
    if (existing) return existing;
    var job = { id: A.uid(), shotId: shot.id, projectId: proj.id, status: "waiting", createdAt: Date.now(), info: "", resume: !!opts.resume, stage: opts.stage || "" };
    A.jobs.push(job);
    shot.status = "queued"; shot.errorMsg = "";
    A.touch(proj); A.renderShots(); A.pump(); scheduleRender();
    return job;
  };
  A.enqueueShotById = function (shotId) {
    var s = A.findShot(shotId); return s ? A.enqueueShot(s) : null;
  };
  // stage : "image" ou "video" pour un plan Texte → Image → Vidéo (sinon choisi automatiquement)
  A.enqueueStage = function (shot, stage, proj) {
    if (!A.settings.apiKey && A.needsAgnesKey(shot, stage)) { A.openSettings(); A.toast("Ajoutez votre clé API pour lancer des générations.", "err"); return null; }
    return A.enqueueShot(shot, { stage: stage }, proj);
  };
  A.enqueueMany = function (shots, proj) {
    if (!A.settings.apiKey && shots.some(function (s) { return A.needsAgnesKey(s); })) { A.openSettings(); A.toast("Ajoutez votre clé API pour lancer des générations.", "err"); return 0; }
    shots.forEach(function (s) { A.enqueueShot(s, {}, proj); });
    return shots.length;
  };

  function concurrency() {
    var p = A.getProject(); return A.clamp(p && p.concurrency || 1, 1, 4);
  }
  // Un plan qui enchaîne sur le précédent attend que celui-ci soit terminé
  function blocked(job) {
    var proj = A.getProjectById(job.projectId), shot = A.findShot(job.shotId, job.projectId);
    if (!proj || !shot || !A.shotDependsOnPrevious(shot)) return false;
    var prev = A.previousShot(shot, proj);
    return !!(prev && ["queued", "running", "resume"].indexOf(prev.status) !== -1);
  }

  A.pump = function () {
    if (A.queuePaused) return;
    var running = A.jobs.filter(function (j) { return j.status === "running"; }).length;
    var max = concurrency();
    for (var i = 0; i < A.jobs.length && running < max; i++) {
      var j = A.jobs[i];
      if (j.status !== "waiting" || blocked(j)) continue;
      start(j); running++;
    }
    scheduleRender();
  };

  function start(job) {
    job.status = "running"; job.startedAt = Date.now(); job.info = "Démarrage…";
    job.controller = new AbortController(); job.signal = job.controller.signal;
    A.runShotJob(job).then(function () {
      job.status = "done"; job.info = job.warning || "Terminé";
    }).catch(function (err) {
      if (err && err.cancelled) { job.status = "cancelled"; job.info = "Annulé"; }
      else { job.status = "error"; job.info = err && err.display ? err.display : (err && err.message ? err.message : String(err)); }
    }).finally(function () {
      job.endedAt = Date.now(); job.controller = null;
      A.emitJob(job); A.render(); A.pump();
    });
  }

  A.cancelJob = function (job) {
    if (job.status === "waiting") {
      job.status = "cancelled"; job.info = "Annulé"; job.endedAt = Date.now();
      var s = A.findShot(job.shotId, job.projectId); if (s && s.status === "queued") { s.status = "idle"; A.touch(A.getProjectById(job.projectId)); }
    } else if (job.status === "running") {
      job.cancelled = true; job.info = "Annulation…";
      if (job.controller) job.controller.abort();
    }
    A.emitJob(job); A.renderShots();
  };
  A.retryJob = function (job) {
    var proj = A.getProjectById(job.projectId), s = A.findShot(job.shotId, job.projectId);
    if (s) A.enqueueShot(s, {}, proj);
  };
  A.moveJob = function (job, dir) {
    var waiting = A.jobs.filter(function (j) { return j.status === "waiting"; });
    var i = waiting.indexOf(job), k = i + dir;
    if (i < 0 || k < 0 || k >= waiting.length) return;
    var a = A.jobs.indexOf(job), b = A.jobs.indexOf(waiting[k]);
    A.jobs[a] = waiting[k]; A.jobs[b] = job; scheduleRender();
  };

  // ---- Affichage ----
  var STATUS_LABEL = { waiting: "en attente", running: "en cours", done: "terminé", error: "échec", cancelled: "annulé" };
  function elapsed(job) {
    var from = job.startedAt || job.createdAt, to = job.endedAt || Date.now();
    var s = Math.max(0, Math.round((to - from) / 1000));
    return (s >= 60 ? Math.floor(s / 60) + " min " : "") + (s % 60) + " s";
  }
  A.renderQueue = function () {
    var active = A.jobs.filter(function (j) { return ACTIVE.indexOf(j.status) !== -1; }).length;
    A.byId("queueBadge").textContent = active ? String(active) : "";
    var list = A.byId("qList"); if (!list) return;
    A.byId("qEmpty").style.display = A.jobs.length ? "none" : "block";
    A.byId("qPauseBtn").textContent = A.queuePaused ? "Reprendre" : "Mettre en pause";
    var counts = { waiting: 0, running: 0, done: 0, error: 0 };
    A.jobs.forEach(function (j) { if (counts[j.status] != null) counts[j.status]++; });
    A.byId("qStats").textContent = A.jobs.length ? (counts.running + " en cours · " + counts.waiting + " en attente · " + counts.done + " terminées · " + counts.error + " en échec" + (A.queuePaused ? " — file en pause" : "")) : "";
    if (!A.byId("viewQueue").classList.contains("active")) return;

    list.innerHTML = A.jobs.map(function (j) {
      var proj = A.getProjectById(j.projectId), shot = A.findShot(j.shotId, j.projectId);
      var num = shot && proj ? A.sortedShots(proj).indexOf(shot) + 1 : "?";
      var take = shot ? A.selectedTake(shot) : null;
      var thumb = take && take.thumb ? '<img src="' + take.thumb + '" alt="">' : (j.status === "running" ? '<span class="spinner"></span>' : '');
      var title = shot ? ("#" + num + " · " + (A.MODES[shot.mode] || {}).label + " — " + (shot.prompt || "(sans description)")) : "(plan supprimé)";
      var otherProj = proj && proj.id !== A.db.currentProjectId ? " · projet « " + proj.name + " »" : "";
      var acts = "";
      if (j.status === "waiting") acts += '<button class="small-btn" data-q="up" data-id="' + j.id + '" aria-label="Monter">↑</button><button class="small-btn" data-q="down" data-id="' + j.id + '" aria-label="Descendre">↓</button>';
      if (ACTIVE.indexOf(j.status) !== -1) acts += '<button class="small-btn" data-q="cancel" data-id="' + j.id + '">Annuler</button>';
      if (j.status === "error" || j.status === "cancelled") acts += '<button class="small-btn" data-q="retry" data-id="' + j.id + '">Relancer</button>';
      if (shot) acts += '<button class="small-btn" data-q="goto" data-id="' + j.id + '">Voir le plan</button>';
      return '<div class="q-row"><div class="q-thumb">' + thumb + '</div><div style="min-width:0;">' +
        '<div class="q-title">' + A.esc(title) + '</div>' +
        '<div class="q-meta"><span class="q-status ' + j.status + '">' + STATUS_LABEL[j.status] + '</span>' +
        A.esc(j.info || "") + (j.status !== "waiting" ? " · " + elapsed(j) : "") + A.esc(otherProj) + '</div></div>' +
        '<div class="q-actions">' + acts + '</div></div>';
    }).join("");
  };

  A.initQueueUI = function () {
    A.byId("qList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-q]"); if (!b) return;
      var job = A.jobs.find(function (j) { return j.id === b.getAttribute("data-id"); }); if (!job) return;
      var act = b.getAttribute("data-q");
      if (act === "cancel") A.cancelJob(job);
      else if (act === "retry") A.retryJob(job);
      else if (act === "up") A.moveJob(job, -1);
      else if (act === "down") A.moveJob(job, 1);
      else if (act === "goto") {
        if (job.projectId !== A.db.currentProjectId) { A.db.currentProjectId = job.projectId; A.saveDB(); A.render(); }
        A.showView("viewStoryboard");
        setTimeout(function () { var el = document.querySelector('[data-shot="' + job.shotId + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50);
      }
    });
    A.byId("qPauseBtn").addEventListener("click", function () { A.queuePaused = !A.queuePaused; if (!A.queuePaused) A.pump(); scheduleRender(); });
    A.byId("qConcurrency").addEventListener("change", function () {
      var p = A.getProject(); p.concurrency = A.clamp(this.value, 1, 4); this.value = p.concurrency;
      A.touch(); A.byId("projConcurrency").value = p.concurrency; A.pump();
    });
    A.byId("qRetryErrBtn").addEventListener("click", function () {
      A.jobs.filter(function (j) { return j.status === "error"; }).forEach(function (j) { j.status = "cancelled"; A.retryJob(j); });
      A.jobs = A.jobs.filter(function (j) { return j.status !== "cancelled" || ACTIVE.indexOf(j.status) !== -1; });
      scheduleRender();
    });
    A.byId("qClearBtn").addEventListener("click", function () {
      A.jobs = A.jobs.filter(function (j) { return ACTIVE.indexOf(j.status) !== -1; }); scheduleRender();
    });
    A.byId("qCancelAllBtn").addEventListener("click", function () {
      if (!window.confirm("Annuler toutes les tâches en attente et en cours ?")) return;
      A.jobs.slice().forEach(function (j) { if (ACTIVE.indexOf(j.status) !== -1) A.cancelJob(j); });
    });
    // Rafraîchit les durées affichées
    setInterval(function () { if (A.jobs.some(function (j) { return j.status === "running"; })) scheduleRender(); }, 1000);
  };

  // Reprise des vidéos encore en cours côté serveur après un rechargement
  A.resumeInterrupted = function () {
    var n = 0;
    Object.keys(A.db.projects).forEach(function (pid) {
      var p = A.db.projects[pid];
      p.shots.forEach(function (s) { if (s.status === "resume") { A.enqueueShot(s, { resume: true }, p); n++; } });
    });
    if (n) A.toast(n + " vidéo(s) en cours de rendu reprise(s) après le rechargement.", "ok");
  };
})();
