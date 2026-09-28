// js/cles-env.js — Clés API hors de l'app : un fichier .env sur le disque (ex. D:\Rmaopn\cles\agnes.env), lu par le
// pont local (lancer_pont.bat, route /cles) et transmis à Agnes au démarrage, seule ou ouverte depuis Lumina.
// Les clés fournies par ce fichier restent EN MÉMOIRE : elles ne sont jamais écrites dans le stockage du navigateur
// (et les anciennes copies y sont effacées). Une clé absente du fichier se règle comme avant dans ⚙ ou l'extension.
// Sans pont, l'app démarre normalement ; si le mode .env était actif, un message rappelle de lancer le pont.
(function () {
  "use strict";
  var FLAG = "agnes_cles_env";            // mémorise seulement que le mode .env est actif (aucune clé)
  // Variable du .env → [portée, champ]. Portée « settings » = réglages ⚙ ; sinon identifiant de l'extension.
  var MAP = {
    AGNES_API_KEY: [["settings", "apiKey"]],
    IMGBB_API_KEY: [["settings", "imgbbKey"]],
    GEMINI_API_KEY: [["atelier", "keys.gemini"]],
    GROQ_API_KEY: [["atelier", "keys.groq"]],
    OPENROUTER_API_KEY: [["atelier", "keys.openrouter"]],
    MISTRAL_API_KEY: [["atelier", "keys.mistral"]],
    ATELIER_AUTRE_API_KEY: [["atelier", "keys.custom"]],
    OPENAI_API_KEY: [["extracteur", "openaiKey"], ["tts", "openaiKey"]],
    ELEVENLABS_API_KEY: [["tts", "elevenKey"], ["musique", "elevenKey"]]
  };
  var env = {}, cfgs = {};

  function fields(scope) {             // champs de cette portée fournis par le .env : [[chemin, valeur]]
    var out = [];
    Object.keys(MAP).forEach(function (v) {
      if (!env[v]) return;
      MAP[v].forEach(function (t) { if (t[0] === scope) out.push([t[1].split("."), env[v]]); });
    });
    return out;
  }
  function setPath(o, p, val) { for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== "object") o[p[i]] = {}; o = o[p[i]]; } o[p[p.length - 1]] = val; }
  function delPath(o, p) { for (var i = 0; i < p.length - 1; i++) { if (!o || typeof o !== "object") return; o = o[p[i]]; } if (o && typeof o === "object") delete o[p[p.length - 1]]; }
  function target(scope) { return scope === "settings" ? (window.AgnesApp && window.AgnesApp.settings) : cfgs[scope]; }
  function fill(scope) { var o = target(scope); if (!o) return 0; var f = fields(scope); f.forEach(function (x) { setPath(o, x[0], x[1]); }); return f.length; }
  function toast(msg, type) {
    var tries = 0;
    (function go() { if (window.AgnesApp && window.AgnesApp.toast) window.AgnesApp.toast(msg, type); else if (tries++ < 20) setTimeout(go, 300); })();
  }
  function pont() {
    try { var m = JSON.parse(localStorage.getItem("agnes_plugin_moteurs") || "{}"); if (m.pont) return String(m.pont).replace(/\/$/, ""); } catch (e) { }
    return "http://127.0.0.1:8177";
  }

  var C = window.AgnesCles = {
    MAP: MAP, actif: false, noms: [],
    // Appelé par core.pluginSettings : l'extension reçoit ses clés dès qu'elles sont connues
    register: function (scope, obj) { cfgs[scope] = obj; fill(scope); },
    remplir: function (scope) { return fill(scope); },
    // Copie à enregistrer : sans les clés venues du .env
    strip: function (scope, obj) {
      var f = fields(scope); if (!f.length) return obj;
      var copy = JSON.parse(JSON.stringify(obj)); f.forEach(function (x) { delPath(copy, x[0]); }); return copy;
    },
    appliquer: function (cles) {
      env = {}; Object.keys(MAP).forEach(function (v) { if (cles && cles[v]) env[v] = String(cles[v]); });
      C.noms = Object.keys(env); C.actif = C.noms.length > 0;
      if (!C.actif) return 0;
      var n = fill("settings"); Object.keys(cfgs).forEach(function (s) { n += fill(s); });
      // purge des anciennes copies enregistrées dans le navigateur
      try { if (window.AgnesApp && window.AgnesApp.persistSettings) window.AgnesApp.persistSettings(); } catch (e) { }
      Object.keys(cfgs).forEach(function (s) { try { if (cfgs[s].save) cfgs[s].save(); } catch (e) { } });
      try { localStorage.setItem(FLAG, "1"); } catch (e) { }
      return n;
    },
    charger: function () {
      var wasActive = false; try { wasActive = localStorage.getItem(FLAG) === "1"; } catch (e) { }
      return fetch(pont() + "/cles", { cache: "no-store" }).then(function (r) {
        return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; });
      }).then(function (j) {
        C.appliquer(j.cles || {});
        if (C.actif) toast("Clés chargées depuis " + (j.fichier || "le fichier .env") + " : " + C.noms.length + ".", "ok");
      }).catch(function (e) {
        if (wasActive) toast("Clés API non chargées (" + (e.message || e) + ") : lancez lancer_pont.bat puis rechargez Agnes.", "err");
      });
    }
  };
  C.charger();
})();
