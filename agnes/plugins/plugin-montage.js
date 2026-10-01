// plugins/plugin-montage.js — Montage (01/10/2026), étape 1 : pôle Montage + montage par carte
// Onglet « Montage » = un pôle : une barre de sous-onglets mène aux modules de montage existants (Assemblage, Voix, Son,
// AutoCaption, Étalonnage, Épisodes, Publication) — chacun reste une extension indépendante : désactivée = sous-onglet
// absent ; Montage retiré = tout comme avant. Option « Ranger les onglets de montage dans Montage » : leurs onglets du
// haut sont masqués (jamais supprimés), on y va par les sous-onglets.
// Section « Par carte » : chaque vidéo de carte devient une vidéo prête à publier, via le pont local (prod-fruits,
// montage_carte.py, ffmpeg) : format au choix (1080×1920 pour le vertical, Lanczos), voix au max sans casse (-14 LUFS, crête -1 dBTP), vitesse 1,00–1,25,
// carton de fin (texte des notes de la carte, fondu ou machine à écrire), pauses resserrées au choix par carte (coupes),
// sous-titres karaoké au choix par carte (étape 2) : Whisper d'Extraire minute les mots dans Agnes (gardés sur la carte),
// le pont y cale le texte EXACT de la réplique (« … » du prompt) ; le STYLE et le dessin des sous-titres sont ceux de
// l'extension AutoCaption (un seul endroit pour les régler) ; .srt à côté du final. Sortie : <journée>\Final\Carte NN - <perso> - final.mp4 + compte rendu.
// Lecteur (01/10) : même lecteur vidéo qu'Extraire, plus une couche transparente qui dessine carton et sous-titres et saute
// les coupes, à la vitesse choisie : chaque réglage se voit tout de suite, sans rendu. « Monter » fabrique le fichier final.
// Format de sortie (01/10) : « comme la vidéo » par défaut (9:16, 16:9, 1:1, 4:5… sans recadrage) ou imposé ; le lecteur
// prend la forme de la vidéo finale, carton et sous-titres se placent en proportion de l'image.
// Même moteur pour un agent ou Claude : python montage_carte.py "<vidéo>" (voir docs/28-montage.md).
// API : AgnesPlugins.get("montage").monterCarte(numéro, réglages?) → Promise(résultat du pont).
AgnesPlugins.register("montage", {
  name: "Montage",
  version: "1.0",
  PONT: "http://127.0.0.1:8177",
  // Modules rangés dans le pôle, dans cet ordre (id de la vue, libellé). Seuls ceux présents s'affichent.
  MODULES: [["view_montage", "Par carte"], ["viewMontage", "Assemblage"], ["view_voix", "Voix"], ["view_son", "Son"],
    ["view_captions", "AutoCaption"], ["view_etalonnage", "Étalonnage"], ["view_episodes", "Épisodes"], ["view_publication", "Publication"]],
  DEFAUTS: { vitesse: 1, voix: true, carton: true, carton_duree: 1.8, police: "Montserrat-ExtraBold.ttf", taille: 76,
    couleur: "#FFFFFF", fond: "#000000", fond_opacite: 0.45, assombrir: 0, position: "centre", remplacer: false, ranger: false,
    animation: "fondu", pause_courte: 0.15, pause_longue: 0.4, pauses_longues: 1, st_avant_carton: true, format: "auto" },
  FORMATS: { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1080, 1080], "4:5": [1080, 1350] },
  // Police du carton (fichier du pont) → police du navigateur pour le lecteur
  POLICES_CSS: { "Montserrat-ExtraBold.ttf": ["800", "Montserrat"], "Montserrat-Bold.ttf": ["700", "Montserrat"], "Montserrat-Black.ttf": ["900", "Montserrat"],
    "Montserrat-SemiBold.ttf": ["600", "Montserrat"], "arialbd.ttf": ["bold", "Arial"], "arial.ttf": ["normal", "Arial"], "bahnschrift.ttf": ["normal", "Bahnschrift"],
    "segoeuib.ttf": ["bold", "Segoe UI"], "segoeui.ttf": ["normal", "Segoe UI"], "calibrib.ttf": ["bold", "Calibri"], "verdanab.ttf": ["bold", "Verdana"],
    "trebucbd.ttf": ["bold", "Trebuchet MS"], "impact.ttf": ["normal", "Impact"] },
  // Réglages qui changent le minutage (coupes, durée, carton, mots) : l'aperçu est recalculé par le pont
  PLAN: /^(vitesse|carton|carton_duree|pause_courte|pause_longue|pauses_longues|st_avant_carton|format)$/,

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.cfg = core.pluginSettings("montage", Object.assign({ pont: this.PONT }, this.DEFAUTS));
    this.etats = {}; this.polices = null;
    this.style();
    this.view = core.ui.addTab("montage", "Montage", '<div id="mtBody"></div>');
    this.tabBtn = document.querySelector('#tabBar .tab[data-view="view_montage"]');
    var nav = document.createElement("div"); nav.id = "mtSubnav"; nav.className = "mt-subnav";
    document.getElementById("tabBar").insertAdjacentElement("afterend", nav);
    this.nav = nav;
    nav.addEventListener("click", function (e) { var b = e.target.closest("[data-mt-view]"); if (b) self.A.showView(b.getAttribute("data-mt-view")); });
    this.view.addEventListener("click", function (e) { var b = e.target.closest("[data-mt]"); if (b) self.action(b); });
    this.view.addEventListener("change", function (e) { self.champ(e.target); });
    this.view.addEventListener("input", function (e) {
      if (e.target.getAttribute("data-mtcap") || e.target.getAttribute("data-mtseek")) self.champ(e.target);
      else if (e.target.getAttribute("data-mtk")) self.texteDirect(e.target);   // carton : visible à chaque lettre
    });
    core.on("view:change", function (id) { self.pole(id); if (id === "view_montage") self.render(); else self.arreter(); });
    core.on("project:change", function () { if (self.visible()) self.render(); });
    core.on("render", function () { self.pole(self.vueActive()); });
    this.pole(this.vueActive());
  },

  // ---------- pôle et sous-onglets ----------
  vueActive: function () { var v = document.querySelector(".shell > .view.active"); return v ? v.id : ""; },
  visible: function () { return this.view.classList.contains("active"); },
  modules: function () { return this.MODULES.filter(function (m) { return document.getElementById(m[0]); }); },
  pole: function (id) {
    var self = this, mods = this.modules(), dans = mods.some(function (m) { return m[0] === id; });
    this.nav.innerHTML = mods.map(function (m) {
      return '<button class="mt-sub" data-mt-view="' + m[0] + '" aria-selected="' + (m[0] === id) + '">' + self.A.esc(m[1]) + "</button>";
    }).join("");
    this.nav.style.display = dans ? "" : "none";
    if (dans && this.tabBtn) this.tabBtn.setAttribute("aria-selected", "true");
    // Option « ranger » : onglets du haut des modules masqués (réversible), sauf Montage lui-même
    mods.forEach(function (m) {
      if (m[0] === "view_montage") return;
      var b = document.querySelector('#tabBar .tab[data-view="' + m[0] + '"]');
      if (b) b.style.display = self.cfg.ranger ? "none" : "";
    });
  },

  // ---------- pont ----------
  pont: function () { return String(this.cfg.pont || this.PONT).replace(/\/+$/, ""); },
  appel: function (methode, route, corps) {
    var init = { method: methode };
    if (corps !== undefined) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(corps); }
    return fetch(this.pont() + route, init).then(function (r) { return r.json().then(function (j) { j._code = r.status; return j; }); },
      function () { throw new Error("pont local injoignable (lancer_pont.bat)"); });
  },
  chargerPolices: function () {
    var self = this;
    // pont ancien (lancé avant l'installation de Montage) : il répond « not found » → à relancer
    return this.appel("GET", "/montage/polices").then(function (j) { self.ancien = !j.polices; self.polices = j.polices || []; },
      function () { self.polices = null; });
  },

  // ---------- cartes ----------
  cartes: function () { return this.A.sortedShots(this.core.getProject()); },
  // Carton lu dans les notes : « CARTON DE FIN (…) : « Abonne-toi pour la suite. » + « Suite à 12 h 30 » »
  cartonDesNotes: function (notes) {
    var lignes = String(notes || "").split(/\r?\n/);
    for (var i = 0; i < lignes.length; i++) {
      if (!/carton\s+de\s+fin/i.test(lignes[i])) continue;
      var apres = lignes[i].indexOf(":") !== -1 ? lignes[i].slice(lignes[i].indexOf(":") + 1) : lignes[i];
      var m = apres.match(/«\s*([^»]+?)\s*»/g);
      if (m) return { texte: m[0].replace(/^«\s*|\s*»$/g, ""), sous: m[1] ? m[1].replace(/^«\s*|\s*»$/g, "") : "" };
      var reste = apres.replace(/^\W+/, "").trim();
      if (reste) return { texte: reste, sous: "" };
    }
    return { texte: "", sous: "" };
  },
  carton: function (shot) {
    var m = shot.montage || {};
    if (m.carton !== undefined) return { texte: m.carton || "", sous: m.sous || "" };
    return this.cartonDesNotes(shot.notes);
  },
  // Vidéo de la carte dans Production : chemin de la prise Flow, sinon dossier de classement de la carte
  video: function (shot) {
    var A = this.A, t = A.selectedTake(shot);
    if (t && t.kind === "video" && t.localPath) return { chemin: t.localPath, prise: t };
    var loc = A.classementLocal ? A.classementLocal(shot) : null;
    if (!loc) return { chemin: null, prise: t && t.kind === "video" ? t : null };
    return { chemin: loc.video + "/" + loc.nom + ".mp4", prise: t && t.kind === "video" ? t : null };
  },
  reglages: function (shot) {
    var c = this.cfg, k = this.carton(shot), r = {};
    Object.keys(this.DEFAUTS).forEach(function (x) { if (x !== "ranger") r[x] = c[x]; });
    r.carton_texte = k.texte; r.carton_sous_texte = k.sous;
    r.resserrer = !!(shot.montage && shot.montage.resserrer);   // par carte : coupes dans les pauses
    r.karaoke = !!(shot.montage && shot.montage.karaoke);       // par carte : sous-titres karaoké
    return r;
  },

  // Réplique exacte : le texte entre « » du prompt vidéo de la carte
  replique: function (shot) {
    var m = String(shot.prompt || "").match(/«\s*([^»]{3,}?)\s*»/);
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  },
  // Mots minutés par Whisper (Extraire), gardés sur la carte pour la prise choisie : pas de nouvelle écoute à chaque montage
  mots: function (shot, v, etat) {
    var self = this, cle = v.prise ? v.prise.id : v.chemin, m = shot.montage || {};
    if (m.mots && m.mots.cle === cle && m.mots.liste && m.mots.liste.length) return Promise.resolve(m.mots.liste);
    var ex = window.AgnesPlugins.isLoaded("extracteur") ? window.AgnesPlugins.get("extracteur") : null;
    if (!ex || !ex.motsBlob) return Promise.reject(new Error("sous-titres karaoké : activez l'extension Extracteur (Whisper) dans les réglages"));
    var blob = v.prise ? this.A.getTakeBlobOrFetch(v.prise) : fetch(this.pont() + "/classement/lire?chemin=" + encodeURIComponent(v.chemin)).then(function (r) { return r.ok ? r.blob() : null; });
    return Promise.resolve(blob).then(function (b) {
      if (!b) throw new Error("vidéo de la carte illisible pour Whisper");
      return ex.motsBlob(b, function (t) { etat({ statut: "en_cours", etape: "Whisper : " + t }); });
    }).then(function (liste) {
      if (!liste.length) throw new Error("Whisper n'a entendu aucun mot dans cette vidéo");
      shot.montage = Object.assign({}, shot.montage || {}, { mots: { cle: cle, liste: liste, date: new Date().toLocaleString("fr-FR") } });
      self.core.saveProject();
      return liste;
    });
  },

  captions: function () {
    var P = window.AgnesPlugins;
    return P.isLoaded("captions") && P.get("captions").assFromChunks ? P.get("captions") : null;
  },
  motsSortie: function (plan) { return (plan.mots || []).map(function (m) { return { text: m.mot, start: m.debut, end: m.fin }; }); },

  // ---------- lecteur (aperçu sans rendu) ----------
  // Le lecteur lit la vidéo d'origine ; la couche dessine à « o », le temps de la vidéo finale (coupes et vitesse).
  versSortie: function (t, garder) {
    var o = 0;
    for (var i = 0; i < garder.length; i++) { var a = garder[i][0], b = garder[i][1]; if (t <= b) return o + Math.max(0, t - a); o += b - a; }
    return o;
  },
  versSource: function (o, garder) {
    for (var i = 0; i < garder.length; i++) { var a = garder[i][0], b = garder[i][1]; if (o <= b - a) return a + o; o -= b - a; }
    return garder.length ? garder[garder.length - 1][1] : 0;
  },
  // Taille de la vidéo finale : même règle que le moteur (montage_carte.py, dimensions)
  dims: function (vw, vh) {
    var F = this.FORMATS, f = this.cfg.format;
    if (F[f]) return F[f];
    if (!vw || !vh) return [1080, 1920];
    for (var k in F) if (Math.abs(vw / vh - F[k][0] / F[k][1]) < 0.01) return F[k];
    var e = 1080 / Math.min(vw, vh);
    return [Math.round(vw * e / 2) * 2, Math.round(vh * e / 2) * 2];
  },
  texteDirect: function (el) {
    var id = el.getAttribute("data-mtk"), shot = this.cartes().find(function (s) { return s.id === id; }); if (!shot) return;
    var cur = this.carton(shot);
    shot.montage = Object.assign({}, shot.montage || {}, { carton: cur.texte, sous: cur.sous });
    shot.montage[el.getAttribute("data-mtf") === "sous" ? "sous" : "carton"] = el.value.trim();   // enregistré en quittant la case
  },
  ouvrirApercu: function (shot) {
    var self = this, v = this.video(shot), ap = this.ap;
    if (!v.chemin && !v.prise) return this.core.toast("Cette carte n'a pas encore de vidéo.", "err");
    if (ap && ap.url && ap.objet) URL.revokeObjectURL(ap.url);
    ap = this.ap = { id: shot.id, plan: null, chunks: [], msg: "Chargement…" };
    // vidéo en mémoire (Blob) : le lecteur peut se déplacer librement dedans
    var blob = v.prise ? this.A.getTakeBlobOrFetch(v.prise)
      : fetch(this.pont() + "/classement/lire?chemin=" + encodeURIComponent(v.chemin)).then(function (r) { return r.ok ? r.blob() : null; }, function () { return null; });
    Promise.resolve(blob).then(function (b) {
      if (self.ap !== ap) return;
      if (!b) { self.ap = null; return self.core.toast("Vidéo de la carte illisible (pont local lancé ?)", "err"); }
      ap.url = URL.createObjectURL(b); ap.objet = true;
      self.render();
      self.chargerPlan();
    });
  },
  chargerPlan: function () {
    var self = this, ap = this.ap; if (!ap) return;
    var shot = this.cartes().find(function (s) { return s.id === ap.id; }); if (!shot) return;
    var v = this.video(shot), r = this.reglages(shot), etat = function (e) { ap.msg = e.etape || ""; self.majApercu(); };
    clearTimeout(this._planT);
    this._planT = setTimeout(function () {
      if (!v.chemin) { ap.msg = "Carte non classée : aperçu sans coupes ni sous-titres (cliquez « Classer »)."; ap.plan = null; return self.majApercu(); }
      var cap = self.captions(), mots = r.karaoke && cap ? self.mots(shot, v, etat).catch(function (e) { ap.msg = e.message; return null; }) : Promise.resolve(null);
      mots.then(function (liste) {
        if (liste) { r.mots = liste; r.replique = self.replique(shot); }
        ap.msg = "Calcul des coupes…"; self.majApercu();
        return self.appel("POST", "/montage/apercu", { video: v.chemin, reglages: r });
      }).then(function (plan) {
        if (self.ap !== ap) return;
        if (plan.error) { ap.msg = plan.introuvable ? "Vidéo pas encore dans Production : aperçu sans coupes (elle y sera copiée au montage)." : plan.error; ap.plan = null; return self.majApercu(); }
        ap.plan = plan; ap.chunks = r.karaoke && cap ? cap.chunksFromWords(self.motsSortie(plan)) : [];
        ap.msg = ""; self.majApercu();
      }, function (e) { ap.msg = e.message || String(e); self.majApercu(); });
    }, 250);
  },
  majApercu: function () {
    var el = this.view.querySelector("#mtApMsg"), ap = this.ap; if (!el || !ap) return;
    var p = ap.plan, fr = function (x) { return (Math.round(x * 100) / 100).toString().replace(".", ","); };
    el.textContent = ap.msg || (p ? "Durée finale " + fr(p.duree_sortie) + " s" + (p.pauses && p.pauses.length ? " · " + p.pauses.length + " pause(s) resserrée(s)" : "") +
      (p.carton ? " · carton à " + fr(p.t0) + " s" : "") + (p.mots && p.mots.length ? " · " + p.mots.length + " mots sous-titrés" : "") : "");
    var tl = this.view.querySelector("[data-mtseek]"); if (tl && p) tl.max = p.duree_sortie;
  },
  arreter: function () {
    if (this._raf) cancelAnimationFrame(this._raf); this._raf = null;
    var vid = this.view && this.view.querySelector("#mtApVideo"); if (vid) vid.pause();
  },
  boucle: function () {
    var self = this;
    if (this._raf) cancelAnimationFrame(this._raf);
    var tour = function () {
      self._raf = requestAnimationFrame(tour);
      var vid = self.view.querySelector("#mtApVideo"), cv = self.view.querySelector("#mtApCanvas"), ap = self.ap;
      if (!vid || !cv || !ap || !self.visible()) return;
      var p = ap.plan, g = p ? p.garder : [[0, vid.duration || 0]], v = p ? p.vitesse : self.cfg.vitesse || 1;
      if (Math.abs(vid.playbackRate - v) > 0.001) { vid.playbackRate = v; vid.preservesPitch = true; }
      var s = vid.currentTime;
      // coupes : on saute au morceau suivant
      if (p && !vid.paused) {
        var dedans = g.some(function (x) { return s >= x[0] - 0.02 && s < x[1]; });
        if (!dedans) { var n = g.find(function (x) { return x[0] > s; }); if (n) vid.currentTime = n[0]; else vid.pause(); }
      }
      var d = p && p.largeur ? [p.largeur, p.hauteur] : self.dims(vid.videoWidth, vid.videoHeight);
      if (cv.width !== Math.round(d[0] / 2) || cv.height !== Math.round(d[1] / 2)) {
        cv.width = Math.round(d[0] / 2); cv.height = Math.round(d[1] / 2);
        var ecran = cv.parentNode; ecran.style.aspectRatio = d[0] + " / " + d[1]; ecran.style.width = d[0] > d[1] ? "520px" : "300px";
      }
      var o = self.versSortie(s, g) / v;
      var tl = self.view.querySelector("[data-mtseek]"); if (tl && document.activeElement !== tl) tl.value = o;
      var tm = self.view.querySelector("#mtApTemps"); if (tm) tm.textContent = o.toFixed(1).replace(".", ",") + " s";
      self.dessiner(cv, o, p, d[0], d[1]);
    };
    tour();
  },
  dessiner: function (cv, o, p, Wf, Hf) {
    Wf = Wf || 1080; Hf = Hf || 1920;
    var ctx = cv.getContext("2d"), W = cv.width, H = cv.height, k = W / Wf, c = this.cfg, ap = this.ap, e = Math.min(Wf, Hf) / 1080;
    ctx.clearRect(0, 0, W, H);
    var shot = this.cartes().find(function (s) { return s.id === ap.id; }); if (!shot) return;
    var cap = this.captions();
    if (cap && ap.chunks.length) {
      var ch = ap.chunks.find(function (x) { return o >= x.start && o < x.end; });
      if (ch) cap.drawChunk(ctx, W, H, ch, o, cap.state().style);
    }
    var kt = this.carton(shot), t0 = p ? p.t0 : Infinity;
    if (!c.carton || !kt.texte || o < t0) return;
    if (c.assombrir > 0) { ctx.fillStyle = "rgba(0,0,0," + c.assombrir + ")"; ctx.fillRect(0, 0, W, H); }
    var taille = Math.floor(c.taille * e), sous = Math.max(Math.floor(30 * e), Math.floor(taille * 0.6)), marge = Math.floor(70 * e);
    var L1 = this.lignes(kt.texte, Math.max(8, Math.floor((Wf - 2 * marge) / (0.56 * taille))));
    var L2 = this.lignes(kt.sous, Math.max(10, Math.floor((Wf - 2 * marge) / (0.56 * sous))));
    var pas = Math.floor(taille * 1.5), pasS = Math.floor(sous * 1.6), ecart = Math.floor(taille * 0.55);
    var hTot = L1.length * pas + (L2.length ? ecart + L2.length * pasS : 0);
    var y = Math.floor(Hf * (c.position === "centre" ? 0.5 : 0.72) - hTot / 2);
    var items = L1.map(function (x) { return [x, taille, pas]; }).concat(L2.map(function (x) { return [x, sous, pasS]; }));
    var total = items.reduce(function (a, x) { return a + x[0].length; }, 0) || 1;
    var dt = Math.min(1.2, Math.max(0.4, c.carton_duree * 0.6)) / total, deja = Math.floor((o - t0) / dt) + 1, kk = 0;
    var pc = this.POLICES_CSS[c.police] || ["bold", "Arial"], self = this;
    ctx.save(); ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.globalAlpha = c.animation === "machine" ? 1 : Math.min(1, (o - t0) / 0.3);
    items.forEach(function (it, n) {
      if (n === L1.length && L2.length) y += ecart;
      var texte = it[0], t = it[1];
      ctx.font = pc[0] + " " + Math.round(t * k) + 'px "' + pc[1] + '", Arial, sans-serif';
      var plein = ctx.measureText(texte).width, x0 = (W - plein) / 2;
      var vu = c.animation === "machine" ? texte.slice(0, Math.max(0, Math.min(texte.length, deja - kk))) : texte;
      kk += texte.length;
      if (vu) {
        var w = ctx.measureText(vu).width, ph = t * 0.35 * k, pv = t * 0.2 * k;
        if (c.fond_opacite > 0) { ctx.fillStyle = self.rgba(c.fond, c.fond_opacite); ctx.fillRect(x0 - ph, y * k - pv, w + 2 * ph, t * 1.2 * k + 2 * pv); }
        ctx.lineWidth = 2 * k * 2; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.strokeText(vu, x0, y * k);
        ctx.fillStyle = c.couleur; ctx.fillText(vu, x0, y * k);
      }
      y += it[2];
    });
    ctx.restore();
  },
  rgba: function (hex, a) { var h = String(hex).replace("#", ""); return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; },
  // Même coupure de lignes que le moteur (montage_carte.py, lignes) : longueurs voisines
  lignes: function (texte, parLigne) {
    texte = String(texte || "").trim(); if (!texte) return [];
    var n = Math.ceil(texte.length / Math.max(1, parLigne));
    if (n > 1) parLigne = Math.min(parLigne, Math.ceil(texte.length / n) + 4);
    var out = [], cur = "";
    texte.split(/\s+/).forEach(function (m) { if (cur && cur.length + 1 + m.length > parLigne) { out.push(cur); cur = m; } else cur = (cur + " " + m).trim(); });
    if (cur) out.push(cur);
    return out;
  },
  htmlApercu: function () {
    var esc = this.A.esc, ap = this.ap, cap = this.captions(), self = this;
    if (!ap) return "";
    var shot = this.cartes().find(function (s) { return s.id === ap.id; }); if (!shot) return "";
    var n = this.cartes().indexOf(shot) + 1, st = cap ? cap.state().style : null;
    var curseur = function (f, label, min, max, pas) {
      return '<div class="field"><label>' + label + '</label><span class="mt-range"><input type="range" data-mtcap="' + f + '" min="' + min + '" max="' + max + '" step="' + pas + '" value="' + esc(st[f]) + '"><output>' + esc(st[f]) + "</output></span></div>";
    };
    return '<div class="card mt-apercu"><h3>Aperçu — Carte ' + (n < 10 ? "0" : "") + n + "</h3>" +
      '<div class="mt-ap-grille"><div class="mt-ecran">' +
      '<video id="mtApVideo" controls playsinline preload="auto" src="' + esc(ap.url || "") + '"></video>' +
      '<canvas id="mtApCanvas" width="540" height="960"></canvas></div>' +
      '<div class="mt-ap-cote">' +
      '<div class="row-inline"><button class="small-btn" data-mt="lecture">Lire / Pause</button><span id="mtApTemps" class="hint">0 s</span></div>' +
      '<div class="field"><label>Position dans la vidéo finale</label><input type="range" data-mtseek="1" min="0" max="10" step="0.01" value="0"></div>' +
      '<p class="hint" id="mtApMsg"></p>' +
      (st ? "<h4>Sous-titres (style AutoCaption)</h4>" + curseur("size", "Taille (% de l'image)", 3, 14, 0.1) + curseur("margin", "Hauteur (marge en bas, % de l'image)", 0, 45, 1) +
        '<button class="small-btn" data-mt="autocaption">Tous les réglages du style (AutoCaption)</button>'
        : '<p class="hint">Sous-titres : activez l\'extension AutoCaption pour les voir ici.</p>') +
      '<p class="hint">Carton : réglages juste en dessous (« Carton de fin ») ; le texte se modifie sur la carte. Tout changement se voit ici sans rendu ; « Monter cette carte » fabrique le fichier final.</p>' +
      '<button class="small-btn" data-mt="fermer-apercu">Fermer l\'aperçu</button>' +
      "</div></div></div>";
  },

  // ---------- montage ----------
  monterCarte: function (numero, reglages) {
    var shot = this.cartes()[numero - 1];
    if (!shot) return Promise.reject(new Error("carte " + numero + " introuvable"));
    return this.monter(shot, reglages);
  },
  monter: function (shot, reglages) {
    var self = this, v = this.video(shot), id = shot.id;
    var r = Object.assign(this.reglages(shot), reglages || {});
    var etat = function (s) { self.etats[id] = s; self.majLigne(shot); };
    if (!v.chemin) return Promise.reject(new Error("carte non classée : cliquez « Classer » sur la carte (thématique locale) avant le montage"));
    var envoyer = function () { return self.appel("POST", "/montage/carte", { video: v.chemin, reglages: r }); };
    var prep = Promise.resolve();
    if (r.karaoke) {
      var cap = this.captions();
      if (!cap) return Promise.reject(new Error("sous-titres karaoké : activez l'extension AutoCaption (c'est elle qui donne le style)"));
      etat({ statut: "en_cours", etape: "Whisper : préparation" });
      // mots calés par le pont (aperçu), puis fichier .ass et .srt faits par AutoCaption avec son style
      prep = this.mots(shot, v, etat).then(function (liste) {
        r.mots = liste; r.replique = self.replique(shot);
        return self.appel("POST", "/montage/apercu", { video: v.chemin, reglages: r });
      }).then(function (plan) {
        if (plan.error && !plan.introuvable) throw new Error(plan.error);
        if (!plan.mots) return;   // vidéo pas encore dans Production : le pont la recevra ci-dessous, sous-titres par défaut
        var ch = cap.chunksFromWords(self.motsSortie(plan));
        r.ass = cap.assFromChunks(plan.largeur || 1080, plan.hauteur || 1920, ch); r.srt = cap.srtFromChunks(ch); r.ass_temoin = cap.temoin();
      });
    }
    return prep.then(function () { etat({ statut: "en_cours", etape: "envoi au pont" }); return envoyer(); }).then(function (j) {
      if (j._code === 404 && j.introuvable && v.prise) {
        // La vidéo n'est pas encore dans Production : on y dépose la prise de la carte (même chemin que Classer)
        etat({ statut: "en_cours", etape: "copie de la vidéo dans Production" });
        return self.A.getTakeBlobOrFetch(v.prise).then(function (blob) {
          if (!blob) throw new Error("vidéo de la carte illisible dans Agnes");
          return fetch(self.pont() + "/classement/fichier", { method: "POST", headers: { "X-Chemin": encodeURIComponent(v.chemin) }, body: blob })
            .then(function (x) { return x.json(); }).then(function (w) { if (!w.ok) throw new Error(w.error || "copie refusée"); return envoyer(); });
        });
      }
      return j;
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "montage refusé par le pont");
      return self.suivre(j.id, etat);
    }).then(function (res) {
      shot.montage = Object.assign({}, shot.montage || {}, { dernier: { chemin: res.chemin, date: new Date().toLocaleString("fr-FR"),
        lufs: res.son ? res.son.apres_lufs : null, crete: res.son ? res.son.apres_crete : null } });
      self.core.saveProject();
      etat({ statut: "fini", resultat: res });
      return res;
    }).catch(function (e) {
      etat({ statut: "erreur", erreur: e.message || String(e) });
      throw e;
    });
  },
  suivre: function (ident, etat) {
    var self = this;
    return new Promise(function (ok, ko) {
      (function tour() {
        self.appel("GET", "/montage/etat?id=" + encodeURIComponent(ident)).then(function (j) {
          if (j.statut === "fini") return ok(j.resultat);
          if (j.statut === "erreur" || j.statut === "inconnu") return ko(new Error(j.erreur || "montage interrompu"));
          etat({ statut: "en_cours", etape: j.etape || "en attente" });
          setTimeout(tour, 1500);
        }, ko);
      })();
    });
  },
  monterCochees: function () {
    var self = this, liste = this.cartes().filter(function (s) { var c = self.view.querySelector('[data-mt-coche="' + s.id + '"]'); return c && c.checked; });
    if (!liste.length) return this.core.toast("Cochez au moins une carte.", "err");
    var n = 0;
    liste.reduce(function (p, s) { return p.then(function () { return self.monter(s).then(function () { n++; }, function () { }); }); }, Promise.resolve())
      .then(function () { self.core.toast("Montage terminé : " + n + " carte(s) sur " + liste.length + ".", n === liste.length ? "ok" : "err"); });
  },

  // ---------- interface ----------
  action: function (b) {
    var self = this, act = b.getAttribute("data-mt"), shot = this.cartes().find(function (s) { return s.id === b.getAttribute("data-id"); });
    if (act === "monter" && shot) this.monter(shot).then(function (res) {
      self.core.toast("Carte montée : " + res.nom, "ok");
    }, function (e) { self.core.toast("Montage impossible : " + (e.message || e), "err"); });
    if (act === "cochees") this.monterCochees();
    if (act === "apercu" && shot) { this.ouvrirApercu(shot); this.view.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (act === "fermer-apercu") { this.arreter(); this.ap = null; this.render(); }
    if (act === "autocaption") this.A.showView("view_captions");
    if (act === "lecture") {
      var vid = this.view.querySelector("#mtApVideo");
      if (vid) { if (vid.paused) { if (this.ap && this.ap.plan && vid.currentTime >= this.ap.plan.duree_source - 0.05) vid.currentTime = 0; vid.play(); } else vid.pause(); }
    }
    if (act === "ouvrir") this.appel("POST", "/ouvrir", { chemin: b.getAttribute("data-chemin") }).then(function (j) {
      if (!j.ok) self.core.toast("Dossier non ouvert : " + (j.error || ""), "err");
    }, function (e) { self.core.toast(e.message, "err"); });
    if (act === "reecouter" && shot) { shot.montage = Object.assign({}, shot.montage || {}); delete shot.montage.mots; this.core.saveProject(); this.render(); this.core.toast("Whisper réécoutera cette carte au prochain montage.", "ok"); }
    if (act === "notes" && shot) { shot.montage = Object.assign({}, shot.montage || {}); delete shot.montage.carton; delete shot.montage.sous; this.core.saveProject(); this.render(); }
    if (act === "defauts") { var ranger = this.cfg.ranger; Object.assign(this.cfg, this.DEFAUTS, { ranger: ranger }); this.cfg.save(); this.render(); }
  },
  champ: function (el) {
    var k = el.getAttribute("data-mtc"), id = el.getAttribute("data-mtk"), rid = el.getAttribute("data-mtr"), kid = el.getAttribute("data-mtkar");
    var capf = el.getAttribute("data-mtcap"), ap = this.ap;
    if (capf) {
      // curseurs rapides du lecteur = le style d'AutoCaption lui-même (pas de copie)
      var cap = this.captions(); if (!cap) return;
      var stl = cap.state().style; stl[capf] = Number(el.value); stl.preset = ""; cap.save();
      var out = el.parentNode.querySelector("output"); if (out) out.textContent = el.value;
      return;
    }
    if (el.getAttribute("data-mtseek")) {
      var vid = this.view.querySelector("#mtApVideo"), p = ap && ap.plan;
      if (vid) vid.currentTime = p ? this.versSource(Number(el.value) * p.vitesse, p.garder) : Number(el.value);
      return;
    }
    if (rid || kid) {
      var sr = this.cartes().find(function (s) { return s.id === (rid || kid); }); if (!sr) return;
      var patch = {}; patch[rid ? "resserrer" : "karaoke"] = el.checked;
      sr.montage = Object.assign({}, sr.montage || {}, patch);
      this.core.saveProject();
      if (ap && ap.id === sr.id) this.chargerPlan();
      return;
    }
    if (k) {
      this.cfg[k] = el.type === "checkbox" ? el.checked : el.type === "number" || /^(vitesse|carton_duree|fond_opacite|assombrir|pause_courte|pause_longue|pauses_longues)$/.test(k) ? Number(el.value) : el.value;
      this.cfg.save();
      if (k === "ranger") this.pole(this.vueActive());
      if (ap && this.PLAN.test(k)) this.chargerPlan();
      return;
    }
    if (id) {
      var shot = this.cartes().find(function (s) { return s.id === id; }); if (!shot) return;
      var k2 = el.getAttribute("data-mtf"), cur = this.carton(shot);
      shot.montage = Object.assign({}, shot.montage || {}, { carton: cur.texte, sous: cur.sous });
      shot.montage[k2 === "sous" ? "sous" : "carton"] = el.value.trim();
      this.core.saveProject();
      if (ap && ap.id === id) this.chargerPlan();
    }
  },
  render: function () {
    var self = this;
    if (this.polices === null && !this._polEnCours) { this._polEnCours = true; this.chargerPolices().then(function () { self._polEnCours = false; if (self.visible()) self.render(); }); }
    var esc = this.A.esc, c = this.cfg, body = this.view.querySelector("#mtBody");
    var opt = function (liste, val) {
      return liste.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("");
    };
    var vitesses = [1, 1.05, 1.1, 1.15, 1.2, 1.25].map(function (v) { return [v, "x" + v.toFixed(2).replace(".", ",")]; });
    var durees = [1.5, 1.6, 1.7, 1.8, 1.9, 2].map(function (v) { return [v, v.toFixed(1).replace(".", ",") + " s"]; });
    var pols = (this.polices && this.polices.length ? this.polices : [{ fichier: c.police, nom: c.police.replace(/\.ttf$/i, "") }]).map(function (p) { return [p.fichier, p.nom]; });
    var reglages =
      '<div class="card"><h3>Réglages du montage par carte</h3>' +
      '<p class="hint">Chaque vidéo de carte devient une vidéo prête à publier : format au choix (comme la vidéo par défaut), voix au maximum sans la casser, carton de fin. ' +
      "L'original n'est jamais modifié ; le résultat va dans le dossier Final de la journée, avec un compte rendu des mesures.</p>" +
      '<div class="grid3">' +
      '<div class="field"><label>Vitesse (image et son)</label><select data-mtc="vitesse">' + opt(vitesses, c.vitesse) + "</select></div>" +
      '<div class="field"><label>Format de sortie</label><select data-mtc="format">' + opt([["auto", "Comme la vidéo (sans recadrage)"], ["9:16", "9:16 vertical (TikTok, Reels, Shorts)"],
        ["16:9", "16:9 paysage (YouTube, film, série)"], ["1:1", "1:1 carré"], ["4:5", "4:5 (Instagram)"]], c.format) + "</select></div>" +
      '<div class="field"><label>Voix</label><label class="inline"><input type="checkbox" data-mtc="voix"' + (c.voix ? " checked" : "") + "> Au maximum (-14 LUFS, crête -1 dBTP)</label></div>" +
      '<div class="field"><label>Final existant</label><label class="inline"><input type="checkbox" data-mtc="remplacer"' + (c.remplacer ? " checked" : "") + "> Le remplacer (sinon « final (2) »)</label></div>" +
      "</div><h4>Carton de fin</h4><div class=\"grid3\">" +
      '<div class="field"><label>Carton</label><label class="inline"><input type="checkbox" data-mtc="carton"' + (c.carton ? " checked" : "") + "> Ajouter le carton</label></div>" +
      '<div class="field"><label>Durée (fin de la vidéo)</label><select data-mtc="carton_duree">' + opt(durees, c.carton_duree) + "</select></div>" +
      '<div class="field"><label>Position</label><select data-mtc="position">' + opt([["centre", "Au centre"], ["bas", "Tiers inférieur"]], c.position) + "</select></div>" +
      '<div class="field"><label>Police</label><select data-mtc="police">' + opt(pols, c.police) + "</select></div>" +
      '<div class="field"><label>Taille du texte</label><input type="number" min="36" max="140" step="2" data-mtc="taille" value="' + esc(c.taille) + '"></div>' +
      '<div class="field"><label>Couleur du texte</label><input type="color" data-mtc="couleur" value="' + esc(c.couleur) + '"></div>' +
      '<div class="field"><label>Couleur du fond</label><input type="color" data-mtc="fond" value="' + esc(c.fond) + '"></div>' +
      '<div class="field"><label>Opacité du fond</label><select data-mtc="fond_opacite">' + opt([[0, "Aucun fond"], [0.3, "Léger"], [0.45, "Moyen"], [0.6, "Marqué"], [0.8, "Plein"]], c.fond_opacite) + "</select></div>" +
      '<div class="field"><label>Assombrir l\'image sous le carton</label><select data-mtc="assombrir">' + opt([[0, "Non"], [0.2, "Un peu"], [0.35, "Plus"]], c.assombrir) + "</select></div>" +
      '<div class="field"><label>Apparition du texte</label><select data-mtc="animation">' + opt([["fondu", "Fondu"], ["machine", "Machine à écrire"]], c.animation) + "</select></div>" +
      "</div><h4>Pauses resserrées</h4>" +
      '<p class="hint">Pour les cartes où « Resserrer les pauses » est coché : coupes au milieu des silences entre les mots (aucun mot touché), le silence du début et celui de la fin restent.</p>' +
      '<div class="grid3">' +
      '<div class="field"><label>Pauses gardées</label><select data-mtc="pauses_longues">' + opt([[0, "Aucune"], [1, "Une (la plus longue)"], [2, "Deux"]], c.pauses_longues) + "</select></div>" +
      '<div class="field"><label>Durée de la pause gardée</label><select data-mtc="pause_longue">' + opt([0.3, 0.4, 0.5, 0.6].map(function (v) { return [v, v.toFixed(1).replace(".", ",") + " s"]; }), c.pause_longue) + "</select></div>" +
      '<div class="field"><label>Durée des autres pauses</label><select data-mtc="pause_courte">' + opt([0.1, 0.15, 0.2, 0.25].map(function (v) { return [v, String(v).replace(".", ",") + " s"]; }), c.pause_courte) + "</select></div>" +
      '</div>' +
      "<h4>Sous-titres karaoké</h4>" +
      '<p class="hint">Pour les cartes où « Sous-titres karaoké » est coché : Whisper (onglet Extraire) écoute la vidéo une fois, le texte exact de la réplique (entre « » dans le prompt) est calé mot à mot. ' +
      "Le style (police, taille, hauteur, couleurs, mot prononcé, animation) est celui de l'onglet AutoCaption : un seul endroit pour le régler. Un fichier .srt est écrit à côté de la vidéo finale.</p>" +
      '<div class="row-inline"><label class="inline"><input type="checkbox" data-mtc="st_avant_carton"' + (c.st_avant_carton ? " checked" : "") + "> Les sous-titres s'arrêtent quand le carton arrive</label>" +
      (this.captions() ? '<button class="small-btn" data-mt="autocaption">Régler le style dans AutoCaption</button>' : '<span class="hint mt-err">Extension AutoCaption désactivée : activez-la dans les réglages.</span>') + "</div>" +
      '<div class="row-inline"><label class="inline"><input type="checkbox" data-mtc="ranger"' + (c.ranger ? " checked" : "") + "> Ranger les onglets de montage dans Montage (Assemblage, Voix, Son… restent accessibles par les sous-onglets)</label>" +
      '<button class="small-btn" data-mt="defauts">Réglages d\'origine</button></div>' +
      (this.polices === null ? '<p class="hint mt-err">Pont local injoignable : lancez lancer_pont.bat (dossier prod-fruits) pour monter les cartes.</p>' :
        this.ancien ? '<p class="hint mt-err">Le pont local tourne avec une version sans Montage : fermez sa fenêtre et relancez lancer_pont.bat (dossier prod-fruits).</p>' : "") +
      "</div>";
    var cartes = this.cartes(), lignes = cartes.map(function (s, i) { return self.ligne(s, i + 1); }).join("");
    var liste = '<div class="card"><h3>Cartes du projet</h3>' +
      '<p class="hint">Texte du carton : repris des notes de la carte (ligne « CARTON DE FIN »), modifiable ici pour cette carte seulement. Pas de nom ni de logo.</p>' +
      (cartes.length ? '<div class="mt-liste">' + lignes + '</div><div class="row-inline"><button class="primary-btn" data-mt="cochees">Monter les cartes cochées</button></div>'
        : '<p class="hint">Aucune carte dans ce projet.</p>') + "</div>";
    var vid = body.querySelector("#mtApVideo"), reprise = vid && this.ap ? { t: vid.currentTime, url: vid.getAttribute("src") } : null;
    body.innerHTML = this.htmlApercu() + reglages + liste;
    if (this.ap) {
      var nv = body.querySelector("#mtApVideo");
      if (nv && reprise && reprise.url === nv.getAttribute("src")) nv.addEventListener("loadedmetadata", function () { nv.currentTime = reprise.t; }, { once: true });
      this.majApercu(); this.boucle();
    } else this.arreter();
  },
  ligne: function (s, n) {
    var esc = this.A.esc, k = this.carton(s), v = this.video(s), notes = this.cartonDesNotes(s.notes);
    var titre = String((s.notes || "").split("\n")[0] || s.imagePrompt || s.prompt || "").replace(/^#+\s*/, "").slice(0, 70);
    var src = v.chemin ? "Production\\" + v.chemin.replace(/\//g, "\\") : v.prise ? "vidéo dans Agnes (carte à classer)" : "pas encore de vidéo";
    var perso = s.montage && s.montage.carton !== undefined && (k.texte !== notes.texte || k.sous !== notes.sous);
    return '<div class="mt-ligne" data-mt-ligne="' + s.id + '">' +
      '<div class="mt-tete"><label class="inline"><input type="checkbox" data-mt-coche="' + s.id + '"' + (v.chemin ? "" : " disabled") + "> <b>Carte " + (n < 10 ? "0" : "") + n + "</b></label>" +
      '<span class="hint">' + esc(titre) + "</span></div>" +
      '<div class="hint">Vidéo : ' + esc(src) + "</div>" +
      '<div class="grid2"><div class="field"><label>Carton</label><input type="text" maxlength="160" data-mtk="' + s.id + '" data-mtf="carton" value="' + esc(k.texte) + '" placeholder="ex. Abonne-toi pour la suite."></div>' +
      '<div class="field"><label>Sous-texte (facultatif)</label><input type="text" maxlength="160" data-mtk="' + s.id + '" data-mtf="sous" value="' + esc(k.sous) + '" placeholder="ex. Suite demain à 8 h"></div></div>' +
      '<div class="row-inline"><label class="inline"><input type="checkbox" data-mtr="' + s.id + '"' + (s.montage && s.montage.resserrer ? " checked" : "") + "> Resserrer les pauses</label>" +
      '<label class="inline"><input type="checkbox" data-mtkar="' + s.id + '"' + (s.montage && s.montage.karaoke ? " checked" : "") + "> Sous-titres karaoké</label>" +
      (s.montage && s.montage.mots ? '<button class="small-btn" data-mt="reecouter" data-id="' + s.id + '" title="Mots minutés le ' + esc(s.montage.mots.date || "") + '">Réécouter avec Whisper</button>' : "") +
      '<button class="small-btn" data-mt="apercu" data-id="' + s.id + '"' + (v.chemin || v.prise ? "" : " disabled") + ">Aperçu</button>" +
      '<button class="small-btn" data-mt="monter" data-id="' + s.id + '"' + (v.chemin ? "" : " disabled") + ">Monter cette carte</button>" +
      (perso ? '<button class="small-btn" data-mt="notes" data-id="' + s.id + '">Reprendre le texte des notes</button>' : "") +
      '<span class="mt-etat" data-mt-etat="' + s.id + '">' + this.texteEtat(s) + "</span></div></div>";
  },
  texteEtat: function (s) {
    var esc = this.A.esc, e = this.etats[s.id], fr = function (x) { return String(x).replace(".", ","); };
    if (e && e.statut === "en_cours") return '<span class="hint">En cours : ' + esc(e.etape || "") + "…</span>";
    if (e && e.statut === "erreur") return '<span class="mt-err">Erreur : ' + esc(e.erreur) + "</span>";
    var res = e && e.statut === "fini" ? e.resultat : null, d = s.montage && s.montage.dernier;
    if (!res && !d) return "";
    var chemin = res ? res.chemin : d.chemin, son = res ? res.son : d.lufs != null ? { apres_lufs: d.lufs, apres_crete: d.crete } : null;
    var alertes = res && res.alertes && res.alertes.length ? '<br><span class="mt-alerte">À vérifier : ' + esc(res.alertes.join(" ; ")) + "</span>" : "";
    return '<span class="mt-ok">Montée' + (d && !res ? " le " + esc(d.date) : "") + "</span>" +
      (son ? '<span class="hint"> · ' + fr(son.apres_lufs) + " LUFS, crête " + fr(son.apres_crete) + " dBTP</span>" : "") +
      ' <button class="small-btn" data-mt="ouvrir" data-chemin="' + esc(chemin) + '">Voir le fichier</button>' + alertes;
  },
  majLigne: function (s) { var el = this.view.querySelector('[data-mt-etat="' + s.id + '"]'); if (el) el.innerHTML = this.texteEtat(s); },
  style: function () {
    if (document.getElementById("mtStyle")) return;
    var st = document.createElement("style"); st.id = "mtStyle";
    st.textContent = ".mt-subnav{display:flex;gap:6px;flex-wrap:wrap;margin:-8px 0 16px}" +
      ".mt-sub{font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--edge);background:transparent;color:var(--text-dim);cursor:pointer}" +
      ".mt-sub[aria-selected=true]{color:var(--text);border-color:var(--text-dim)}" +
      ".mt-ligne{border-top:1px solid var(--edge);padding:12px 0}.mt-ligne:first-child{border-top:0}" +
      ".mt-tete{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.mt-etat{margin-left:8px}" +
      ".mt-ap-grille{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}.mt-ap-cote{flex:1;min-width:240px}" +
      ".mt-ecran{position:relative;width:300px;max-width:100%;aspect-ratio:9/16;background:#000;border-radius:10px;overflow:hidden}" +
      ".mt-ecran video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".mt-ecran canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
      ".mt-range{display:flex;gap:8px;align-items:center}.mt-range input{flex:1}" +
      ".mt-ok{color:var(--ok,#5fbf7f)}.mt-err{color:var(--danger,#e06060)}.mt-alerte{color:var(--warn,#d9a441)}";
    document.head.appendChild(st);
  }
});
