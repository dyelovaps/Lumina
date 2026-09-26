// plugins/claude-horloge.js — horloge dans un worker pour « Piloté par Claude ».
// Chrome ralentit les minuteries d'un onglet caché (une fois par minute après quelques minutes) ; celles d'un worker
// dédié ne le sont pas : Agnes continue d'écouter le pont quand son onglet est en arrière-plan.
// Messages : { id, ms } → répond { id } après ms millisecondes.
self.onmessage = function (e) {
  var d = e.data || {};
  setTimeout(function () { self.postMessage({ id: d.id }); }, Math.max(0, Number(d.ms) || 0));
};
