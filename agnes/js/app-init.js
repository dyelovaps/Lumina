// js/app-init.js — démarrage
(function () {
  "use strict";
  var A = window.AgnesApp;
  AgnesCore._bind(A);
  A.loadSettings();
  A.initUI();
  A.initQueueUI();
  A.initLibrary();
  A.initSkillsBatch();
  A.initMontage();
  function start() {
    A.refreshToolDefaults();
    A.render();
    A.resumeInterrupted();
    A.ready = true;
    AgnesCore.emit("ready", null);
    if (!A.settings.apiKey) A.toast("Bienvenue — ajoutez votre clé API Agnes dans les réglages (⚙) pour générer.");
    else if (A.migratedModels) A.toast("Modèles Agnes mis à jour (Agnes Video v2.0 est retiré le 25/09/2026) : " + A.migratedModels.join(" · ") + ".", "ok");
  }
  A.loadDB().then(start, function (e) {
    console.error("[Agnes] Chargement du projet impossible :", e);
    try { start(); } catch (e2) { console.error(e2); }
    A.toast("Chargement partiel : " + (e && e.message || e));
  });
})();
