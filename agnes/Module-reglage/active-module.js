// Module-reglage/active-module.js — cases à cocher des extensions (Réglages) et chargement au démarrage
(function () {
  "use strict";
  var A = window.AgnesApp;
  // Ajoutez ici vos futures extensions : { key, id (nom passé à AgnesPlugins.register), label, file }
  var EXTENSIONS = [
    { key: "stills", id: "stills", label: "Stills → Clip (importer ses images numérotées + prompts, animer avec Agnes) — onglet Stills → Clip", file: "plugins/plugin-stills.js", defaultOn: true },
    { key: "extracteur", id: "extracteur", label: "Extracteur (lien → vidéo, script par transcription, images d'une vidéo) — onglet Extraire", file: "plugins/plugin-extract.js", defaultOn: true },
    { key: "scenario", id: "scenario", label: "Import de scénario (plans + dialogues + casting) — onglet Scénario", file: "plugins/plugin-script.js" },
    { key: "bible", id: "bible", label: "Bible de continuité (personnages, lieux, ADN ajouté aux prompts) — onglet Bible", file: "plugins/plugin-bible.js" },
    { key: "tts", id: "tts", label: "Voix-off & dialogues (ElevenLabs / OpenAI / micro) — onglet Voix", file: "plugins/plugin-tts.js" },
    { key: "musique", id: "musique", label: "Musique, ambiances & bruitages (import ou ElevenLabs) — onglet Son", file: "plugins/plugin-music.js" },
    { key: "episodes", id: "episodes", label: "Enchaînement d'épisodes (récap, cartons, raccord) — onglet Épisodes", file: "plugins/plugin-episodes.js" },
    { key: "etalonnage", id: "etalonnage", label: "Étalonnage & finition (looks, grain, LUT) — onglet Étalonnage", file: "plugins/plugin-grade.js" },
    { key: "ffmpeg", id: "ffmpeg-assembler", label: "Kit de montage FFmpeg (export haute qualité)", file: "plugins/plugin-ffmpeg.js" },
    { key: "social", id: "social", label: "Publication TikTok / Reels / Shorts / YouTube — onglet Publication", file: "plugins/plugin-social.js" },
    { key: "captions", id: "captions", label: "AutoCaption — sous-titres animés et stylés (TikTok, karaoké, mot par mot…), posés après la génération — onglet AutoCaption", file: "plugins/plugin-captions.js", defaultOn: true },
    { key: "atelier", id: "atelier", label: "Atelier IA — équipe d'agents IA (Agnes par défaut), Chef de production, documents (concept → scénario → prompts) — onglet Atelier IA", file: "plugins/plugin-atelier.js", defaultOn: true },
    { key: "mentions", id: "mentions", label: "Mentions dans les prompts — @[Personnage] coche sa référence, #[Skill] insère le skill à cet endroit ; suggestions en tapant @ ou #", file: "plugins/plugin-mentions.js", defaultOn: true },
    { key: "moteurs", id: "moteurs", label: "Moteurs de génération — images par Agnes (gratuit) ou par ChatGPT (votre abonnement, via le pont local de prod-fruits) — réglage dans ⚙ et bouton 🖼 du Storyboard", file: "plugins/plugin-moteurs.js", defaultOn: true },
    { key: "lumina", id: "lumina", label: "Lumina — envoyer les plans vers Grok Imagine et recevoir les rendus comme prises (actif quand Agnes est ouverte depuis l'onglet Agnes de Lumina)", file: "plugins/plugin-lumina.js", defaultOn: true },
    { key: "claude", id: "claude", label: "Piloté par Claude — Claude Code (conversation) pilote Agnes via le pont local : état, Le lot, prompts, générations, Chef de l'Atelier, export des prises (à activer aussi dans ⚙ → Piloté par Claude)", file: "plugins/plugin-claude.js", defaultOn: true },
    { key: "backup", id: "backup", label: "Sauvegarde complète — tous les projets, médias, Bible et réglages dans un .zip, et restauration (onglet Projet)", file: "plugins/plugin-backup.js", defaultOn: true },
    { key: "planning", id: "planning", label: "Planning de publication (calendrier, rythme, .ics) — onglet Planning", file: "plugins/plugin-planning.js" }
  ];
  function enabled() {
    var ex = A.settings.extensions || (A.settings.extensions = {});
    // extensions actives par défaut tant que l'utilisateur ne les a pas décochées
    EXTENSIONS.forEach(function (e) { if (e.defaultOn && ex[e.key] === undefined) ex[e.key] = true; });
    return ex;
  }
  function load(ext, silent) {
    return AgnesPlugins.load(ext.id, ext.file).then(function () {
      if (!silent) A.toast("Extension activée : " + ext.label, "ok");
    }).catch(function (err) {
      enabled()[ext.key] = false; A.persistSettings(); render();
      A.toast("Extension « " + ext.label + " » indisponible : " + err.message, "err");
    });
  }
  function render() {
    var host = document.getElementById("extensionsList"); if (!host) return;
    host.innerHTML = EXTENSIONS.map(function (e) {
      return '<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><input type="checkbox" data-ext="' + e.key + '"' +
        (enabled()[e.key] ? " checked" : "") + '><span>' + A.esc(e.label) + '</span></label>';
    }).join("");
  }
  document.getElementById("extensionsList").addEventListener("change", function (e) {
    var key = e.target.getAttribute("data-ext"); if (!key) return;
    var ext = EXTENSIONS.find(function (x) { return x.key === key; });
    enabled()[key] = e.target.checked; A.persistSettings();
    if (e.target.checked) load(ext);
    else if (AgnesPlugins.isLoaded(ext.id)) A.toast("Extension désactivée — rechargez la page pour la retirer complètement.");
  });
  // Onglet ouvert retenu : après un rechargement de la page, on y revient (une fois les extensions chargées)
  var VIEW_KEY = "agnes_last_view";
  function boot() {
    render();
    // Chargement l'un après l'autre : les onglets apparaissent toujours dans le même ordre
    EXTENSIONS.reduce(function (chain, e) { return enabled()[e.key] ? chain.then(function () { return load(e, true); }) : chain; }, Promise.resolve())
      .then(function () {
        var v = null; try { v = localStorage.getItem(VIEW_KEY); } catch (e) { }
        if (v && v !== "viewStoryboard" && document.getElementById(v) && A.showView) A.showView(v);
        AgnesCore.on("view:change", function (id) { try { localStorage.setItem(VIEW_KEY, id); } catch (e) { } });
      });
  }
  if (A.ready) boot(); else AgnesCore.on("ready", boot);
})();
