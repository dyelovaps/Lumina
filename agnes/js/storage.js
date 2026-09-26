// js/storage.js — stockage persistant des médias (IndexedDB), avec repli en mémoire
(function () {
  "use strict";
  var DB_NAME = "agnes_studio", VERSION = 1, dbPromise = null;
  var memory = { blobs: new Map(), kv: new Map() }, useMemory = false;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("IndexedDB indisponible"));
      var r, timer = setTimeout(function () { reject(new Error("délai d'ouverture dépassé")); }, 4000);
      try { r = indexedDB.open(DB_NAME, VERSION); } catch (e) { clearTimeout(timer); return reject(e); }
      r.onblocked = function () { clearTimeout(timer); reject(new Error("base bloquée par un autre onglet")); };
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs");
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      };
      r.onsuccess = function () { clearTimeout(timer); resolve(r.result); };
      r.onerror = function () { clearTimeout(timer); reject(r.error); };
    }).catch(function (e) {
      console.warn("[Stockage] IndexedDB indisponible, stockage en mémoire seulement :", e);
      useMemory = true; return null;
    });
    return dbPromise;
  }
  function run(store, mode, op) {
    return open().then(function (d) {
      if (useMemory || !d) return op(null, memory[store]);
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode), req = op(t.objectStore(store));
        t.oncomplete = function () { resolve(req ? req.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }
  function mem(fn) { return function (s, m) { return s ? fn.idb(s) : fn.mem(m); }; }

  window.AgnesStore = {
    isMemoryOnly: function () { return useMemory; },
    putBlob: function (k, b) { return run("blobs", "readwrite", mem({ idb: function (s) { return s.put(b, k); }, mem: function (m) { m.set(k, b); } })); },
    getBlob: function (k) { return run("blobs", "readonly", mem({ idb: function (s) { return s.get(k); }, mem: function (m) { return m.get(k); } })); },
    delBlob: function (k) { return run("blobs", "readwrite", mem({ idb: function (s) { return s.delete(k); }, mem: function (m) { m.delete(k); } })); },
    blobKeys: function () { return run("blobs", "readonly", mem({ idb: function (s) { return s.getAllKeys(); }, mem: function (m) { return Array.from(m.keys()); } })); },
    setKV: function (k, v) { return run("kv", "readwrite", mem({ idb: function (s) { return s.put(v, k); }, mem: function (m) { m.set(k, v); } })); },
    kvKeys: function () { return run("kv", "readonly", mem({ idb: function (s) { return s.getAllKeys(); }, mem: function (m) { return Array.from(m.keys()); } })); },
    getKV: function (k) { return run("kv", "readonly", mem({ idb: function (s) { return s.get(k); }, mem: function (m) { return m.get(k); } })); },
    estimate: function () { return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null); },
    persist: function () { return navigator.storage && navigator.storage.persist ? navigator.storage.persist() : Promise.resolve(false); }
  };
})();
