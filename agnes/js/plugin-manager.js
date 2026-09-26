// js/plugin-manager.js — chargement des extensions (plugins/*.js)
window.AgnesPlugins = {
  registry: {},
  loaded: {},

  // Appelé par chaque fichier plugin : AgnesPlugins.register("id", { name, version, init(core) {} })
  register: function (id, pluginDef) {
    this.registry[id] = pluginDef;
    console.log("[Plugin] Enregistré : " + (pluginDef.name || id));
  },

  // Charge un plugin à la volée et appelle init(AgnesCore) une seule fois
  load: function (id, scriptUrl) {
    var self = this;
    if (self.loaded[id]) return Promise.resolve(self.registry[id]);
    return new Promise(function (resolve, reject) {
      function start() {
        var def = self.registry[id];
        if (!def) return reject(new Error("Le fichier " + scriptUrl + " n'enregistre pas le plugin « " + id + " »."));
        try { if (typeof def.init === "function") def.init(window.AgnesCore); }
        catch (e) { return reject(e); }
        self.loaded[id] = true;
        resolve(def);
      }
      if (self.registry[id]) return start();
      var script = document.createElement("script");
      script.src = scriptUrl;
      script.onload = start;
      script.onerror = function () { reject(new Error("Fichier introuvable : " + scriptUrl)); };
      document.head.appendChild(script);
    });
  },

  isLoaded: function (id) { return !!this.loaded[id]; },
  get: function (id) { return this.registry[id] || null; }
};
