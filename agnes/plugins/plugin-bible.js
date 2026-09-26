// plugins/plugin-bible.js — Bible de continuité
// Une bible par série, partagée par tous ses épisodes (projets) : personnages, lieux, objets, costumes.
// Chaque fiche a un « ADN » (description stable, idéalement en anglais) ajouté automatiquement au prompt final
// dès que le plan utilise sa référence en ingrédient/source, ou mentionne son nom (ou un alias).
// Une note par épisode (tenue, blessure, coiffure…) s'ajoute aussi. Les images de référence de la fiche
// peuvent être copiées dans la bibliothèque de n'importe quel épisode en un clic.
AgnesPlugins.register("bible", {
  name: "Bible de continuité",
  version: "1.0",
  KINDS: [["personnage", "Personnage"], ["lieu", "Lieu / décor"], ["objet", "Objet / accessoire"], ["costume", "Costume / look"], ["autre", "Autre"]],

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.data = { series: [] };

    var view = core.ui.addTab("bible", "Bible",
      '<div class="card"><h3>Série</h3>' +
      '<p class="hint">La bible est partagée par tous les épisodes (projets) de la série. L\'ADN d\'une fiche est ajouté au prompt final quand un plan utilise sa référence ou cite son nom — ' +
      'écrivez-le en anglais, précis et stable (âge, morphologie, visage, cheveux, peau, tenue par défaut). Vérifiez le résultat avec « 📖 Prompt final » sur un plan.</p>' +
      '<div class="row-inline"><select id="bbSeries" style="min-width:220px"></select><button class="small-btn" id="bbNewSeries">+ Série</button>' +
      '<button class="small-btn" id="bbRenSeries">Renommer</button><button class="small-btn" id="bbDelSeries">Supprimer</button>' +
      '<button class="small-btn" id="bbExport">Exporter (.json)</button><label class="small-btn" style="cursor:pointer">Importer (.json)<input type="file" id="bbImport" accept=".json,application/json" hidden></label></div>' +
      '<div id="bbShare" class="bb-share"></div>' +
      '<div class="field" style="margin-top:10px"><label>Style commun de la série (ajouté à tous les prompts de ses épisodes)</label><textarea id="bbStyle" rows="2" placeholder="cyber-noir, cold teal and deep red neon, high contrast, 35mm anamorphic, no text, no subtitles, no music"></textarea></div>' +
      '</div>' +
      '<div class="card"><div class="row-inline" style="justify-content:space-between"><h3 style="margin:0">Fiches</h3>' +
      '<div class="row-inline"><select id="bbFilter"><option value="">Toutes</option></select><button class="primary-btn" id="bbAdd">+ Fiche</button><button class="small-btn" id="bbLink">Relier les références aux plans</button></div></div>' +
      '<div id="bbList" style="margin-top:10px"></div></div>');
    this.view = view;
    var $ = function (id) { return view.querySelector("#" + id); };
    $("bbFilter").innerHTML += App.optionsHtml(this.KINDS, "");

    // ---------- Données ----------
    function persist() { core.store.setKV("plugin:bible", self.data); }
    function series() {
      var p = core.getProject(), list = self.data.series;
      var s = self.seriesOf(p);
      if (s && p.bibleSeriesId === undefined) { p.bibleSeriesId = s.id; p.bibleAuto = true; core.saveProject(); }
      return s || null;
    }
    this.series = series; this.persist = persist;

    // ---------- Rendu ----------
    function renderSeries() {
      var s = series();
      $("bbSeries").innerHTML = '<option value="">— aucune série pour ce projet —</option>' + self.data.series.map(function (x) {
        return '<option value="' + x.id + '"' + (s && s.id === x.id ? " selected" : "") + '>' + esc(x.name) + ' (' + x.entries.length + ')</option>';
      }).join("");
      $("bbStyle").value = s ? s.style || "" : ""; $("bbStyle").disabled = !s;
      renderShare(s);
      ["bbRenSeries", "bbDelSeries", "bbExport", "bbAdd", "bbLink"].forEach(function (id) { $(id).disabled = !s; });
    }
    // Avec quels projets cette bible est-elle partagée ? (évite de mélanger deux séries sans le savoir)
    function renderShare(s) {
      var p = core.getProject(), box = $("bbShare");
      if (!s) {
        box.innerHTML = '<p class="hint" style="margin:0 0 8px">Ce projet n\'a pas de bible. Nouvelle série : créez sa bible. Nouvel épisode d\'une série existante : choisissez-la dans la liste ci-dessus ' +
          '(ou donnez le même nom de série dans l\'onglet Épisodes ou Publication).</p><button class="small-btn" type="button" data-bb="new">+ Créer la bible de ce projet</button>';
        return;
      }
      var others = core.getAllProjects().filter(function (x) { return x.id !== p.id && self.seriesOf(x) === s; }).map(function (x) { return x.name; });
      box.innerHTML = others.length
        ? '<p class="hint" style="margin:0 0 8px">Cette bible est <b>partagée</b> avec : ' + others.map(esc).join(", ") + '. C\'est voulu pour les épisodes d\'une même série. ' +
          'Si ce projet est une autre série (autres personnages, autre univers), donnez-lui sa propre bible.</p>' +
          '<div class="row-inline"><button class="small-btn" type="button" data-bb="new">+ Nouvelle bible pour ce projet</button><button class="small-btn" type="button" data-bb="none">Ne pas utiliser de bible ici</button></div>'
        : '<p class="hint" style="margin:0">Bible utilisée uniquement par ce projet.</p>';
    }
    function usage(e) {
      return core.getShots().filter(function (sh) { return self.matches(e, sh, core.getProject()); }).length;
    }
    function renderList() {
      var s = series();
      if (!s) { $("bbList").innerHTML = '<p class="hint">Créez ou choisissez une série pour ce projet.</p>'; return; }
      var f = $("bbFilter").value, pid = core.getProject().id;
      var list = s.entries.filter(function (e) { return !f || e.kind === f; });
      if (!list.length) { $("bbList").innerHTML = '<p class="hint">Aucune fiche. Ajoutez vos personnages, lieux et objets récurrents.</p>'; return; }
      $("bbList").innerHTML = list.map(function (e) {
        var refs = (e.refs || []).map(function (r, i) {
          return '<span style="position:relative;display:inline-block"><img class="ext-thumb" src="' + (r.thumb || "") + '" alt="Référence ' + (i + 1) + ' de ' + esc(e.name) + '"><button class="small-btn" data-b="rmref" data-i="' + i + '" style="position:absolute;top:-6px;right:-6px;padding:0 6px" aria-label="Retirer">✕</button></span>';
        }).join(" ");
        var n = usage(e);
        return '<div class="card" data-entry="' + e.id + '" style="margin-bottom:10px">' +
          '<div class="row-inline"><input type="text" data-e="name" value="' + esc(e.name) + '" style="font-weight:600;width:200px"><select data-e="kind">' + App.optionsHtml(self.KINDS, e.kind) + '</select>' +
          '<input type="text" data-e="aliases" class="grow" value="' + esc(e.aliases || "") + '" placeholder="Alias séparés par des virgules (Lea, la juge…)" style="flex:1;min-width:180px">' +
          '<span class="ext-tag' + (n ? " ok" : "") + '">' + n + ' plan(s) ici</span></div>' +
          '<div class="field" style="margin-top:8px"><label>ADN (ajouté au prompt)</label><textarea data-e="dna" rows="3" placeholder="Léa, 34-year-old French woman, sharp oval face, dark brown shoulder-length hair with a side part, olive skin, small scar on left eyebrow, charcoal tailored coat…">' + esc(e.dna || "") + '</textarea></div>' +
          '<div class="field"><label>Note pour cet épisode (tenue, blessure, état…)</label><input type="text" data-e="note" value="' + esc((e.byProject || {})[pid] || "") + '" placeholder="wearing a wet raincoat, bandage on right hand"></div>' +
          '<div class="row-inline"><label class="hint" style="margin:0"><input type="checkbox" data-e="auto"' + (e.auto !== false ? " checked" : "") + '> Ajouter aussi quand le prompt cite le nom</label></div>' +
          '<div class="row-inline" style="margin-top:8px;align-items:center">' + refs +
          '<label class="small-btn" style="cursor:pointer">+ Image de référence<input type="file" data-b="addref" accept="image/*" multiple hidden></label>' +
          '<button class="small-btn" data-b="fromlib">Depuis la bibliothèque…</button>' +
          ((e.refs || []).length ? '<button class="small-btn" data-b="tolib">→ Bibliothèque de cet épisode</button>' : '') +
          '<button class="small-btn" data-b="del">Supprimer la fiche</button></div></div>';
      }).join("");
    }
    function refresh() { renderSeries(); renderList(); }
    this.refresh = refresh;

    // ---------- Actions série ----------
    $("bbShare").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bb]"); if (!b) return;
      if (b.getAttribute("data-bb") === "new") { $("bbNewSeries").click(); return; }
      core.getProject().bibleSeriesId = null; core.saveProject(); refresh();
      core.toast("Ce projet n'utilise plus de bible. Les fiches de l'autre série ne sont pas touchées.", "ok");
    });
    $("bbSeries").addEventListener("change", function () { core.getProject().bibleSeriesId = this.value || null; if (!this.value) core.getProject().bibleSeriesId = null; core.saveProject(); refresh(); });
    $("bbNewSeries").addEventListener("click", function () {
      var name = window.prompt("Nom de la série :", core.getProject().name); if (!name) return;
      var s = { id: App.uid(), name: name.trim(), style: "", entries: [] };
      self.data.series.push(s); core.getProject().bibleSeriesId = s.id; core.saveProject(); persist(); refresh();
    });
    $("bbRenSeries").addEventListener("click", function () { var s = series(); var n = s && window.prompt("Nouveau nom :", s.name); if (n) { s.name = n.trim(); persist(); refresh(); } });
    $("bbDelSeries").addEventListener("click", function () {
      var s = series(); if (!s || !window.confirm("Supprimer la bible « " + s.name + " » et ses " + s.entries.length + " fiche(s) ?")) return;
      s.entries.forEach(function (e) { (e.refs || []).forEach(function (r) { core.store.del(r.key); }); });
      self.data.series.splice(self.data.series.indexOf(s), 1); core.getProject().bibleSeriesId = null; core.saveProject(); persist(); refresh();
    });
    $("bbStyle").addEventListener("change", function () { var s = series(); if (s) { s.style = this.value.trim(); persist(); } });
    $("bbFilter").addEventListener("change", renderList);
    $("bbAdd").addEventListener("click", function () { self.addEntry("Nouveau personnage", "personnage"); refresh(); });
    $("bbLink").addEventListener("click", function () { self.linkRefs(); });
    $("bbExport").addEventListener("click", function () {
      var s = series(); if (!s) return;
      var out = { format: "agnes-bible", version: 1, series: { name: s.name, style: s.style, entries: [] } }, chain = Promise.resolve();
      s.entries.forEach(function (e) {
        var ce = { name: e.name, kind: e.kind, aliases: e.aliases, dna: e.dna, auto: e.auto, notes: e.byProject, refs: [] }; out.series.entries.push(ce);
        (e.refs || []).forEach(function (r) {
          chain = chain.then(function () { return core.store.get(r.key).then(function (b) { if (b) return blobToDataUrl(b).then(function (d) { ce.refs.push(d); }); }); });
        });
      });
      chain.then(function () { core.download(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }), App.slugify(s.name) + "_bible.json"); });
    });
    $("bbImport").addEventListener("change", function () {
      var file = this.files[0]; this.value = ""; if (!file) return;
      file.text().then(function (t) {
        var j = JSON.parse(t), src = j.series || j;
        if (!src || !src.entries) throw new Error("format non reconnu");
        var s = { id: App.uid(), name: src.name || file.name.replace(/\.json$/i, ""), style: src.style || "", entries: [] }, chain = Promise.resolve();
        src.entries.forEach(function (ce) {
          var e = { id: App.uid(), name: ce.name || "Fiche", kind: ce.kind || "personnage", aliases: ce.aliases || "", dna: ce.dna || ce.description || "", auto: ce.auto !== false, byProject: {}, refs: [] };
          s.entries.push(e);
          (ce.refs || []).forEach(function (d) { chain = chain.then(function () { return self.storeRef(e, App.dataUrlToBlob(d)); }); });
        });
        self.data.series.push(s); core.getProject().bibleSeriesId = s.id; core.saveProject();
        return chain.then(function () { persist(); refresh(); core.toast("Bible « " + s.name + " » importée (" + s.entries.length + " fiches).", "ok"); });
      }).catch(function (e) { core.toast("Import de la bible : " + e.message, "err"); });
    });
    function blobToDataUrl(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(b); }); }

    // ---------- Actions fiche ----------
    function entryOf(el) { var c = el.closest("[data-entry]"), s = series(); return c && s ? s.entries.find(function (e) { return e.id === c.getAttribute("data-entry"); }) : null; }
    $("bbList").addEventListener("change", function (ev) {
      var e = entryOf(ev.target), f = ev.target.getAttribute("data-e"), b = ev.target.getAttribute("data-b"); if (!e) return;
      if (b === "addref") {
        var files = Array.prototype.slice.call(ev.target.files || []), chain = Promise.resolve();
        files.forEach(function (fl) { chain = chain.then(function () { return self.storeRef(e, fl); }); });
        return chain.then(function () { persist(); renderList(); });
      }
      if (!f) return;
      if (f === "note") { e.byProject = e.byProject || {}; e.byProject[core.getProject().id] = ev.target.value.trim(); }
      else if (f === "auto") e.auto = ev.target.checked;
      else e[f] = ev.target.value.trim();
      persist(); if (f === "name" || f === "aliases" || f === "auto") renderList();
    });
    $("bbList").addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-b]"), e = btn && entryOf(btn); if (!e) return;
      var act = btn.getAttribute("data-b"), s = series();
      if (act === "del") {
        if (!window.confirm("Supprimer la fiche « " + e.name + " » ?")) return;
        (e.refs || []).forEach(function (r) { core.store.del(r.key); }); s.entries.splice(s.entries.indexOf(e), 1); persist(); renderList(); return;
      }
      if (act === "rmref") { var r = e.refs.splice(+btn.getAttribute("data-i"), 1)[0]; if (r) core.store.del(r.key); persist(); renderList(); return; }
      if (act === "tolib") return self.toLibrary(e);
      if (act === "fromlib") return self.pickFromLibrary(e);
    });

    // ---------- Injection dans le prompt ----------
    core.addPromptFilter(function (prompt, shot, proj) { return self.apply(prompt, shot, proj); });

    // Bouton « Depuis la Bible » dans le bloc Références des cartes
    core.ui.addRefSource("📖 Depuis la Bible", function (shot) { self.pickForShot(shot); });

    // Aperçu du prompt final sur chaque plan
    core.ui.addShotAction("📖 Prompt final", function (shot) {
      var pan = core.ui.panel("bible-preview", "Prompt final du plan", true), p = core.getProject(), s = self.seriesOf(p);
      var hits = s ? s.entries.filter(function (e) { return self.matches(e, shot, p); }) : [];
      pan.body.innerHTML = '<p class="hint">Ce qui sera réellement envoyé à Agnes (prompt du plan + skills + style du projet + bible).</p>' +
        '<div class="ext-copy">' + esc(core.previewPrompt(shot)) + '</div>' +
        '<p class="hint" style="margin-top:10px">Fiches de la bible appliquées : ' + (hits.length ? hits.map(function (e) { return "<b>" + esc(e.name) + "</b>"; }).join(", ") : "aucune") + '.</p>' +
        '<button class="small-btn" id="bbCopyPrompt">Copier</button>';
      pan.body.querySelector("#bbCopyPrompt").onclick = function () { navigator.clipboard && navigator.clipboard.writeText(core.previewPrompt(shot)).then(function () { core.toast("Copié.", "ok"); }); };
      pan.open();
    });

    core.on("view:change", function (v) { if (v === "view_bible") refresh(); });
    core.on("project:change", function () { if (view.classList.contains("active")) refresh(); });
    core.store.getKV("plugin:bible").then(function (d) {
      if (d && d.series) self.data = d;
      if (!self.data.cutoff) { self.data.cutoff = Date.now(); persist(); }
      refresh();
    });
  },

  // Série de la bible d'un projet : choisie explicitement, sinon même nom de série que la fiche d'épisode
  // (onglets Publication / Épisodes / Planning). Un nouveau projet n'est jamais rattaché d'office à une autre série.
  seriesOf: function (proj) {
    if (!proj) return null;
    var list = this.data.series, id = proj.bibleSeriesId;
    if (id) return list.find(function (x) { return x.id === id; }) || null;
    if (id === null) return null; // « aucune série » choisi explicitement
    var name = proj.publish && proj.publish.serie ? String(proj.publish.serie).trim().toLowerCase() : "";
    var byName = name && list.find(function (x) { return x.name.trim().toLowerCase() === name; });
    if (byName) return byName;
    // Ancienne règle « la seule bible existante » : gardée pour les projets antérieurs, jamais pour un nouveau projet
    var legacy = !proj.createdAt || (this.data.cutoff && proj.createdAt < this.data.cutoff);
    return legacy && list.length === 1 ? list[0] : null;
  },
  names: function (e) { return [e.name].concat(String(e.aliases || "").split(",")).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 1; }); },
  mentions: function (e, text) {
    var t = " " + String(text || "").toLowerCase().normalize("NFC") + " ";
    return this.names(e).some(function (n) {
      var re = new RegExp("(^|[^\\p{L}\\p{N}])" + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^\\p{L}\\p{N}])", "u");
      return re.test(t);
    });
  },
  matches: function (e, shot, proj) {
    var lib = proj.library || [], names = this.names(e).map(function (n) { return n.toLowerCase(); });
    var refs = [shot.sourceRef, shot.startRef, shot.endRef].concat(shot.ingredients || []).filter(Boolean);
    var byRef = refs.some(function (id) {
      var it = lib.find(function (l) { return l.id === id; });
      return it && (it.bibleId === e.id || names.indexOf(String(it.name || "").trim().toLowerCase()) !== -1);
    });
    return byRef || (e.auto !== false && this.mentions(e, shot.prompt));
  },
  apply: function (prompt, shot, proj) {
    var s = this.seriesOf(proj); if (!s) return prompt;
    var self = this, add = [];
    s.entries.forEach(function (e) {
      if (!e.dna && !(e.byProject || {})[proj.id]) return;
      if (!self.matches(e, shot, proj)) return;
      [e.dna, (e.byProject || {})[proj.id]].forEach(function (x) { if (x && prompt.indexOf(x) === -1 && add.indexOf(x) === -1) add.push(x); });
    });
    if (s.style && prompt.indexOf(s.style) === -1) add.push(s.style);
    return add.length ? prompt + ", " + add.join(", ") : prompt;
  },

  addEntry: function (name, kind) {
    var s = this.series(); if (!s) return null;
    var ex = s.entries.find(function (e) { return e.name.toLowerCase() === String(name).toLowerCase(); });
    if (ex) return ex;
    var e = { id: window.AgnesApp.uid(), name: name, kind: kind || "personnage", aliases: "", dna: "", auto: true, byProject: {}, refs: [] };
    s.entries.push(e); this.persist(); return e;
  },
  // Utilisé par l'import de scénario : crée la série si besoin, puis les fiches manquantes
  ensureEntries: function (names, kind) {
    var core = this.core, App = window.AgnesApp, self = this;
    if (!this.series()) {
      var pp = core.getProject(), s = { id: App.uid(), name: (pp.publish && pp.publish.serie) || pp.name, style: "", entries: [] };
      this.data.series.push(s); core.getProject().bibleSeriesId = s.id; core.saveProject();
    }
    var created = 0;
    names.forEach(function (n) { var before = self.series().entries.length; self.addEntry(n, kind); if (self.series().entries.length > before) created++; });
    this.persist(); return created;
  },
  storeRef: function (e, blob) {
    var App = window.AgnesApp, key = "bible:" + e.id + ":" + App.uid();
    return this.core.store.put(key, blob).then(function () { return App.makeThumb(blob, 200); }).then(function (thumb) {
      e.refs = e.refs || []; e.refs.push({ key: key, thumb: thumb });
    });
  },
  toLibrary: function (e) {
    var core = this.core, proj = core.getProject(), done = 0, chain = Promise.resolve();
    (e.refs || []).forEach(function (r, i) {
      if (proj.library.some(function (l) { return l.bibleRef === r.key; })) return;
      chain = chain.then(function () {
        return core.store.get(r.key).then(function (b) {
          if (!b) return;
          return core.addToLibrary(b, { name: e.name + (e.refs.length > 1 ? " " + (i + 1) : ""), kind: e.kind === "lieu" ? "decor" : e.kind === "objet" ? "objet" : "personnage", bibleId: e.id, bibleRef: r.key }).then(function () { done++; });
        });
      });
    });
    chain.then(function () { core.toast(done ? done + " référence(s) de « " + e.name + " » ajoutée(s) à la bibliothèque." : "Déjà dans la bibliothèque de cet épisode.", "ok"); });
  },
  pickFromLibrary: function (e) {
    var core = this.core, App = window.AgnesApp, self = this, lib = core.getLibrary();
    var pan = core.ui.panel("bible-pick", "Références pour « " + e.name + " »");
    if (!lib.length) { pan.body.innerHTML = '<p class="hint">La bibliothèque de cet épisode est vide.</p>'; return pan.open(); }
    pan.body.innerHTML = '<p class="hint">Cliquez les images à ajouter à la fiche.</p><div class="row-inline">' + lib.map(function (l) {
      return '<button class="small-btn" data-lib="' + l.id + '" style="padding:4px"><img class="ext-thumb" src="' + (l.thumb || "") + '" alt="' + App.esc(l.name) + '"><br>' + App.esc(l.name) + '</button>';
    }).join("") + '</div>';
    pan.body.onclick = function (ev) {
      var b = ev.target.closest("[data-lib]"); if (!b) return;
      var it = lib.find(function (l) { return l.id === b.getAttribute("data-lib"); });
      core.getLibBlob(it).then(function (blob) {
        if (!blob) throw new Error("image indisponible");
        it.bibleId = e.id; core.saveProject();
        return self.storeRef(e, blob);
      }).then(function () { b.disabled = true; self.persist(); self.refresh(); core.toast("Ajoutée à la fiche.", "ok"); })
        .catch(function (err) { core.toast(err.message, "err"); });
    };
    pan.open();
  },
  // Copie (si besoin) les images de la fiche dans la bibliothèque de l'épisode → renvoie les éléments
  libItemsFor: function (e) {
    var core = this.core, proj = core.getProject(), items = [], chain = Promise.resolve();
    (e.refs || []).forEach(function (r, i) {
      chain = chain.then(function () {
        var ex = proj.library.find(function (l) { return l.bibleRef === r.key; });
        if (ex) { items.push(ex); return; }
        return core.store.get(r.key).then(function (b) {
          if (!b) return;
          return core.addToLibrary(b, { name: e.name + (e.refs.length > 1 ? " " + (i + 1) : ""), kind: e.kind === "lieu" ? "decor" : e.kind === "objet" ? "objet" : "personnage", bibleId: e.id, bibleRef: r.key })
            .then(function (it) { items.push(it); });
        });
      });
    });
    return chain.then(function () { return items; });
  },
  pickForShot: function (shot) {
    var self = this, core = this.core, App = window.AgnesApp, s = this.seriesOf(core.getProject());
    var pan = core.ui.panel("bible-shot", "Ajouter depuis la Bible");
    var list = s ? s.entries.filter(function (e) { return (e.refs || []).length; }) : [];
    if (!list.length) {
      pan.body.innerHTML = '<p class="hint">' + (s ? "Aucune fiche de la bible « " + App.esc(s.name) + " » n'a d'image de référence. Ajoutez-en dans l'onglet Bible." : "Aucune bible n'est reliée à ce projet (onglet Bible).") + '</p>';
      return pan.open();
    }
    var sel = shot.ingredients || [];
    pan.body.innerHTML = '<p class="hint">Cliquez un personnage ou un lieu : ses images sont ajoutées aux références du plan, et son ADN au prompt.</p>' +
      list.map(function (e) {
        var inShot = core.getProject().library.some(function (l) { return l.bibleId === e.id && sel.indexOf(l.id) !== -1; });
        return '<button class="small-btn" data-bentry="' + e.id + '" style="display:flex;gap:10px;align-items:center;width:100%;margin-bottom:6px;text-align:left"' + (inShot ? " disabled" : "") + '>' +
          '<img class="ext-thumb" src="' + (e.refs[0].thumb || "") + '" alt=""><span><b>' + App.esc(e.name) + '</b><br><span class="hint" style="margin:0">' +
          App.esc((self.KINDS.find(function (k) { return k[0] === e.kind; }) || ["", ""])[1]) + ' · ' + e.refs.length + ' image(s)' + (inShot ? " · déjà dans le plan" : "") + '</span></span></button>';
      }).join("");
    pan.body.onclick = function (ev) {
      var b = ev.target.closest("[data-bentry]"); if (!b) return;
      var e = list.find(function (x) { return x.id === b.getAttribute("data-bentry"); }); b.disabled = true;
      self.libItemsFor(e).then(function (items) {
        var max = App.settings.maxRefs || 5, cur = (shot.ingredients || []).slice(), added = 0;
        items.forEach(function (it) { if (cur.indexOf(it.id) === -1 && cur.length < max) { cur.push(it.id); added++; } });
        core.updateShot(shot.id, { ingredients: cur });
        core.toast(added ? "« " + e.name + " » ajouté au plan (" + added + " image" + (added > 1 ? "s" : "") + ")." : "Plus de place : maximum " + max + " références par plan.", added ? "ok" : "err");
      });
    };
    pan.open();
  },
  // Plans en mode ingrédients qui citent une fiche sans utiliser sa référence → on l'ajoute
  linkRefs: function () {
    var core = this.core, self = this, s = this.series(), proj = core.getProject(), n = 0;
    if (!s) return;
    core.getShots().forEach(function (sh) {
      if (!window.AgnesApp.usesRefs(sh.mode)) return;
      s.entries.forEach(function (e) {
        if (!self.mentions(e, sh.prompt)) return;
        var item = proj.library.find(function (l) { return l.bibleId === e.id; });
        if (!item || (sh.ingredients || []).indexOf(item.id) !== -1) return;
        sh.ingredients = (sh.ingredients || []).concat(item.id); n++;
      });
    });
    core.saveProject(); window.AgnesApp.renderShots();
    core.toast(n ? n + " référence(s) ajoutée(s) aux plans en mode ingrédients." : "Rien à relier (copiez d'abord les références dans la bibliothèque de l'épisode, et citez les noms dans les plans en mode ingrédients).", n ? "ok" : undefined);
  }
});
