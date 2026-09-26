// plugins/plugin-planning.js — Planning de publication
// Vue d'ensemble de tous les épisodes (projets) de toutes les séries : date de sortie, statut, plateformes,
// avancement de la production. Calendrier mensuel, rythme automatique (ex. un épisode tous les 2 jours à 19h),
// alertes quand une date approche alors que l'épisode n'est pas prêt, export .ics vers votre agenda.
// Les dates sont partagées avec l'onglet Publication.
AgnesPlugins.register("planning", {
  name: "Planning de publication",
  version: "1.0",
  STATUS: [["idee", "Idée"], ["prod", "En production"], ["pret", "Prêt"], ["prog", "Programmé"], ["publie", "Publié"]],
  PLATFORMS: [["tiktok", "TikTok"], ["reels", "Reels"], ["shorts", "Shorts"], ["youtube", "YouTube"]],

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; var now = new Date(); this.month = new Date(now.getFullYear(), now.getMonth(), 1);

    var view = core.ui.addTab("planning", "Planning",
      '<div id="plAlerts"></div>' +
      '<div class="card"><div class="row-inline" style="justify-content:space-between"><h3 style="margin:0">Calendrier</h3>' +
      '<div class="row-inline"><button class="small-btn" id="plPrev" aria-label="Mois précédent">‹</button><b id="plMonth" style="min-width:150px;text-align:center"></b><button class="small-btn" id="plNext" aria-label="Mois suivant">›</button>' +
      '<button class="small-btn" id="plToday">Aujourd\'hui</button><button class="small-btn" id="plIcs">Exporter vers l\'agenda (.ics)</button></div></div>' +
      '<div id="plCal" style="margin-top:10px"></div></div>' +
      '<div class="card"><h3>Épisodes</h3><div class="row-inline" style="margin-bottom:8px"><select id="plFilter"></select></div><div id="plRows" style="overflow-x:auto"></div></div>' +
      '<div class="card"><h3>Rythme de diffusion</h3><p class="hint">Programme d\'un coup tous les épisodes d\'une série, dans l\'ordre de leur numéro.</p>' +
      '<div class="ext-cols"><div class="field"><label>Série</label><select id="plRSerie"></select></div>' +
      '<div class="field"><label>Premier épisode le</label><input type="datetime-local" id="plRStart"></div>' +
      '<div class="field"><label>Puis tous les</label><select id="plREvery"><option value="1">jours</option><option value="2">2 jours</option><option value="3">3 jours</option><option value="7" selected>7 jours</option></select></div></div>' +
      '<label class="hint"><input type="checkbox" id="plROnly" checked> Seulement les épisodes sans date</label>' +
      '<div class="row-inline" style="margin-top:8px"><button class="primary-btn" id="plRApply">Programmer</button></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };
    this.$ = $;

    function pub(p) {
      if (!p.publish) p.publish = { serie: p.name, ep: 1, texts: {}, cover: {} };
      if (!p.publish.platforms) p.publish.platforms = ["tiktok"];
      if (!p.publish.status) p.publish.status = "prod";
      return p.publish;
    }
    this.pub = pub;
    function serieOf(p) { return (pub(p).serie || p.name).trim(); }
    this.serieOf = serieOf;
    function progress(p) {
      var shots = p.shots.filter(function (s) { return !s.media; }), done = shots.filter(function (s) { return s.takes && s.takes.length; }).length;
      var voice = p.shots.filter(function (s) { return s.voiceDraft || s.voice; }), voiced = voice.filter(function (s) { return s.voice && s.voice.key; }).length;
      return { shots: shots.length, done: done, voice: voice.length, voiced: voiced };
    }
    function projects() {
      var f = $("plFilter").value;
      return core.getAllProjects().filter(function (p) { return !f || serieOf(p) === f; }).sort(function (a, b) {
        var sa = serieOf(a), sb = serieOf(b); return sa === sb ? (pub(a).ep || 0) - (pub(b).ep || 0) : sa.localeCompare(sb);
      });
    }
    function fillSeries() {
      var names = []; core.getAllProjects().forEach(function (p) { var s = serieOf(p); if (names.indexOf(s) === -1) names.push(s); });
      names.sort();
      var cur = $("plFilter").value, curR = $("plRSerie").value;
      $("plFilter").innerHTML = '<option value="">Toutes les séries</option>' + names.map(function (n) { return '<option' + (n === cur ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("");
      $("plRSerie").innerHTML = names.map(function (n) { return '<option' + (n === curR ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("");
      if (!$("plRStart").value) { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); $("plRStart").value = self.toLocalInput(d); }
    }
    function renderRows() {
      var list = projects(), cur = core.getProject().id;
      $("plRows").innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:var(--text-dim)">' +
        '<th>Épisode</th><th>Série</th><th>N°</th><th>Sortie</th><th>Statut</th><th>Plateformes</th><th>Avancement</th><th></th></tr></thead><tbody>' +
        list.map(function (p) {
          var m = pub(p), pr = progress(p);
          var bar = pr.shots ? Math.round(pr.done / pr.shots * 100) : 0;
          return '<tr data-proj="' + p.id + '" style="border-top:1px solid var(--edge-soft)' + (p.id === cur ? ";background:var(--glass)" : "") + '">' +
            '<td style="padding:6px 4px"><b>' + esc(p.name) + '</b></td>' +
            '<td><input type="text" data-pl="serie" value="' + esc(m.serie || "") + '" style="width:120px"></td>' +
            '<td><input type="number" data-pl="ep" min="1" value="' + (m.ep || 1) + '" style="width:56px"></td>' +
            '<td><input type="datetime-local" data-pl="date" value="' + esc(m.date || "") + '"></td>' +
            '<td><select data-pl="status">' + App.optionsHtml(self.STATUS, m.status) + '</select></td>' +
            '<td style="white-space:nowrap">' + self.PLATFORMS.map(function (pf) { return '<label class="hint" style="margin:0 6px 0 0"><input type="checkbox" data-pf="' + pf[0] + '"' + (m.platforms.indexOf(pf[0]) !== -1 ? " checked" : "") + '>' + pf[1] + '</label>'; }).join("") + '</td>' +
            '<td style="min-width:130px"><div style="height:6px;background:var(--glass-strong);border-radius:4px"><div style="height:6px;width:' + bar + '%;background:var(--ok);border-radius:4px"></div></div>' +
            '<span class="hint" style="margin:0">' + pr.done + '/' + pr.shots + ' plans' + (pr.voice ? ' · ' + pr.voiced + '/' + pr.voice + ' voix' : '') + '</span></td>' +
            '<td>' + (p.id === cur ? '<span class="ext-tag ok">ouvert</span>' : '<button class="small-btn" data-open>Ouvrir</button>') + '</td></tr>';
        }).join("") + '</tbody></table>';
    }
    function renderCal() {
      var m = self.month, y = m.getFullYear(), mo = m.getMonth();
      $("plMonth").textContent = m.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      var first = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(), today = new Date();
      var byDay = {};
      core.getAllProjects().forEach(function (p) {
        var d = pub(p).date && new Date(pub(p).date); if (!d || isNaN(d) || d.getFullYear() !== y || d.getMonth() !== mo) return;
        (byDay[d.getDate()] = byDay[d.getDate()] || []).push({ p: p, d: d });
      });
      var colors = { idee: "var(--silver-dim)", prod: "var(--warn)", pret: "var(--steel)", prog: "var(--ok)", publie: "var(--ok)" };
      var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:12px">' +
        ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map(function (d) { return '<div class="hint" style="margin:0;text-align:center">' + d + '</div>'; }).join("");
      for (var i = 0; i < first; i++) html += "<div></div>";
      for (var d = 1; d <= days; d++) {
        var isToday = today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;
        html += '<div style="min-height:74px;border:1px solid ' + (isToday ? "var(--silver)" : "var(--edge-soft)") + ';border-radius:8px;padding:4px"><div class="hint" style="margin:0">' + d + '</div>' +
          (byDay[d] || []).sort(function (a, b) { return a.d - b.d; }).map(function (x) {
            var st = pub(x.p).status;
            return '<button class="small-btn" data-openp="' + x.p.id + '" title="' + esc(x.p.name) + '" style="display:block;width:100%;text-align:left;margin-top:3px;padding:3px 6px;font-size:11px;border-left:3px solid ' + colors[st] + (st === "publie" ? ";opacity:.6" : "") + '">' +
              x.d.toTimeString().slice(0, 5) + ' ' + esc(serieOf(x.p)).slice(0, 14) + ' · ép.' + (pub(x.p).ep || 1) + '</button>';
          }).join("") + '</div>';
      }
      $("plCal").innerHTML = html + "</div>";
    }
    function renderAlerts() {
      var soon = Date.now() + 48 * 3600e3, late = [];
      core.getAllProjects().forEach(function (p) {
        var m = pub(p), d = m.date && new Date(m.date).getTime();
        if (!d || m.status === "publie") return;
        if (d < Date.now() && m.status !== "prog") late.push(["err", "Date dépassée", p]);
        else if (d < soon && (m.status === "idee" || m.status === "prod")) late.push(["err", "Sort dans moins de 48 h mais n'est pas prêt", p]);
      });
      $("plAlerts").innerHTML = late.length ? '<div class="card">' + late.map(function (a) {
        return '<div class="ext-row"><span class="ext-tag ' + a[0] + '">' + a[1] + '</span><b>' + esc(a[2].name) + '</b><span class="hint" style="margin:0">' + new Date(pub(a[2]).date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) + '</span></div>';
      }).join("") + '</div>' : "";
    }
    function refresh() { fillSeries(); renderRows(); renderCal(); renderAlerts(); }
    this.refresh = refresh;

    $("plRows").addEventListener("change", function (e) {
      var row = e.target.closest("[data-proj]"), p = row && core.getProjectById(row.getAttribute("data-proj")); if (!p) return;
      var m = pub(p), f = e.target.getAttribute("data-pl"), pf = e.target.getAttribute("data-pf");
      if (pf) { var i = m.platforms.indexOf(pf); if (e.target.checked && i === -1) m.platforms.push(pf); if (!e.target.checked && i !== -1) m.platforms.splice(i, 1); }
      else if (f === "ep") m.ep = Math.max(1, parseInt(e.target.value, 10) || 1);
      else if (f) m[f] = e.target.value;
      p.updatedAt = Date.now(); App.saveDB();
      if (f === "serie") fillSeries();
      renderCal(); renderAlerts();
    });
    view.addEventListener("click", function (e) {
      var b = e.target.closest("[data-open],[data-openp]"); if (!b) return;
      var id = b.getAttribute("data-openp") || b.closest("[data-proj]").getAttribute("data-proj");
      core.openProject(id); refresh();
    });
    $("plFilter").addEventListener("change", renderRows);
    $("plPrev").addEventListener("click", function () { self.month.setMonth(self.month.getMonth() - 1); renderCal(); });
    $("plNext").addEventListener("click", function () { self.month.setMonth(self.month.getMonth() + 1); renderCal(); });
    $("plToday").addEventListener("click", function () { var n = new Date(); self.month = new Date(n.getFullYear(), n.getMonth(), 1); renderCal(); });
    $("plIcs").addEventListener("click", function () { self.exportIcs(); });
    $("plRApply").addEventListener("click", function () {
      var serie = $("plRSerie").value, start = new Date($("plRStart").value), every = Number($("plREvery").value) || 7;
      if (!serie || isNaN(start)) return core.toast("Choisissez une série et une date de départ.", "err");
      var list = core.getAllProjects().filter(function (p) { return serieOf(p) === serie && (!$("plROnly").checked || !pub(p).date); })
        .sort(function (a, b) { return (pub(a).ep || 0) - (pub(b).ep || 0); });
      if (!list.length) return core.toast("Aucun épisode à programmer.", "err");
      list.forEach(function (p, i) {
        var d = new Date(start.getTime()); d.setDate(d.getDate() + i * every);
        var m = pub(p); m.date = self.toLocalInput(d); if (m.status === "idee") m.status = "prod"; p.updatedAt = Date.now();
      });
      App.saveDB(); self.month = new Date(start.getFullYear(), start.getMonth(), 1); refresh();
      core.toast(list.length + " épisode(s) programmé(s).", "ok");
    });

    core.on("view:change", function (v) { if (v === "view_planning") refresh(); });
    core.on("project:change", function () { if (view.classList.contains("active")) refresh(); });
  },

  toLocalInput: function (d) {
    var z = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + "T" + z(d.getHours()) + ":" + z(d.getMinutes());
  },
  exportIcs: function () {
    var self = this, core = this.core, App = window.AgnesApp, ev = [];
    var z = function (n) { return String(n).padStart(2, "0"); };
    var fmt = function (d) { return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "T" + z(d.getHours()) + z(d.getMinutes()) + "00"; };
    var escI = function (s) { return String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    core.getAllProjects().forEach(function (p) {
      var m = self.pub(p), d = m.date && new Date(m.date); if (!d || isNaN(d) || m.status === "publie") return;
      var end = new Date(d.getTime() + 30 * 60000), pf = m.platforms.map(function (x) { return (self.PLATFORMS.find(function (y) { return y[0] === x; }) || [0, x])[1]; }).join(", ");
      ev.push(["BEGIN:VEVENT", "UID:" + p.id + "@agnes-studio", "DTSTAMP:" + stamp, "DTSTART:" + fmt(d), "DTEND:" + fmt(end),
        "SUMMARY:" + escI("Publier " + self.serieOf(p) + " — ép. " + (m.ep || 1) + (pf ? " (" + pf + ")" : "")),
        "DESCRIPTION:" + escI((m.hook ? m.hook + "\n" : "") + "Projet : " + p.name + "\nStatut : " + ((self.STATUS.find(function (s) { return s[0] === m.status; }) || [0, ""])[1])),
        "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + escI("Publication dans 1 h"), "END:VALARM", "END:VEVENT"].join("\r\n"));
    });
    if (!ev.length) return core.toast("Aucune date de publication à exporter.", "err");
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agnes Studio Pro//Planning//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Publications Agnes Studio"].concat(ev, ["END:VCALENDAR"]).join("\r\n");
    core.download(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "planning-publications.ics");
    core.toast(ev.length + " publication(s) exportée(s) — ouvrez le fichier pour les ajouter à votre agenda.", "ok");
  }
});
