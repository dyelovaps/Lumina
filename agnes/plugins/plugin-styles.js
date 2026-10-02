// plugins/plugin-styles.js — Styles de prompt (01/10/2026)
// Les règles ajoutées automatiquement à chaque prompt envoyé (ChatGPT, Grok, Agnes, Flow) dépendent du STYLE du projet :
// « Réaliste — Marketing » (règles d'avant, inchangées), « Série réaliste », « Cartoon / satire »… et les vôtres.
// Chaque style : règles ajoutées aux images, règles ajoutées aux vidéos, textes écrits gardés ou non (tasse, écran,
// panneau), musique et bruitages permis ou non, réglage du Calculateur de répliques.
// Carte « Style des prompts » dans l'onglet Projet : choisir le style du projet, ajouter, modifier, dupliquer, supprimer.
// Sans cette extension, les règles d'avant s'appliquent à tous les projets (rien ne casse).
AgnesPlugins.register("styles", {
  name: "Styles de prompt",
  version: "1.0",
  KEY: "styles:liste",

  // Règles d'avant (plugin-moteurs) : reprises mot pour mot dans les deux styles réalistes
  IMG_REALISTE: "Human, natural body language, subtle restrained expression",
  VID_REALISTE: "Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to",
  DEFAULTS: function () {
    return [
      { id: "realiste-marketing", nom: "Réaliste — Marketing (avatar)", image: this.IMG_REALISTE, video: this.VID_REALISTE,
        texteEcran: false, musique: false, repliques: "anthony",
        note: "Règles d'origine : jeu subtil, aucun texte dans l'image, pas de musique, répliques Anthony 150 à 180 caractères." },
      { id: "serie-realiste", nom: "Série réaliste", image: this.IMG_REALISTE, video: this.VID_REALISTE,
        texteEcran: false, musique: false, repliques: "serie",
        note: "Fiction en prises de vue réalistes : jeu subtil, pas de musique, répliques de série (pas de minimum)." },
      { id: "cartoon", nom: "Cartoon / satire", image: "Expressive 3D cartoon acting, exaggerated comic facial expressions, playful harmless family-friendly satire",
        video: "Expressive cartoon acting with lively comic timing, clear lip sync on every French line, playful harmless family-friendly satire",
        texteEcran: true, musique: true, repliques: "serie",
        note: "Animation et satire : jeu expressif, textes écrits gardés (tasse, écran, bouton), musique et bruitages permis." }
    ];
  },

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.list = this.DEFAULTS(); this.edit = null;
    core.store.getKV(this.KEY).then(function (saved) {
      if (saved && saved.length) self.list = saved;
      self.render();
    }, function () { self.render(); });
    this.mount();
    core.on("project:change", function () { self.render(); });
  },
  save: function () { this.core.store.setKV(this.KEY, this.list); },
  get: function (id) { return this.list.find(function (s) { return s.id === id; }) || null; },

  // Style d'un projet : celui choisi, sinon « Réaliste — Marketing » pour un projet nommé Marketing, sinon « Série réaliste »
  defautPour: function (p) { return p && /marketing/i.test(p.name || "") ? "realiste-marketing" : "serie-realiste"; },
  courant: function (p) {
    p = p || this.core.getProject();
    return (p && this.get(p.styleId)) || this.get(this.defautPour(p)) || this.list[0] || null;
  },
  // Choix du style d'un projet (aussi pour Claude) : le réglage des répliques du projet suit le style
  choisir: function (id, p) {
    p = p || this.core.getProject();
    var s = this.get(id) || this.list.find(function (x) { return x.nom.toLowerCase() === String(id || "").toLowerCase(); });
    if (!s) throw new Error("style « " + id + " » introuvable");
    p.styleId = s.id; if (s.repliques) p.repliques = s.repliques;
    this.core.saveProject(); this.core.emit("shots:render"); this.render();
    return s;
  },

  // ---------- carte dans l'onglet Projet ----------
  mount: function () {
    var view = document.getElementById("viewProject"); if (!view) return;
    var card = document.createElement("div"); card.className = "card"; card.id = "stylesCard";
    var first = view.querySelector(".card");
    if (first && first.nextSibling) view.insertBefore(card, first.nextSibling); else view.appendChild(card);
    var self = this;
    card.addEventListener("change", function (e) {
      if (e.target.id === "stProjet") { self.choisir(e.target.value); self.core.toast("Style du projet : " + self.courant().nom, "ok"); }
      if (e.target.id === "stEdit") { self.edit = e.target.value; self.render(); }
    });
    card.addEventListener("click", function (e) { var b = e.target.closest("[data-st]"); if (b) self.action(b.getAttribute("data-st")); });
  },
  repliquesOptions: function (sel) {
    var rp = window.AgnesPlugins && AgnesPlugins.isLoaded && AgnesPlugins.isLoaded("repliques") ? AgnesPlugins.get("repliques") : null;
    var list = rp ? rp.reglages : [{ id: "anthony", nom: "Anthony — TikTok 10 s" }, { id: "serie", nom: "Série — dialogue" }];
    var esc = this.A.esc;
    return list.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === sel ? " selected" : "") + ">" + esc(r.nom) + "</option>"; }).join("");
  },
  render: function () {
    var card = document.getElementById("stylesCard"); if (!card) return;
    var self = this, esc = this.A.esc, p = this.core.getProject(), cur = this.courant(p);
    if (!this.get(this.edit)) this.edit = cur ? cur.id : (this.list[0] && this.list[0].id);
    var ed = this.get(this.edit) || {};
    var opts = function (sel) { return self.list.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sel ? " selected" : "") + ">" + esc(s.nom) + "</option>"; }).join(""); };
    card.innerHTML =
      '<h2>Style des prompts</h2>' +
      '<p class="hint" style="margin-top:-6px">Règles ajoutées automatiquement à chaque prompt envoyé (images et vidéos), et réglage du compteur de répliques. ' +
      'Le style vaut pour ce projet seulement ; la liste des styles est commune à tous les projets.</p>' +
      '<div class="field" style="max-width:420px"><label for="stProjet">Style de ce projet</label><select id="stProjet">' + opts(cur && cur.id) + '</select>' +
      (p && !p.styleId ? '<span class="hint" style="margin:4px 0 0">Choisi automatiquement (aucun style enregistré pour ce projet).</span>' : '') + '</div>' +
      '<details' + (this.open ? " open" : "") + ' id="stDetails"><summary style="cursor:pointer">Modifier les styles (ajouter, modifier, supprimer)</summary>' +
      '<div style="margin-top:10px">' +
      '<div class="row-inline"><select id="stEdit" style="width:auto">' + opts(ed.id) + '</select>' +
      '<button class="small-btn" type="button" data-st="new">Nouveau</button>' +
      '<button class="small-btn" type="button" data-st="dup">Dupliquer</button>' +
      (this.estOrigine(ed.id) ? '' : '<button class="small-btn" type="button" data-st="del">Supprimer « ' + esc(ed.nom || "") + ' »</button>') +
      '<button class="small-btn" type="button" data-st="reset">Rétablir les styles d\'origine</button></div>' +
      '<div class="field"><label for="stNom">Nom</label><input type="text" id="stNom" value="' + esc(ed.nom || "") + '"></div>' +
      '<div class="field"><label for="stImage">Règles ajoutées aux IMAGES (anglais)</label><textarea id="stImage" style="min-height:56px">' + esc(ed.image || "") + '</textarea></div>' +
      '<div class="field"><label for="stVideo">Règles ajoutées aux VIDÉOS (anglais)</label><textarea id="stVideo" style="min-height:56px">' + esc(ed.video || "") + '</textarea></div>' +
      '<label class="inline"><input type="checkbox" id="stTexte"' + (ed.texteEcran ? " checked" : "") + '> Garder les textes écrits dans l\'image (tasse, écran, panneau, bouton) — sinon « aucun texte »</label><br>' +
      '<label class="inline"><input type="checkbox" id="stMusique"' + (ed.musique ? " checked" : "") + '> Musique et bruitages permis — sinon « No music » est ajouté aux vidéos</label>' +
      '<div class="field" style="max-width:420px;margin-top:8px"><label for="stRepliques">Compteur de répliques</label><select id="stRepliques">' + this.repliquesOptions(ed.repliques) + '</select></div>' +
      '<div class="field"><label for="stNote">Note (pour vous)</label><input type="text" id="stNote" value="' + esc(ed.note || "") + '"></div>' +
      '<button class="primary-btn" type="button" data-st="save">Enregistrer ce style</button>' +
      '<p class="hint">Toujours ajoutés, quel que soit le style : image nette sans grain ; « no subtitles, no watermark ». ' +
      'Dans un prompt : répliques entre « … », textes écrits entre apostrophes \'TOUT VA BIEN\' (ou après « reads », « labeled », « marked »), bruitages sans guillemets.</p>' +
      '</div></details>';
    var d = document.getElementById("stDetails"); if (d) d.addEventListener("toggle", function () { self.open = d.open; });
  },
  action: function (a) {
    var self = this, ed = this.get(this.edit), v = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
    if (a === "save" && ed) {
      ed.nom = v("stNom").trim() || ed.nom; ed.image = v("stImage").trim(); ed.video = v("stVideo").trim();
      ed.texteEcran = document.getElementById("stTexte").checked; ed.musique = document.getElementById("stMusique").checked;
      ed.repliques = v("stRepliques"); ed.note = v("stNote").trim();
      var p = this.core.getProject(); if (this.courant(p) === ed) p.repliques = ed.repliques;
      this.save(); this.core.saveProject(); this.core.emit("shots:render"); this.render(); this.core.toast("Style « " + ed.nom + " » enregistré.", "ok");
    } else if (a === "new" || a === "dup") {
      var base = a === "dup" && ed ? ed : { image: "", video: "", texteEcran: false, musique: false, repliques: "serie", note: "" };
      var n = Object.assign({}, base, { id: "st-" + Date.now().toString(36), nom: a === "dup" ? base.nom + " (copie)" : "Nouveau style" });
      this.list.push(n); this.edit = n.id; this.open = true; this.save(); this.render();
    } else if (a === "del" && ed) {
      if (this.estOrigine(ed.id)) return this.core.toast("« " + ed.nom + " » est un style d'origine : il ne se supprime pas (modifiez-le, ou « Rétablir les styles d'origine »).", "err");
      if (!window.confirm("Supprimer le style « " + ed.nom + " » ? Les projets qui l'utilisent reprendront leur style automatique.")) return;
      try { this.supprimer(ed.id); } catch (e) { return this.core.toast(e.message, "err"); }
      this.render();
    } else if (a === "reset") {
      if (!window.confirm("Rétablir les 3 styles d'origine ? Vos styles ajoutés sont gardés, les styles d'origine modifiés reprennent leurs règles.")) return;
      this.retablir(); this.render();
    }
  },
  // 02/10 — les 3 styles d'origine ne se suppriment plus (le bouton Supprimer visait le style du projet affiché par défaut)
  estOrigine: function (id) { return ["realiste-marketing", "serie-realiste", "cartoon"].indexOf(id) !== -1; },
  supprimer: function (ref) {
    var s = this.get(ref) || this.list.find(function (x) { return x.nom.toLowerCase() === String(ref || "").toLowerCase(); });
    if (!s) throw new Error("style « " + ref + " » introuvable");
    if (this.estOrigine(s.id)) throw new Error("« " + s.nom + " » est un style d'origine : il ne se supprime pas");
    this.list = this.list.filter(function (x) { return x !== s; }); if (this.edit === s.id) this.edit = null; this.save();
    return s;
  },
  // Remet les styles d'origine manquants ou modifiés ; les styles ajoutés sont gardés
  retablir: function () {
    var self = this;
    this.DEFAULTS().forEach(function (d) { var i = self.list.findIndex(function (s) { return s.id === d.id; }); if (i === -1) self.list.push(d); else self.list[i] = d; });
    this.save();
  }
});
