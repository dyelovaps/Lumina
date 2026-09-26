// js/dialogue-propre.js — Répliques françaises prêtes pour la voix des modèles vidéo (portage de prod-fruits/nettoyeur.py).
// Les caractères spéciaux et la ponctuation typographique coupent la parole d'un personnage (surtout à deux) :
//   - aucun espace avant ? ! . …  ·  « ... » → « … » (le caractère)  ·  un point qui coupe la réplique en deux → « … » ;
//     le point final de la réplique reste un point
//   - guillemets, tirets, points-virgules, deux-points, apostrophes typographiques, espaces insécables → simples
//   - option phonétique (dictionnaire conçu pour Google Flow, désactivée par défaut) : prononciation + accents retirés
// Les répliques sont repérées entre « … » ou “ … ” ; la description anglaise autour n'est pas touchée.
(function () {
  "use strict";
  var PHONETIQUE = {
    "génération": "geainairation", "général": "geaineiral", "génère": "geainaire", "généré": "geaineire", "générée": "geaineire",
    "évité": "evitay", "évitée": "evitay", "terminé": "terminay", "terminée": "terminay", "joué": "jooay", "jouée": "jooay",
    "créé": "creay", "créée": "creay", "filmé": "filmay", "filmée": "filmay", "posé": "posay", "posée": "posay",
    "licencié": "lisonsyay", "licenciée": "lisonsyay", "publié": "püblyay", "publiée": "püblyay",
    "émotion": "emohsyon", "émotions": "emohsyons", "démission": "daymisyon", "médias": "medyas", "réseau": "rezo", "réseaux": "rezos",
    "société": "sosyetay", "vérité": "veritay", "intérêt": "ahntairay", "public": "püblik", "document": "dokümahnr", "documents": "dokümahnrs",
    "preuve": "pruhv", "preuves": "pruhvs", "maintenant": "mahntnahhnr", "vraiment": "vraymahnr", "bien": "byahn", "rien": "ryahn",
    "combien": "kohmbyan", "quelqu'un": "kelkuhn", "quelque": "kelkuh", "aujourd'hui": "ohjordwee", "beaucoup": "bohkoo",
    "français": "fronsay", "façon": "fason", "garçon": "garson", "ça": "sa", "vous": "voo", "tout": "too"
  };
  var LETTRE = "A-Za-zÀ-ÖØ-öø-ÿŒœÆæ";

  // Ponctuation et caractères spéciaux d'UNE réplique
  function ponctuation(t) {
    t = String(t)
      .replace(/[’‘ʼ`´]/g, "'")                 // apostrophes typographiques
      .replace(/[    ]/g, " ")             // espaces insécables / fines
      .replace(/[«»“”„"]/g, "")                                // guillemets à l'intérieur de la réplique
      .replace(/\s*[—–]\s*/g, ", ")                  // tirets cadratins / demi-cadratins
      .replace(/\s*[;:]\s*/g, ", ")                            // ; et : → virgule
      .replace(/\.{2,}/g, "…")                            // « .. » ou « ... » → …
      .replace(/\s+([?!.,…])/g, "$1")                     // aucun espace avant ? ! . , …
      .replace(/\.(?=\s*\S)/g, "…")                       // point À L'INTÉRIEUR de la réplique → … (le point final reste)
      .replace(/…{2,}/g, "…")
      .replace(/,\s*,+/g, ",").replace(/\s{2,}/g, " ").trim();
    return t;
  }
  function sansAccents(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ü/g, "u"); }
  function phonetise(t) {
    Object.keys(PHONETIQUE).forEach(function (mot) {
      var re = new RegExp("(^|[^" + LETTRE + "'])(" + mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?=$|[^" + LETTRE + "'])", "gi");
      t = t.replace(re, function (m, avant, w) { var p = PHONETIQUE[mot]; return avant + (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? p[0].toUpperCase() + p.slice(1) : p); });
    });
    return t;
  }
  function replique(t, phon) {
    t = String(t).replace(/[’‘]/g, "'");
    if (phon) t = phonetise(t);
    t = ponctuation(t);
    return phon ? sansAccents(t) : t;
  }
  // Prompt complet : chaque réplique « … » / “ … ” est nettoyée puis remise entre guillemets droits.
  function nettoie(prompt, opts) {
    var phon = !!(opts && opts.phonetique);
    return String(prompt || "").replace(/«\s*([\s\S]*?)\s*»|“\s*([\s\S]*?)\s*”/g, function (m, a, b) {
      return '"' + replique(a != null ? a : b, phon) + '"';
    });
  }
  window.AgnesDialogue = { nettoie: nettoie, replique: replique, ponctuation: ponctuation };
})();
