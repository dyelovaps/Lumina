// plugins/plugin-backup.js — Sauvegarde complète : tous les projets, médias, Bible, équipe de l'Atelier et réglages
// dans un seul .zip, puis restauration dans une autre copie d'Agnes (par exemple : index.html → onglet Agnes de Lumina,
// dont le stockage est séparé), sur un autre ordinateur, ou après un nettoyage du navigateur.
// Contenu du .zip : agnes-backup.json (format, date), db.json (projets), kv/*.json (données des extensions),
// local.json (réglages du navigateur), blobs/* (prises, bibliothèque, voix, musiques).
AgnesPlugins.register("backup", {
  name: "Sauvegarde complète",
  version: "1.0",
  FORMAT: "agnes-backup",

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    core.ui.addToolbarButton("project", "💾 Sauvegarde complète (.zip)", function () { self.exportAll(); });
    core.ui.addToolbarButton("project", "↺ Restaurer une sauvegarde…", function () { self.pickFile(); });
  },

  localKeys: function () {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^agnes/i.test(k)) out.push(k); }
    return out;
  },

  exportAll: function () {
    var self = this, A = this.A, core = this.core;
    if (typeof JSZip === "undefined") return core.toast("Module ZIP indisponible.", "err");
    var withKeys = window.confirm("Inclure vos clés API (Agnes, imgbb, ElevenLabs…) dans la sauvegarde ?\n\nOK = oui (pratique pour transférer vers Lumina) · Annuler = non (fichier sans clés, à partager sans risque)");
    var zip = new JSZip(), n = 0;
    A.saveDB(true);
    core.toast("Préparation de la sauvegarde…");
    var local = {};
    this.localKeys().forEach(function (k) {
      var v = localStorage.getItem(k);
      if (!withKeys && v && /key|token|secret/i.test(v)) {
        try { var o = JSON.parse(v); Object.keys(o).forEach(function (x) { if (/key|token|secret/i.test(x)) o[x] = ""; }); v = JSON.stringify(o); } catch (e) { }
      }
      local[k] = v;
    });
    zip.file("local.json", JSON.stringify(local));
    zip.file("db.json", JSON.stringify(A.db));
    return AgnesStore.kvKeys().then(function (keys) {
      return keys.filter(function (k) { return k !== "db"; }).reduce(function (chain, k) {
        return chain.then(function () { return AgnesStore.getKV(k); }).then(function (v) { zip.file("kv/" + encodeURIComponent(k) + ".json", JSON.stringify(v)); });
      }, Promise.resolve());
    }).then(function () { return AgnesStore.blobKeys(); }).then(function (keys) {
      return keys.reduce(function (chain, k) {
        return chain.then(function () { return AgnesStore.getBlob(k); }).then(function (b) {
          if (b) { zip.file("blobs/" + encodeURIComponent(k), b, { binary: true, compression: "STORE" }); n++; }
        });
      }, Promise.resolve());
    }).then(function () {
      zip.file("agnes-backup.json", JSON.stringify({ format: self.FORMAT, version: 1, at: new Date().toISOString(), projects: Object.keys(A.db.projects).length, blobs: n, withKeys: withKeys }, null, 2));
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) {
      core.download(blob, "agnes-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".zip");
      core.toast("Sauvegarde prête : " + Object.keys(A.db.projects).length + " projet(s), " + n + " fichier(s).", "ok");
    }).catch(function (e) { core.toast("Sauvegarde impossible : " + (e.message || e), "err"); });
  },

  pickFile: function () {
    var self = this, input = document.createElement("input");
    input.type = "file"; input.accept = ".zip,application/zip";
    input.onchange = function () { if (input.files[0]) self.restore(input.files[0]); };
    input.click();
  },

  // Fusion : les projets de la sauvegarde s'ajoutent (même identifiant = remplacé), les réglages déjà présents ici sont conservés.
  restore: function (file) {
    var self = this, A = this.A, core = this.core, zip, meta, incoming;
    if (typeof JSZip === "undefined") return core.toast("Module ZIP indisponible.", "err");
    JSZip.loadAsync(file).then(function (z) {
      zip = z;
      var m = zip.file("agnes-backup.json");
      if (!m) throw new Error("ce fichier n'est pas une sauvegarde complète d'Agnes (agnes-backup.json absent)");
      return m.async("string");
    }).then(function (txt) {
      meta = JSON.parse(txt);
      if (meta.format !== self.FORMAT) throw new Error("format inconnu");
      return zip.file("db.json").async("string");
    }).then(function (txt) {
      incoming = JSON.parse(txt);
      var ids = Object.keys(incoming.projects || {}), same = ids.filter(function (id) { return A.db.projects[id]; });
      var msg = "Restaurer " + ids.length + " projet(s) et " + (meta.blobs || 0) + " fichier(s) (sauvegarde du " + String(meta.at || "").slice(0, 10) + ") ?" +
        (same.length ? "\n\n" + same.length + " projet(s) déjà présents ici seront remplacés par la version de la sauvegarde." : "") +
        "\n\nLa page se rechargera à la fin.";
      if (!window.confirm(msg)) throw { cancelled: true };
      core.toast("Restauration en cours… ne fermez pas la page.");
      var blobs = zip.file(/^blobs\//);
      return blobs.reduce(function (chain, f) {
        return chain.then(function () { return f.async("blob"); }).then(function (b) {
          return AgnesStore.putBlob(decodeURIComponent(f.name.slice(6)), b);
        });
      }, Promise.resolve());
    }).then(function () {
      return zip.file(/^kv\//).reduce(function (chain, f) {
        return chain.then(function () { return f.async("string"); }).then(function (txt) {
          var key = decodeURIComponent(f.name.slice(3).replace(/\.json$/, ""));
          return AgnesStore.getKV(key).then(function (cur) {
            // Données d'extension déjà présentes (Bible, équipe de l'Atelier) : conservées, sauf si vides
            if (cur && (typeof cur !== "object" || Object.keys(cur).length)) return;
            return AgnesStore.setKV(key, JSON.parse(txt));
          });
        });
      }, Promise.resolve());
    }).then(function () {
      var lf = zip.file("local.json");
      return lf ? lf.async("string") : "{}";
    }).then(function (txt) {
      var local = JSON.parse(txt);
      Object.keys(local).forEach(function (k) {
        if (local[k] == null) return;
        var cur = localStorage.getItem(k);
        if (cur == null) { localStorage.setItem(k, local[k]); return; }
        // Réglages : on complète seulement les champs vides d'ici (clés API absentes, etc.)
        try {
          var a = JSON.parse(cur), b = JSON.parse(local[k]);
          if (a && b && typeof a === "object" && typeof b === "object") {
            Object.keys(b).forEach(function (x) { if (a[x] === undefined || a[x] === "" || a[x] === null) a[x] = b[x]; });
            // Extensions : celles cochées dans la sauvegarde le sont aussi ici (onglets Bible, Voix, Son…)
            if (b.extensions && typeof b.extensions === "object") {
              a.extensions = a.extensions || {};
              Object.keys(b.extensions).forEach(function (x) { if (b.extensions[x]) a.extensions[x] = true; });
            }
            localStorage.setItem(k, JSON.stringify(a));
          }
        } catch (e) { }
      });
      Object.keys(incoming.projects || {}).forEach(function (id) { A.db.projects[id] = incoming.projects[id]; });
      var known = {};
      (A.db.skills || []).forEach(function (s) { known[s.id] = true; });
      (incoming.skills || []).forEach(function (s) { if (!known[s.id]) A.db.skills.push(s); });
      if (incoming.currentProjectId && A.db.projects[incoming.currentProjectId]) A.db.currentProjectId = incoming.currentProjectId;
      return AgnesStore.setKV("db", JSON.parse(JSON.stringify(A.db)));
    }).then(function () {
      core.toast("Sauvegarde restaurée — rechargement…", "ok");
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) {
      if (e && e.cancelled) return;
      core.toast("Restauration impossible : " + ((e && e.message) || e), "err");
    });
  }
});
