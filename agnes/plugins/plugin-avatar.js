// plugins/plugin-avatar.js — Studio (01/10/2026)
// Onglet « Studio » : fiches d'avatar / personnage, de tenue, de lieu et d'objet. On remplit des listes déroulantes
// (éditables) et quelques champs libres ; l'extension compose le prompt anglais (ADN court, aperçu, combinaison), montre un aperçu
// 9:16 ou 16:9, puis « Envoyer à l'Atelier » : le Chef de l'Atelier crée la Bible, y rattache l'image validée (outil
// bible_attacher_image) et range l'image dans la Bibliothèque. Cette extension N'ÉCRIT JAMAIS dans la Bible (elle la lit seulement,
// pour les pastilles des cartes du Storyboard). Les dictionnaires FR → EN sont intégrés ; l'IA (Atelier) ne traduit que les champs libres.
// Sans cette extension, Agnes marche exactement comme avant. Types de fiche extensibles (publicité plus tard : autre extension).
AgnesPlugins.register("avatar", {
  name: "Studio",
  version: "1.0",
  KEY_FICHES: "avatar:fiches",
  KEY_LISTES: "avatar:listes",
  TYPES: [["avatar", "Avatar"], ["personnage", "Personnage"], ["tenue", "Tenue"], ["lieu", "Lieu"], ["objet", "Objet"]],
  NAV_PLURIEL: { avatar: "Avatars", personnage: "Personnages", tenue: "Tenues", lieu: "Lieux", objet: "Objets" },
  NIVEAUX: [[1, "Essentiel"], [2, "Détaillé"], [3, "Extrême"]],
  FORMATS: ["9:16", "16:9", "1:1", "4:5", "3:4"],
  TYPES_IMAGE: [["planche", "Planche de référence"], ["portrait", "Portrait en situation"], ["pleinpied", "Plein pied"], ["lieuvide", "Lieu vide"], ["packshot", "Packshot d'objet"]],
  MAX_ESSAIS: 12,

  // ---------- Listes déroulantes d'origine : « id|Nom|français>anglais|… » (anglais vide = rien dans le prompt) ----------
  LISTES_TXT: [
    "genre|Genre|femme>woman|homme>man|personne non binaire>androgynous person",
    "origine|Origine apparente|française>French|européenne>European|méditerranéenne>Mediterranean|nord-africaine>North African|d'Afrique subsaharienne>Sub-Saharan African|antillaise>Caribbean|moyen-orientale>Middle Eastern|d'Asie de l'Est>East Asian|d'Asie du Sud>South Asian|latino-américaine>Latin American|métisse>mixed-heritage",
    "corpulence|Corpulence|mince>slim build|élancée>lean build|athlétique>athletic build|moyenne>average build|ronde>curvy build|forte>heavyset build|musclée>muscular build",
    "morphologie|Morphologie et carrure|épaules larges>broad shoulders|épaules étroites>narrow shoulders|buste en V>V-shaped torso|silhouette en poire>pear-shaped figure|silhouette en sablier>hourglass figure|silhouette droite>rectangular frame|grande et fine>tall and slender|petit gabarit>petite frame",
    "posture|Posture|droite>upright posture|détendue>relaxed posture|voûtée>slightly slouched posture|assurée>confident posture|penchée en avant>leaning-forward posture|raide>stiff posture",
    "formevisage|Forme du visage|ovale>oval face|rond>round face|carré>square face|allongé>long face|en cœur>heart-shaped face|triangulaire>triangular face|anguleux>angular face",
    "teint|Teint|très clair>very fair skin|clair>fair skin|olive>olive skin|mat>tan skin|brun>brown skin|foncé>dark brown skin|ébène>deep dark skin",
    "soustons|Sous-ton de peau|chaud>a warm undertone|froid>a cool undertone|neutre>a neutral undertone|rosé>a pink undertone|doré>a golden undertone",
    "yeux|Couleur des yeux|bruns>brown eyes|noisette>hazel eyes|verts>green eyes|bleus>blue eyes|gris>grey eyes|noirs>dark eyes|bleu-vert>blue-green eyes",
    "formeyeux|Forme des yeux|en amande>almond-shaped|ronds>round|tombants>downturned|bridés>monolid|écartés>wide-set|rapprochés>close-set|grands>large",
    "sourcils|Sourcils|épais>thick eyebrows|fins>thin eyebrows|arqués>arched eyebrows|droits>straight eyebrows|broussailleux>bushy eyebrows|clairs>light eyebrows|foncés>dark eyebrows",
    "nez|Nez|droit>straight nose|aquilin>aquiline nose|retroussé>upturned nose|large>broad nose|fin>slender nose|busqué>hooked nose",
    "levres|Lèvres|fines>thin lips|pulpeuses>full lips|moyennes>medium lips|bien dessinées>well-defined lips",
    "machoire|Mâchoire et pommettes|mâchoire carrée>square jawline|mâchoire marquée>strong jawline|menton pointu>pointed chin|menton fuyant>soft receding chin|pommettes hautes>high cheekbones|joues pleines>full cheeks|fossette au menton>chin dimple",
    "rides|Rides et âge visible|peau lisse>smooth skin|pattes d'oie>light crow's feet|rides du front>light forehead lines|rides d'expression>light expression lines|rides marquées>pronounced age lines|cernes légers>slight under-eye shadows",
    "barbe|Barbe et moustache|rasé de près>clean-shaven|barbe de 3 jours>light stubble|barbe courte taillée>short trimmed beard|barbe pleine>full beard|moustache>moustache|bouc>goatee|barbe grisonnante>salt-and-pepper beard",
    "maquillage|Maquillage|aucun>|naturel>natural makeup|léger>light makeup|soirée>evening makeup|rouge à lèvres rouge>red lipstick|yeux charbonneux>smoky eye makeup|eye-liner>winged eyeliner",
    "couleurcheveux|Couleur des cheveux|noirs>black|bruns foncés>dark brown|châtains>chestnut brown|châtain clair>light brown|blonds>blond|blond platine>platinum blond|roux>red|auburn>auburn|gris>grey|blancs>white|poivre et sel>salt-and-pepper",
    "longueurcheveux|Longueur des cheveux|rasés>shaved head|très courts>buzz cut|courts>short hair|mi-longs>shoulder-length hair|longs>long hair|très longs>very long hair",
    "textcheveux|Texture des cheveux|lisses>straight|ondulés>wavy|bouclés>curly|frisés>coily|crépus>kinky",
    "coiffure|Coiffure|dégradé>a fade haircut|chignon>a bun|queue de cheval>a ponytail|tresses>braids|locks>locs|afro>an afro|bouclés naturels>natural curls|frange>a fringe|coupe au carré>a bob cut|mèches rebelles>tousled strands|côtés rasés>shaved sides|coiffé en arrière>slicked-back styling",
    "raie|Raie|raie au milieu>a middle part|raie sur le côté>a side part|sans raie>no visible parting|raie en zigzag>a zigzag part",
    "lunettes|Lunettes|aucune>|fines dorées>thin gold-rimmed glasses|rondes en métal>round metal glasses|épaisses noires>thick black frames|lunettes de soleil>sunglasses|demi-lunes>half-moon reading glasses",
    "expression|Expression habituelle|neutre>neutral|souriante>warm smile|sérieuse>serious|bienveillante>kind|malicieuse>mischievous|concentrée>focused|rieuse>laughing|pensive>thoughtful",
    "regard|Regard|direct>direct gaze|doux>soft gaze|intense>intense gaze|fuyant>evasive gaze|pétillant>sparkling gaze|calme>calm gaze",
    "occasion|Occasion|quotidien>everyday|bureau>office|décontracté>casual|soirée>evening|sport>sportswear|cérémonie>formal ceremony|voyage>travel|plage>beach|maison>homewear|travail manuel>workwear|conférence>conference",
    "styletenue|Style vestimentaire|casual chic>smart casual|classique>classic|streetwear>streetwear|sportif>athleisure|business>business attire|bohème>bohemian|vintage>vintage|minimaliste>minimalist|romantique>romantic|rock>rock-inspired|élégant>elegant",
    "couleurs|Couleurs|noir>black|blanc>white|gris>grey|beige>beige|bleu marine>navy blue|bleu ciel>sky blue|bleu roi>royal blue|vert sauge>sage green|vert forêt>forest green|kaki>khaki|bordeaux>burgundy|rouge>red|rose poudré>dusty pink|jaune moutarde>mustard yellow|orange>orange|marron>brown|camel>camel|crème>cream|violet>purple|turquoise>turquoise",
    "matieres|Matières|coton>cotton|laine>wool|lin>linen|soie>silk|cuir>leather|denim>denim|velours>velvet|satin>satin|cachemire>cashmere|maille>knit|tissu technique>technical fabric|daim>suede|métal>metal|bois>wood|verre>glass|plastique>plastic|céramique>ceramic|papier>paper|pierre>stone",
    "coupe|Coupe|ajustée>slim-fit|droite>straight-cut|ample>relaxed-fit|oversize>oversized|cintrée>tailored|évasée>flared|courte>cropped|longue>long",
    "etat|État|neuf>brand new|propre>clean|usé>worn|froissé>creased|délavé>faded|taché>stained|abîmé>battered|patiné>aged with a patina",
    "motifs|Motifs|uni>solid|rayures>striped|carreaux>checked|pois>polka-dot|fleuri>floral|imprimé graphique>graphic print|chevrons>herringbone|tie-dye>tie-dye|camouflage>camouflage|logo discret>discreet logo",
    "saison|Saison ou époque|printemps>spring|été>summer|automne>autumn|hiver>winter|mi-saison>mid-season|années 80>1980s|années 90>1990s|années 2000>2000s|époque actuelle>contemporary",
    "typelieu|Type de lieu|bureau open space>modern open-plan office|salle de réunion>meeting room|salon>cozy living room|cuisine>home kitchen|chambre>bedroom|café>coffee shop|restaurant>restaurant|rue>city street|parc>city park|plage>beach|forêt>forest|montagne>mountain landscape|gare>train station|aéroport>airport terminal|intérieur de voiture>car interior|atelier>workshop|studio photo>photo studio|salle de sport>gym|boutique>boutique|salle de classe>classroom|tribunal>courtroom|toit-terrasse>rooftop terrace|ruelle>narrow alley|parking>parking lot|campagne>countryside",
    "interieur|Intérieur ou extérieur|intérieur>indoor|extérieur>outdoor|semi-couvert>semi-covered",
    "materiaux|Matériaux|bois>wood|béton>concrete|brique>brick|verre>glass|acier>steel|pierre>stone|marbre>marble|métal brossé>brushed metal|tissu>fabric|carrelage>tile|moquette>carpet|cuir>leather",
    "palette|Palette de couleurs|tons chauds>warm tones|tons froids>cool tones|tons neutres>neutral tones|pastel>pastel tones|couleurs saturées>saturated colors|monochrome>monochrome|tons terre>earth tones|tons sombres>dark muted tones|touches de néon>neon accents|bleu et orange>teal and orange",
    "moment|Moment de la journée|matin>morning|midi>midday|fin d'après-midi>late afternoon|heure bleue>blue hour|nuit>night|lever du soleil>sunrise|coucher du soleil>sunset",
    "meteo|Météo|ciel dégagé>clear sky|nuageux>overcast|pluie>rain|brouillard>fog|neige>snow|orage>stormy sky|vent>windy|plein soleil>bright sunshine|brume légère>light haze",
    "lumiere|Lumière|naturelle douce>soft natural light|fenêtre latérale>side window light|heure dorée>golden hour light|studio trois points>three-point studio lighting|néon nocturne>neon night lighting|tungstène chaud>warm tungsten practical light|contre-jour>backlight|lumière dure>hard direct light|ambiance tamisée>dim moody light|lumière du jour>bright daylight",
    "ambiance|Ambiance|chaleureuse>warm and welcoming atmosphere|froide>cold impersonal atmosphere|calme>calm atmosphere|animée>lively atmosphere|tendue>tense atmosphere|mystérieuse>mysterious atmosphere|luxueuse>luxurious atmosphere|modeste>modest atmosphere|nostalgique>nostalgic atmosphere|professionnelle>professional atmosphere",
    "echelle|Échelle|intime>small intimate space|moyenne>medium-sized space|vaste>vast space|immense>immense space|exiguë>cramped space",
    "typeobjet|Type d'objet|carnet>notebook|stylo>pen|tasse>mug|téléphone>smartphone|ordinateur portable>laptop|sac>bag|montre>wristwatch|lunettes>pair of glasses|clés>set of keys|livre>book|bouteille>bottle|lampe>lamp|casque audio>pair of headphones|appareil photo>camera|mallette>briefcase|parapluie>umbrella|valise>suitcase|plante en pot>potted plant|vélo>bicycle|micro>microphone",
    "tailleobjet|Taille ou échelle|minuscule>tiny|petit>small|moyen>medium-sized|grand>large|très grand>oversized",
    "cadrage|Cadrage|gros plan>close-up|rapproché poitrine>medium close-up|plan taille>medium shot|plan américain>medium long shot|plein pied>full body shot|plan d'ensemble>wide establishing shot",
    "angle|Angle|hauteur d'yeux>eye level|légère contre-plongée>slight low angle|légère plongée>slight high angle|trois-quarts>three-quarter view|profil>profile view|par-dessus l'épaule>over-the-shoulder",
    "objectif|Objectif|24 mm>24 mm wide-angle lens|35 mm>35 mm lens|50 mm>50 mm lens|85 mm portrait>85 mm portrait lens|135 mm>135 mm telephoto lens|macro>macro lens",
    "profondeur|Profondeur de champ|faible>shallow depth of field|moyenne>moderate depth of field|grande>deep depth of field|arrière-plan flou>softly blurred background|tout net>everything in sharp focus",
    "rendu|Rendu|photoréaliste>photorealistic|cinéma>cinematic photorealistic|éditorial>editorial photo style|documentaire>documentary photo style|commercial lisse>clean commercial photo style|3D cartoon>stylized 3D cartoon|illustration>digital illustration|aquarelle>watercolor illustration"
  ],

  // ---------- Champs des fiches : F(id, libellé, genre, niveau, onglet, options) ----------
  // genre : l = liste, m = liste à choix multiple, n = nombre, t = texte court, z = zone de texte.
  // options : l = identifiant de la liste (sinon l'id du champ), nt = jamais traduit, hors = hors image (document du Chef seulement), a = avatar seulement
  schemaDe: function (type) {
    var F = function (id, label, t, n, g, o) { return Object.assign({ id: id, label: label, t: t, n: n, g: g }, o || {}); };
    var S = {
      personne: [
        F("prenom", "Prénom", "t", 1, "Identité", { nt: 1, hors: 1 }), F("age", "Âge", "n", 1, "Identité", { unit: "ans" }),
        F("genre", "Genre", "l", 1, "Identité"), F("origine", "Origine apparente", "l", 1, "Identité"),
        F("role", "Rôle ou archétype", "t", 2, "Identité", { hors: 1 }),
        F("taille", "Taille", "n", 1, "Corps", { unit: "cm" }), F("corpulence", "Corpulence", "l", 1, "Corps"),
        F("morphologie", "Morphologie et carrure", "l", 2, "Corps"), F("posture", "Posture", "l", 2, "Corps"), F("mains", "Mains", "t", 3, "Corps"),
        F("formevisage", "Forme du visage", "l", 1, "Visage"), F("teint", "Teint", "l", 1, "Visage"), F("soustons", "Sous-ton", "l", 2, "Visage"),
        F("yeux", "Yeux, couleur", "l", 1, "Visage"), F("formeyeux", "Yeux, forme", "l", 2, "Visage"), F("sourcils", "Sourcils", "l", 2, "Visage"),
        F("nez", "Nez", "l", 3, "Visage"), F("levres", "Lèvres", "l", 3, "Visage"), F("machoire", "Mâchoire et pommettes", "l", 3, "Visage"),
        F("rides", "Rides et âge visible", "l", 2, "Visage"), F("barbe", "Barbe et moustache", "l", 1, "Visage"), F("maquillage", "Maquillage", "l", 2, "Visage"),
        F("couleurcheveux", "Couleur", "l", 1, "Cheveux"), F("longueurcheveux", "Longueur", "l", 1, "Cheveux"), F("textcheveux", "Texture", "l", 1, "Cheveux"),
        F("coiffure", "Coiffure", "l", 1, "Cheveux"), F("raie", "Raie", "l", 2, "Cheveux"), F("detailscheveux", "Détails", "t", 3, "Cheveux"),
        F("lunettes", "Lunettes", "l", 1, "Signes"), F("signes", "Grains de beauté, cicatrices, taches de rousseur", "z", 1, "Signes"),
        F("tatouages", "Tatouages et piercings", "z", 3, "Signes"),
        F("expression", "Expression habituelle", "l", 2, "Jeu", { hors: 1 }), F("regard", "Regard", "l", 2, "Jeu", { hors: 1 }),
        F("gestuelle", "Gestuelle", "z", 3, "Jeu", { hors: 1 }), F("voix", "Voix et façon de parler", "z", 3, "Jeu", { hors: 1 }),
        F("continuite", "À ne jamais changer", "z", 2, "Jeu", { hors: 1 }),
        F("public", "Public visé", "t", 1, "Jeu", { hors: 1, a: 1 }), F("ton", "Ton de marque", "t", 1, "Jeu", { hors: 1, a: 1 }),
        F("secteur", "Secteur", "t", 1, "Jeu", { hors: 1, a: 1 }), F("camera", "Rapport à la caméra", "t", 1, "Jeu", { hors: 1, a: 1 })
      ],
      tenue: [
        F("occasion", "Occasion", "l", 1, "Tenue", { hors: 1 }), F("styletenue", "Style", "l", 1, "Tenue"),
        F("couche", "Couche (veste, manteau)", "t", 1, "Tenue"), F("haut", "Haut", "t", 1, "Tenue"), F("bas", "Bas", "t", 1, "Tenue"), F("chaussures", "Chaussures", "t", 1, "Tenue"),
        F("couleurs", "Couleurs", "m", 1, "Tenue"), F("matieres", "Matières", "m", 1, "Tenue"), F("coupe", "Coupe", "l", 1, "Tenue"),
        F("etat", "État", "l", 2, "Tenue"), F("motifs", "Motifs", "l", 2, "Tenue"), F("accessoires", "Accessoires et bijoux", "z", 2, "Tenue"),
        F("saison", "Saison ou époque", "l", 3, "Tenue"), F("details", "Détails de fabrication", "z", 3, "Tenue")
      ],
      lieu: [
        F("typelieu", "Type de lieu", "l", 1, "Lieu"), F("interieur", "Intérieur ou extérieur", "l", 1, "Lieu"), F("ville", "Pays et ville", "t", 1, "Lieu"),
        F("elements", "Éléments principaux", "z", 1, "Lieu"), F("mobilier", "Mobilier", "z", 2, "Lieu"), F("materiaux", "Matériaux", "m", 2, "Lieu"),
        F("palette", "Palette", "m", 1, "Lieu"), F("moment", "Moment de la journée", "l", 1, "Lieu"), F("meteo", "Météo", "l", 2, "Lieu"),
        F("lumiere", "Lumière", "l", 1, "Lieu"), F("ambiance", "Ambiance", "l", 1, "Lieu"),
        F("premier", "Premier plan", "z", 3, "Lieu"), F("arriere", "Arrière-plan", "z", 3, "Lieu"), F("echelle", "Échelle", "l", 3, "Lieu"),
        F("texte", "Texte visible à l'écran (entre apostrophes dans le prompt)", "t", 3, "Lieu", { nt: 1 })
      ],
      objet: [
        F("typeobjet", "Type", "l", 1, "Objet"), F("tailleobjet", "Taille ou échelle", "l", 1, "Objet"),
        F("matiere", "Matière", "l", 1, "Objet", { l: "matieres" }), F("couleur", "Couleur", "l", 1, "Objet", { l: "couleurs" }), F("etat", "État", "l", 1, "Objet"),
        F("details", "Détails", "z", 1, "Objet"), F("marque", "Marque inventée", "t", 1, "Objet", { nt: 1 }),
        F("texte", "Texte écrit sur l'objet (entre apostrophes dans le prompt)", "t", 1, "Objet", { nt: 1 })
      ],
      pv: [
        F("cadrage", "Cadrage", "l", 1, "Prise de vue"), F("angle", "Angle", "l", 1, "Prise de vue"), F("objectif", "Objectif", "l", 2, "Prise de vue"),
        F("lumiere", "Lumière", "l", 2, "Prise de vue"), F("profondeur", "Profondeur de champ", "l", 3, "Prise de vue"), F("rendu", "Rendu", "l", 3, "Prise de vue"),
        F("aEviter", "À éviter", "z", 1, "Prise de vue")
      ]
    };
    return S[type === "avatar" || type === "personnage" ? "personne" : type] || [];
  },
  ONGLETS: { personne: ["Identité", "Corps", "Visage", "Cheveux", "Signes", "Jeu", "Liens", "Prise de vue"], tenue: ["Tenue", "Prise de vue"], lieu: ["Lieu", "Prise de vue"], objet: ["Objet", "Prise de vue"] },
  estPersonne: function (t) { return t === "avatar" || t === "personnage"; },
  def: function (type, id, pv) { return this.schemaDe(pv ? "pv" : type).find(function (d) { return d.id === id; }) || null; },

  // =====================================================================
  // LISTES (dictionnaire FR → EN, éditable)
  // =====================================================================
  slug: function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "v"; },
  listesParDefaut: function () {
    var self = this;
    return this.LISTES_TXT.map(function (ligne) {
      var p = ligne.split("|");
      return { id: p[0], nom: p[1], valeurs: p.slice(2).map(function (v) { var i = v.indexOf(">"); var fr = v.slice(0, i); return { id: self.slug(fr), fr: fr, en: v.slice(i + 1) }; }) };
    });
  },
  liste: function (id) { return this.listes.find(function (l) { return l.id === id; }) || null; },
  valeur: function (listeId, vid) {
    var l = this.liste(listeId); if (!l) return null;
    return l.valeurs.find(function (v) { return v.id === vid; }) || (l.retirees || []).find(function (v) { return v.id === vid; }) || null;
  },
  estRetiree: function (listeId, vid) { var l = this.liste(listeId); return !!l && !l.valeurs.some(function (v) { return v.id === vid; }); },
  listeEn: function (listeId, vid) { var v = this.valeur(listeId, vid); return v ? v.en : ""; },
  // « Rétablir » : les valeurs d'origine reprennent leur texte, les valeurs ajoutées sont gardées
  retablirListe: function (id) {
    var d = this.listesParDefaut().find(function (x) { return x.id === id; }), l = this.liste(id); if (!d || !l) return;
    d.valeurs.forEach(function (v) { var i = l.valeurs.findIndex(function (x) { return x.id === v.id; }); if (i === -1) l.valeurs.push(v); else l.valeurs[i] = v; });
    l.retirees = (l.retirees || []).filter(function (r) { return !d.valeurs.some(function (v) { return v.id === r.id; }); });
  },
  supprimerValeur: function (listeId, vid) {
    var l = this.liste(listeId); if (!l) return;
    var i = l.valeurs.findIndex(function (v) { return v.id === vid; }); if (i === -1) return;
    var v = l.valeurs.splice(i, 1)[0]; l.retirees = (l.retirees || []).concat([v]);   // reste lisible dans les fiches qui l'utilisent
  },
  ajouterValeur: function (listeId, fr, en) {
    var l = this.liste(listeId); if (!l || !String(fr || "").trim()) return null;
    var id = this.slug(fr), n = 1; while (l.valeurs.some(function (v) { return v.id === id; })) id = this.slug(fr) + "-" + (++n);
    var v = { id: id, fr: String(fr).trim(), en: String(en || "").trim() }; l.valeurs.push(v); return v;
  },

  // =====================================================================
  // FICHES : lecture des champs, traduction, ADN, prompts (déterministes, sans DOM)
  // =====================================================================
  nouvelleFiche: function (type, nom) {
    var f = { id: "av" + window.AgnesApp.uid(), type: type, nom: nom || "", collection: "", etiquettes: [], favori: false, note: 0, niveau: 1, champs: {}, traductions: {},
      liens: { tenues: [], lieux: [], objets: [], tenueDefaut: "", lieuDefaut: "" }, combinaisons: [],
      priseDeVue: { format: type === "lieu" ? "16:9" : "9:16", typeImage: this.typeImageDefaut(type) }, aEviter: "", essais: [], imageValidee: "", envois: [],
      cree: Date.now(), modifie: Date.now() };
    if (type === "lieu") f.champs.ville = "France";
    return f;
  },
  typeImageDefaut: function (type) { return type === "lieu" ? "lieuvide" : type === "objet" ? "packshot" : type === "tenue" ? "pleinpied" : "planche"; },
  fiche: function (id) { return (this.fiches || []).find(function (f) { return f.id === id; }) || null; },
  // 02/10 — nom affiché : le nom de la fiche, sinon le prénom saisi (avant : « Sans nom » même avec un prénom)
  nomDe: function (f) { return String((f && (f.nom || (f.champs || {}).prenom)) || "").trim() || "Sans nom"; },
  vide: function (v) { return v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length); },
  brut: function (f, d) { return d.id === "aEviter" ? f.aEviter : d.pv ? (f.priseDeVue || {})[d.id] : (f.champs || {})[d.id]; },
  // Texte libre en anglais : traduction en cache si le français n'a pas changé, sinon le français tel quel (« non traduit »)
  cleTrad: function (d) { return d.cleTrad || d.id; },
  tradDe: function (f, cle, fr) {
    var t = (f.traductions || {})[cle];
    return t && t.fr === fr && t.en ? { en: t.en, ok: true } : { en: fr, ok: false };
  },
  // Valeur anglaise d'un champ ("" si vide)
  en: function (f, d) {
    var v = this.brut(f, d); if (this.vide(v)) return "";
    var self = this, l = d.l || d.id;
    if (d.t === "l") return this.listeEn(l, v);
    if (d.t === "m") return (Array.isArray(v) ? v : [v]).map(function (x) { return self.listeEn(l, x); }).filter(Boolean).join(", ");
    if (d.t === "n") return String(v);
    var txt = String(v).trim();
    // 02/10 — point final des champs libres retiré : ils sont assemblés avec des virgules (avant : « eyebrow., hands »)
    return String(d.nt ? txt : this.tradDe(f, d.id, txt).en).trim().replace(/[.;\s]+$/, "");
  },
  // Insère des adjectifs avant « hair » (short hair + black + wavy → short black wavy hair)
  cheveux: function (longueur, adjs) {
    adjs = adjs.filter(Boolean);
    if (!longueur) return adjs.length ? adjs.join(" ") + " hair" : "";
    if (/ hair$/.test(longueur)) return longueur.replace(/ hair$/, " " + adjs.join(" ") + (adjs.length ? " " : "") + "hair").replace(/\s+/g, " ");
    if (/shaved/i.test(longueur)) return longueur;
    return adjs.concat([longueur]).join(" ");
  },
  art: function (s) { s = String(s || "").trim(); if (!s) return ""; if (/^(a|an|the|his|her|their|some|two|three)\s/i.test(s)) return s; return (/^[aeiou]/i.test(s) ? "an " : "a ") + s; },
  join: function (arr) { return arr.filter(function (x) { return x && String(x).trim(); }).join(", "); },
  visibles: function (f, type) {
    var self = this, niv = f.niveau || 1, av = f.type === "avatar";
    return this.schemaDe(type || f.type).filter(function (d) { return d.n <= niv && (!d.a || av); });
  },
  // ADN court : une ligne, identité stable, sans émotion ni action ni décor
  adn: function (f) {
    var self = this, v = {}, niv = f.niveau || 1;
    this.schemaDe(f.type).forEach(function (d) { if (d.n <= niv && !d.hors && !(d.a && f.type !== "avatar")) v[d.id] = self.en(f, d); });
    var out;
    if (this.estPersonne(f.type)) {
      var ident = [v.age ? v.age + "-year-old" : "", v.origine, v.genre].filter(Boolean).join(" ");
      var cm = parseFloat(f.champs.taille), haut = niv >= 1 && cm > 0 ? "about " + (cm / 100).toFixed(2) + " m tall" : "";
      var yeux = [v.formeyeux, v.yeux].filter(Boolean).join(" ");
      var hair = this.cheveux(v.longueurcheveux, [v.couleurcheveux, v.textcheveux]);
      var extras = [v.coiffure, v.raie].filter(Boolean);
      if (hair && extras.length) hair += " with " + extras.join(" and ");
      if (v.detailscheveux) hair = hair ? hair + ", " + v.detailscheveux : v.detailscheveux;
      out = this.join([ident, haut, v.corpulence, v.morphologie, v.posture, v.teint && v.soustons ? v.teint + " with " + v.soustons : v.teint || v.soustons,
        v.formevisage, v.sourcils, v.nez, v.levres, v.machoire, v.rides, hair, yeux, v.barbe, v.maquillage, v.lunettes, v.signes, v.tatouages,
        v.mains ? "hands: " + v.mains : ""]);
    } else if (f.type === "tenue") {
      var couche = v.couche && v.haut ? v.couche + " over " + this.art(v.haut) : v.couche || v.haut;
      out = this.join([couche, v.bas, v.chaussures, v.accessoires, v.couleurs ? "color palette of " + this.et(v.couleurs) : "", v.matieres ? (/fabric/i.test(v.matieres) ? this.et(v.matieres) : this.et(v.matieres) + " fabrics") : "",
        v.styletenue ? v.styletenue + " style" : "", v.coupe, v.etat, v.motifs ? v.motifs + " pattern" : "", v.saison, v.details]);
    } else if (f.type === "lieu") {
      var tete = [v.interieur, v.typelieu].filter(Boolean).join(" ") + (v.ville ? (v.interieur || v.typelieu ? " in " : "") + v.ville : "");
      out = this.join([tete, v.elements, v.mobilier ? "furnished with " + v.mobilier : "", v.materiaux ? "made of " + v.materiaux : "", v.palette ? "color palette of " + this.et(v.palette) : "",
        v.moment, v.meteo, v.lumiere, v.ambiance, v.premier ? "foreground: " + v.premier : "", v.arriere ? "background: " + v.arriere : "", v.echelle,
        v.texte ? "with visible text '" + v.texte + "'" : ""]);
    } else if (f.type === "objet") {
      var base = [v.tailleobjet, v.couleur, v.matiere, v.typeobjet].filter(Boolean).join(" ");
      out = this.join([base, v.etat, v.details, v.marque ? "bearing the invented brand name '" + v.marque + "'" : "", v.texte ? "with the text '" + v.texte + "' written on it" : ""]);
    } else out = "";
    return this.propre(out);
  },
  // Aucun guillemet français (réservés aux répliques), aucun emoji, espaces propres
  // 02/10 — majuscule après un point (« background. Eye level ») ; « navy blue, dusty pink » → « navy blue and dusty pink »
  propre: function (s) {
    return String(s || "").replace(/[«»“”]/g, "'").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu, "").replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1")
      .replace(/([.!?] )([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).trim();
  },
  et: function (s) { s = String(s || ""); var i = s.lastIndexOf(", "); return i === -1 ? s : s.slice(0, i) + " and " + s.slice(i + 2); },
  pvEn: function (f, id) { var d = this.def(f.type, id, true); return d ? this.en(f, Object.assign({ pv: true }, d)) : ""; },
  fin: function (f) {   // fin commune des prompts : rendu, netteté, « Avoid »
    var rendu = this.pvEn(f, "rendu") || "photorealistic", ev = this.pvEn(f, "aEviter");
    return rendu + ", tack-sharp, no film grain." + (ev ? " Avoid: " + ev.replace(/[.\s]+$/, "") + "." : "");
  },
  fiches_liees: function (f, ids) { var self = this; return (ids || []).map(function (i) { return self.fiche(i); }).filter(Boolean); },
  combinaison: function (f, cid) { return (f.combinaisons || []).find(function (c) { return c.id === cid; }) || null; },
  // Contexte d'un prompt : tenue, lieu, objets, cadrage et action venant d'une combinaison, sinon des valeurs par défaut de l'avatar
  contexte: function (f, cid) {
    var c = cid ? this.combinaison(f, cid) : null, L = f.liens || {};
    var tenue = this.fiche(c ? c.tenue : L.tenueDefaut), lieu = this.fiche(c ? c.lieu : L.lieuDefaut);
    var objets = this.fiches_liees(f, c ? c.objets : []);
    var cadre = c && c.cadrage ? this.listeEn("cadrage", c.cadrage) : "";
    var action = c && c.action ? this.tradDe(f, "c:" + c.id + ":action", c.action).en : "";
    return { tenue: tenue && tenue.type === "tenue" ? tenue : null, lieu: lieu && lieu.type === "lieu" ? lieu : null, objets: objets, cadrage: cadre, action: action, combi: c };
  },
  // Prompt d'aperçu (image) selon le type d'image ; opts : { combinaison, typeImage }
  apercu: function (f, opts) {
    opts = opts || {};
    var nom = this.nomDe(f), adn = this.adn(f), pv = f.priseDeVue || {}, type = opts.typeImage || pv.typeImage || this.typeImageDefaut(f.type);
    var cx = this.estPersonne(f.type) ? this.contexte(f, opts.combinaison) : { tenue: null, lieu: null, objets: [], cadrage: "", action: "" };
    var cadre = cx.cadrage || this.pvEn(f, "cadrage"), angle = this.pvEn(f, "angle"), obj = this.pvEn(f, "objectif"), lum = this.pvEn(f, "lumiere"), prof = this.pvEn(f, "profondeur");
    var tenueAdn = cx.tenue ? this.adn(cx.tenue) : "", lieuAdn = cx.lieu ? this.adn(cx.lieu) : "";
    var objAdn = cx.objets.map(function (o) { return "holding " + this.art(this.adn(o)); }, this).join(", ");
    var cam = this.join([cadre, angle, obj, lum, prof]), p;
    if (type === "planche") {
      p = "Character reference sheet of " + nom + ": " + adn + (tenueAdn ? " wearing " + tenueAdn : "") +
        ". Three views side by side on a plain light grey background: front, three-quarter, profile, " + (cadre || "full body shot") + ", neutral relaxed expression. " +
        (this.pvEn(f, "rendu") || "photorealistic") + ", soft even studio light, tack-sharp, no film grain." + (this.pvEn(f, "aEviter") ? " Avoid: " + this.pvEn(f, "aEviter").replace(/[.\s]+$/, "") + "." : "");
    } else if (type === "lieuvide") {
      p = "Empty location reference: " + (f.type === "lieu" ? adn : lieuAdn || adn) + ". " + this.join([cadre || "wide establishing shot", angle, obj, lum, prof]) + ", no people. " + this.fin(f);
    } else if (type === "packshot") {
      p = "Product reference of " + (f.type === "objet" ? adn : (cx.objets[0] ? this.adn(cx.objets[0]) : adn)) + " on a plain background, " + (angle || "three-quarter view") + ", studio light. " + this.fin(f);
    } else if (type === "pleinpied") {
      var qui = this.estPersonne(f.type) ? nom + ", " + adn + (tenueAdn ? ", wearing " + tenueAdn : "") : "a neutral model wearing " + (f.type === "tenue" ? adn : tenueAdn || adn);
      p = "Full body shot of " + qui + ", standing in a natural relaxed pose on a plain light grey background. " + this.join(["", angle, obj, lum, prof]).replace(/^,\s*/, "") + (angle || obj || lum || prof ? ". " : "") + this.fin(f);
    } else {   // portrait en situation
      var qui2 = this.estPersonne(f.type) ? nom + ", " + adn + (tenueAdn ? ", wearing " + tenueAdn : "") : "a person " + (f.type === "tenue" ? "wearing " + adn : "with " + adn);
      p = qui2 + (objAdn ? ", " + objAdn : "") + ", " + (cx.action || "in a natural relaxed pose") + (lieuAdn ? " in " + lieuAdn : "") + ". " + (cam ? cam + ". " : "") + this.fin(f);
    }
    return this.propre(p);
  },
  // Prompt de combinaison (avatar + tenue + lieu + objets + action) : aperçu « en situation » et document du Chef
  promptCombinaison: function (f, cid) {
    var c = this.combinaison(f, cid); if (!c || !this.estPersonne(f.type)) return "";
    return this.apercu(f, { combinaison: cid, typeImage: "portrait" });
  },
  // Champs libres à traduire : [{ cle, fr }] ceux qui manquent ou dont le français a changé
  atraduire: function (f) {
    var self = this, out = [];
    var scan = function (list, pv) {
      list.forEach(function (d) {
        if ((d.t !== "t" && d.t !== "z") || d.nt || d.hors || (d.a && f.type !== "avatar")) return;
        var fr = String(self.brut(f, Object.assign({ pv: pv }, d)) || "").trim();
        if (fr && !self.tradDe(f, d.id, fr).ok) out.push({ cle: d.id, fr: fr });
      });
    };
    scan(this.schemaDe(f.type), false); scan(this.schemaDe("pv"), true);
    (f.combinaisons || []).forEach(function (c) { var fr = String(c.action || "").trim(); if (fr && !self.tradDe(f, "c:" + c.id + ":action", fr).ok) out.push({ cle: "c:" + c.id + ":action", fr: fr }); });
    return out;
  },
  // Traduit les champs libres par l'IA de l'Atelier (un appel par champ, mis en cache) ; sans IA : le français reste, rien ne bloque
  traduire: function (f) {
    var self = this, P = window.AgnesPlugins, at = P && P.isLoaded && P.isLoaded("atelier") ? P.get("atelier") : null, todo = this.atraduire(f), faits = 0, echecs = 0;
    if (!todo.length) return Promise.resolve({ faits: 0, echecs: 0 });
    if (!at || !at.chat) return Promise.resolve({ faits: 0, echecs: todo.length });
    return todo.reduce(function (chain, t) {
      return chain.then(function () {
        return Promise.resolve().then(function () {
          return at.chat([{ role: "system", content: "Translate to concise natural English for an image prompt. Output only the translation." }, { role: "user", content: t.fr }]);
        }).then(function (m) {
          var en = String(m && m.content !== undefined ? m.content : m || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
          if (!en) throw new Error("vide");
          f.traductions = f.traductions || {}; f.traductions[t.cle] = { fr: t.fr, en: en }; faits++;
        }).catch(function () { echecs++; });
      });
    }, Promise.resolve()).then(function () { if (faits) self.touch(f); return { faits: faits, echecs: echecs }; });
  },
  touch: function (f) { if (f) f.modifie = Date.now(); this.saveFiches(); },

  // Règles du style du projet, ajoutées à l'envoi au moteur (non recopiées dans le prompt affiché)
  styleNote: function () {
    var P = window.AgnesPlugins, S = P && P.isLoaded && P.isLoaded("styles") ? P.get("styles") : null, st = S && S.courant ? S.courant(this.core.getProject()) : null;
    return st ? st.nom : "";
  },

  // =====================================================================
  // DOCUMENT POUR L'ATELIER et envoi
  // =====================================================================
  resume: function (f) {
    var self = this, groupes = {}, ordre = [];
    this.visibles(f).forEach(function (d) {
      var v = self.brut(f, d); if (self.vide(v)) return;
      var aff = d.t === "l" ? (self.valeur(d.l || d.id, v) || { fr: v }).fr : d.t === "m" ? (Array.isArray(v) ? v : [v]).map(function (x) { return (self.valeur(d.l || d.id, x) || { fr: x }).fr; }).join(", ") : String(v) + (d.unit ? " " + d.unit : "");
      if (!groupes[d.g]) { groupes[d.g] = []; ordre.push(d.g); }
      groupes[d.g].push("- " + d.label + " : " + aff);
    });
    return ordre.map(function (g) { return "### " + g + "\n" + groupes[g].join("\n"); }).join("\n\n");
  },
  documentNom: function (f) { return "Studio — " + this.nomDe(f); },
  documentMarkdown: function (f) {
    var self = this, L = [], T = (this.TYPES.find(function (t) { return t[0] === f.type; }) || [0, f.type])[1], date = new Date().toISOString().slice(0, 10);
    L.push("# " + this.documentNom(f), "", "- Type : " + T, "- Nom : " + this.nomDe(f), "- Collection : " + (f.collection || "—"), "- Date : " + date, "- Identifiant de fiche : " + f.id, "",
      "## ADN (anglais, une ligne — à recopier tel quel dans la Bible)", this.adn(f), "", "## Résumé (français)", this.resume(f) || "(aucun champ rempli)", "");
    if (this.estPersonne(f.type)) {
      var liens = (f.liens.tenues.concat(f.liens.lieux).concat(f.liens.objets)).map(function (i) { return self.fiche(i); }).filter(Boolean);
      if (liens.length) {
        L.push("## Fiches liées (à ranger comme entrées séparées de la Bible : costume, lieu, objet)");
        liens.forEach(function (x) {
          var k = { tenue: "costume", lieu: "lieu", objet: "objet" }[x.type] || x.type;
          L.push("### " + x.nom + " (" + k + ", fiche " + x.id + (f.liens.tenueDefaut === x.id ? ", tenue par défaut" : f.liens.lieuDefaut === x.id ? ", lieu par défaut" : "") + ")", "ADN : " + self.adn(x), "");
        });
      }
      if ((f.combinaisons || []).length) {
        L.push("## Combinaisons enregistrées");
        f.combinaisons.forEach(function (c) {
          var t = self.fiche(c.tenue), l = self.fiche(c.lieu), o = self.fiches_liees(f, c.objets);
          L.push("- " + c.nom + " : tenue " + (t ? t.nom : "—") + ", lieu " + (l ? l.nom : "—") + (o.length ? ", objets " + o.map(function (x) { return x.nom; }).join(", ") : "") + (c.action ? ", action : " + c.action : ""));
          L.push("  Prompt : " + self.promptCombinaison(f, c.id));
        });
        L.push("");
      }
    }
    L.push("## Prompts anglais", "Aperçu : " + this.apercu(f), "");
    var img = f.imageValidee && (f.essais || []).find(function (e) { return e.cle === f.imageValidee; });
    L.push("## Image", img ? "Image validée : oui (essai du " + new Date(img.date).toISOString().slice(0, 10) + ", format " + img.format + ")" : "Image validée : non");
    return L.join("\n");
  },
  consigne: function (f) {
    var k = { avatar: "personnage", personnage: "personnage", tenue: "costume", lieu: "lieu", objet: "objet" }[f.type] || "personnage";
    return "Nouvelle fiche du Studio : document « " + this.documentNom(f) + " » (fiche " + f.id + "). Lis-le avec get_document. " +
      "Crée ou mets à jour la fiche de la Bible avec bible_upsert : type " + k + ", l'ADN tel quel, sans le réécrire. " +
      "Ensuite, si une image est validée, rattache-la avec bible_attacher_image (fiche " + f.id + "). Ne crée aucune carte.";
  },
  // « Envoyer à l'Atelier » : document + message au Chef. Ne touche JAMAIS à la Bible.
  envoyer: function (f) {
    var P = window.AgnesPlugins, at = P && P.isLoaded && P.isLoaded("atelier") ? P.get("atelier") : null;
    if (!at) throw new Error("Activez l'Atelier IA dans ⚙ → Extensions.");
    if (this.nomDe(f) === "Sans nom") throw new Error("Donnez un nom à la fiche (ou un prénom).");
    if (!this.adn(f)) throw new Error("Remplissez au moins un champ : l'ADN est vide.");
    at.addDoc(this.documentNom(f), this.documentMarkdown(f), "Studio", true);
    var ok = at.ask(this.consigne(f));
    (f.envois = f.envois || []).push({ date: Date.now(), document: this.documentNom(f), statut: ok ? "envoyé" : "document seulement" });
    this.touch(f);
    return !!ok;
  },
  imageValidee: function (id) {
    var f = this.fiche(id); if (!f || !f.imageValidee) return Promise.resolve(null);
    return this.core.store.get(f.imageValidee).then(function (b) { return b || null; });
  },

  // =====================================================================
  // COMMANDES POUR CLAUDE (plugin-claude → agnes.py) : aucune ne lance de génération payante
  // =====================================================================
  trouver: function (ref) {
    var q = String(ref || "").trim().toLowerCase();
    var self = this; return this.fiche(ref) || (this.fiches || []).find(function (f) { return String(f.nom).toLowerCase() === q || self.nomDe(f).toLowerCase() === q; }) || null;
  },
  cmdListe: function (type) {
    return (this.fiches || []).filter(function (f) { return !type || f.type === type; }).map(function (f) {
      return { id: f.id, type: f.type, nom: f.nom || (f.champs || {}).prenom || "", collection: f.collection, image_validee: !!f.imageValidee, envoyee: (f.envois || []).length > 0 };
    });
  },
  cmdFiche: function (ref) {
    var self = this, f = this.trouver(ref); if (!f) throw new Error("fiche « " + ref + " » introuvable");
    return { id: f.id, type: f.type, nom: this.nomDe(f), collection: f.collection, niveau: f.niveau, adn: this.adn(f), apercu: this.apercu(f), format: (f.priseDeVue || {}).format,
      combinaisons: (f.combinaisons || []).map(function (c) { return { id: c.id, nom: c.nom, prompt: self.promptCombinaison(f, c.id) }; }),
      image_validee: !!f.imageValidee, envois: f.envois || [], non_traduits: this.atraduire(f).map(function (t) { return t.cle; }) };
  },
  cmdPrompt: function (ref, format) {
    var f = this.trouver(ref); if (!f) throw new Error("fiche « " + ref + " » introuvable");
    return { id: f.id, nom: f.nom, format: format || (f.priseDeVue || {}).format || "9:16", prompt: this.apercu(f) };
  },
  cmdEnvoyer: function (ref) {
    var f = this.trouver(ref); if (!f) throw new Error("fiche « " + ref + " » introuvable");
    var ok = this.envoyer(f); this.render();
    return { id: f.id, nom: f.nom, document: this.documentNom(f), chef_prevenu: ok };
  },

  // =====================================================================
  // PASTILLES BIBLE sur les cartes du Storyboard (lecture seule de la Bible)
  // =====================================================================
  bible: function () { var P = window.AgnesPlugins; return P && P.isLoaded && P.isLoaded("bible") ? P.get("bible") : null; },
  entreesDeCarte: function (shot) {
    var B = this.bible(), proj = this.core.getProject(), s = B && B.seriesOf ? B.seriesOf(proj) : null;
    if (!s) return [];
    return s.entries.filter(function (e) { return B.matches(e, shot, proj); });
  },
  decorerCartes: function () {
    var self = this, A = this.A;
    if (!this.bible()) return;
    document.querySelectorAll("#shotList .shot-card[data-shot]").forEach(function (card) {
      var old = card.querySelector(".av-bible-ligne"); if (old) old.remove();
      var shot = A.findShot(card.getAttribute("data-shot")); if (!shot) return;
      var list = self.entreesDeCarte(shot); if (!list.length) return;
      var ligne = document.createElement("div"); ligne.className = "av-bible-ligne";
      ligne.innerHTML = list.map(function (e) {
        return '<button type="button" class="av-bible-chip" data-avb="' + A.esc(e.id) + '" title="ADN et demande de modification">' +
          ((e.refs || [])[0] && e.refs[0].thumb ? '<img src="' + e.refs[0].thumb + '" alt="">' : "") + "Bible · " + A.esc(e.name) + "</button>";
      }).join("");
      var after = card.querySelector(".refs-block") || card.querySelector(".shot-fields");
      if (after && after.parentNode) after.parentNode.insertBefore(ligne, after.nextSibling);
    });
  },
  ouvrirPastille: function (id) {
    var self = this, A = this.A, B = this.bible(), proj = this.core.getProject(), s = B && B.seriesOf ? B.seriesOf(proj) : null;
    var e = s && s.entries.find(function (x) { return x.id === id; }); if (!e) return;
    var kind = (B.KINDS.find(function (k) { return k[0] === e.kind; }) || ["", e.kind])[1];
    var note = (e.byProject || {})[proj.id] || "";
    var pan = this.core.ui.panel("avatar-bible", "Bible — " + e.name);
    pan.body.innerHTML = '<p class="hint">' + A.esc(kind) + '. Seul le Chef de l\'Atelier modifie la Bible : demandez-lui ci-dessous.</p>' +
      '<div class="field"><label>ADN (anglais)</label><div class="ext-copy">' + A.esc(e.dna || "(vide)") + '</div></div>' +
      (note ? '<div class="field"><label>Note de cet épisode</label><div class="ext-copy">' + A.esc(note) + '</div></div>' : "") +
      '<div class="row-inline"><button type="button" class="small-btn" data-avp="copier">Copier l\'ADN</button></div>' +
      '<div class="field av-demande"><label for="avDemande">Demander une modification au Chef</label><textarea id="avDemande" rows="3" placeholder="Ex. : cheveux plus courts, barbe grisonnante"></textarea></div>' +
      '<button type="button" class="primary-btn" data-avp="demander">Demander une modification au Chef</button>';
    pan.body.onclick = function (ev) {
      var b = ev.target.closest("[data-avp]"); if (!b) return;
      if (b.getAttribute("data-avp") === "copier") { if (navigator.clipboard) navigator.clipboard.writeText(e.dna || "").then(function () { self.core.toast("ADN copié.", "ok"); }); return; }
      var txt = (pan.body.querySelector("#avDemande").value || "").trim(); if (!txt) return self.core.toast("Écrivez la modification voulue.", "err");
      var P = window.AgnesPlugins, at = P && P.isLoaded && P.isLoaded("atelier") ? P.get("atelier") : null;
      if (!at) return self.core.toast("Activez l'Atelier IA dans ⚙ → Extensions.", "err");
      if (at.ask("Modifie la fiche de la Bible « " + e.name + " » : " + txt + ". Utilise bible_upsert puis dis-moi ce qui a changé.")) pan.close();
    };
    pan.open();
  },

  // =====================================================================
  // INTERFACE
  // =====================================================================
  init: function (core) {
    var self = this, A = window.AgnesApp;
    this.core = core; this.A = A;
    this.fiches = []; this.listes = this.listesParDefaut(); this.urls = {};
    this.nav = "avatar"; this.q = ""; this.tri = "recent"; this.sel = ""; this.onglet = ""; this.ouvert = false; this.listeSel = "genre"; this.vue = ""; this.gen = null; this.prets = false;
    this.cfg = core.pluginSettings("avatar", { nav: "avatar" }); this.nav = this.cfg.nav || "avatar";
    this.root = core.ui.addTab("avatar", "Studio", '<div class="av-app" id="avApp"></div>');
    this.app = this.root.querySelector("#avApp");
    this.bind();
    Promise.all([core.store.getKV(this.KEY_FICHES), core.store.getKV(this.KEY_LISTES)]).then(function (r) {
      if (r[0] && r[0].length) self.fiches = r[0];
      if (r[1] && r[1].length) self.fusionnerListes(r[1]);
    }).catch(function () { }).then(function () { self.prets = true; self.render(); });
    core.on("view:change", function (id) { if (id === "view_avatar") self.render(); });
    core.on("shots:render", function () { self.decorerCartes(); });
    core.on("project:change", function () { self.decorerCartes(); });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-avb]"); if (b) self.ouvrirPastille(b.getAttribute("data-avb")); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var z = document.getElementById("avZoom"); if (z) { z.remove(); return; }
      if (self.centreVue !== "galerie" && self.courante() && self.root.classList.contains("active")) { self.ouvert = false; self.centreVue = "galerie"; self.render(); }
    });
  },
  // Listes enregistrées + nouvelles listes d'origine apparues depuis
  fusionnerListes: function (saved) {
    var ids = {}; saved.forEach(function (l) { ids[l.id] = 1; });
    this.listes = saved.concat(this.listesParDefaut().filter(function (l) { return !ids[l.id]; }));
  },
  saveFiches: function () {
    var self = this; clearTimeout(this._t);
    this._t = setTimeout(function () { self.core.store.setKV(self.KEY_FICHES, self.fiches); }, 300);
  },
  saveListes: function () { return this.core.store.setKV(this.KEY_LISTES, this.listes); },
  courante: function () { return this.fiche(this.sel); },
  typeNom: function (t) { return (this.TYPES.find(function (x) { return x[0] === t; }) || [0, t])[1]; },
  urlDe: function (cle) {
    var self = this;
    if (this.urls[cle]) return Promise.resolve(this.urls[cle]);
    return this.core.store.get(cle).then(function (b) { if (!b) return ""; return (self.urls[cle] = URL.createObjectURL(b)); });
  },
  vignetteCle: function (f) { return f.imageValidee || ((f.essais || []).slice(-1)[0] || {}).cle || ""; },

  // ----- filtre et tri de la galerie -----
  liste_filtree: function () {
    var n = this.nav, q = this.q.trim().toLowerCase(), list = this.fiches.filter(function (f) {
      if (n === "favoris") return f.favori;
      if (n.indexOf("collection:") === 0) return f.collection === n.slice(11);
      if (["avatar", "personnage", "tenue", "lieu", "objet"].indexOf(n) !== -1) return f.type === n;
      return true;
    }).filter(function (f) { return !q || (f.nom + " " + f.collection + " " + (f.etiquettes || []).join(" ")).toLowerCase().indexOf(q) !== -1; });
    var tri = this.tri;
    return list.sort(function (a, b) { return tri === "nom" ? String(a.nom).localeCompare(b.nom) : tri === "note" ? (b.note || 0) - (a.note || 0) : (b.modifie || 0) - (a.modifie || 0); });
  },

  render: function () {
    if (!this.app || !this.prets) return;
    var self = this, A = this.A, esc = A.esc, n = this.nav;
    var cols = {}; this.fiches.forEach(function (f) { if (f.collection) cols[f.collection] = (cols[f.collection] || 0) + 1; });
    var cnt = function (t) { return self.fiches.filter(function (f) { return f.type === t; }).length; };
    var navBtn = function (id, label, nb) { return '<button type="button" class="av-nav-btn" data-avn="' + esc(id) + '" aria-pressed="' + (n === id) + '">' + esc(label) + (nb !== undefined ? ' <span class="av-nb">' + nb + "</span>" : "") + "</button>"; };
    var navHtml = '<nav class="av-nav" aria-label="Création d\'avatar">' +
      this.TYPES.map(function (t) { return navBtn(t[0], self.NAV_PLURIEL[t[0]], cnt(t[0])); }).join("") +
      '<span class="av-nav-sep"></span>' + navBtn("favoris", "Favoris", this.fiches.filter(function (f) { return f.favori; }).length) +
      Object.keys(cols).sort().map(function (c) { return navBtn("collection:" + c, "Collection " + c, cols[c]); }).join("") +
      '<span class="av-nav-sep"></span>' + navBtn("listes", "Listes (éditer)") + navBtn("echanges", "Import / Export") + "</nav>";
    // 02/10 — disposition : au centre l'écran de visualisation avec ses prompts et son format (fiche ouverte), sinon la galerie ;
    // à droite les réglages de la fiche seulement
    var fiche = this.courante(), studio = !!fiche && n !== "listes" && n !== "echanges" && this.centreVue !== "galerie";
    var centre;
    if (n === "listes") centre = this.listesHtml();
    else if (n === "echanges") centre = this.echangesHtml();
    else centre = studio ? this.studioHtml(fiche) : this.galerieHtml();
    this.app.className = "av-app" + (fiche ? " av-avec-fiche" : "") + (studio ? " av-mode-studio" : "");
    this.app.innerHTML = navHtml + '<section class="av-centre">' + centre + '</section><aside class="av-fiche" aria-label="Fiche">' + (fiche ? this.ficheHtml(fiche) : this.videHtml()) + "</aside>";
    this.hydrater();
  },
  videHtml: function () {
    return '<div class="av-vide-fiche"><h3>Aucune fiche ouverte</h3><p class="hint">Cliquez une fiche de la galerie, ou créez-en une avec « Nouvelle fiche ».</p></div>';
  },
  galerieHtml: function () {
    var self = this, esc = this.A.esc, list = this.liste_filtree(), n = this.nav;
    var typeNouvelle = ["avatar", "personnage", "tenue", "lieu", "objet"].indexOf(n) !== -1 ? n : "avatar";
    var bar = '<div class="av-barre"><input type="text" id="avQ" class="av-recherche" placeholder="Chercher (nom, collection, étiquette)" value="' + esc(this.q) + '" aria-label="Chercher une fiche">' +
      '<select id="avTri" aria-label="Trier"><option value="recent"' + (this.tri === "recent" ? " selected" : "") + '>Récents</option><option value="nom"' + (this.tri === "nom" ? " selected" : "") + '>Nom</option><option value="note"' + (this.tri === "note" ? " selected" : "") + '>Note</option></select>' +
      '<button type="button" class="primary-btn" data-ava="nouvelle" data-type="' + typeNouvelle + '">Nouvelle fiche</button></div>';
    var cartes = list.map(function (f) {
      var cle = self.vignetteCle(f), fmt = (f.priseDeVue || {}).format || "9:16";
      return '<button type="button" class="av-carte' + (f.id === self.sel ? " sel" : "") + '" data-avf="' + f.id + '" data-fmt="' + fmt + '">' +
        '<span class="av-vignette">' + (cle ? '<img data-cle="' + esc(cle) + '" alt="Image de ' + esc(f.nom) + '">' : '<span class="av-vide">' + esc(self.typeNom(f.type)) + " · " + esc(fmt) + "</span>") + "</span>" +
        '<span class="av-carte-nom">' + esc(self.nomDe(f)) + (f.favori ? ' <span class="av-fav-pt" aria-label="favori"></span>' : "") + "</span>" +
        '<span class="av-carte-meta">' + esc(self.typeNom(f.type)) + (f.collection ? " · " + esc(f.collection) : "") + "</span>" +
        '<span class="av-pastilles">' + (f.imageValidee ? '<span class="ext-tag ok">Image validée</span>' : "") + ((f.envois || []).length ? '<span class="ext-tag">Envoyé</span>' : "") + "</span></button>";
    }).join("");
    return bar + (list.length ? '<div class="av-galerie">' + cartes + "</div>" : '<p class="hint">Aucune fiche ici. Créez-en une avec « Nouvelle fiche ».</p>');
  },
  hydrater: function () {
    var self = this;
    this.app.querySelectorAll("img[data-cle]").forEach(function (img) {
      self.urlDe(img.getAttribute("data-cle")).then(function (u) { if (u) img.src = u; else img.removeAttribute("data-cle"); });
    });
    this.dessinerEcran();
  },

  // ----- fiche -----
  ongletsDe: function (f) { return this.ONGLETS[this.estPersonne(f.type) ? "personne" : f.type] || []; },
  champHtml: function (f, d, pv) {
    var self = this, esc = this.A.esc, id = "avc-" + (pv ? "pv-" : "") + d.id, v = this.brut(f, Object.assign({ pv: pv }, d)), data = ' data-avc="' + d.id + '"' + (pv ? ' data-pv="1"' : "");
    var l = d.l || d.id, lab = '<label for="' + id + '">' + esc(d.label) + (d.hors ? ' <span class="av-hors" title="Ne va pas dans le prompt image : seulement dans le document envoyé au Chef">hors image</span>' : "") + "</label>";
    if (d.t === "l") {
      var L = this.liste(l), vals = L ? L.valeurs : [], retiree = v && this.estRetiree(l, v);
      return '<div class="field">' + lab + '<select id="' + id + '"' + data + '><option value="">—</option>' +
        vals.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === v ? " selected" : "") + ">" + esc(x.fr) + "</option>"; }).join("") +
        (retiree ? '<option value="' + esc(v) + '" selected>' + esc((this.valeur(l, v) || { fr: v }).fr) + " (valeur retirée de la liste)</option>" : "") + "</select></div>";
    }
    if (d.t === "m") {
      var cur = Array.isArray(v) ? v : [], L2 = this.liste(l);
      return '<div class="field" role="group" aria-label="' + esc(d.label) + '">' + '<label>' + esc(d.label) + '</label><div class="chips">' +
        ((L2 ? L2.valeurs : []).map(function (x) { var on = cur.indexOf(x.id) !== -1; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-avm="' + d.id + '" data-v="' + esc(x.id) + '" aria-pressed="' + on + '">' + esc(x.fr) + "</button>"; }).join("")) + "</div></div>";
    }
    if (d.t === "n") return '<div class="field">' + lab + '<div class="av-num"><input type="number" id="' + id + '"' + data + ' value="' + esc(v === undefined ? "" : v) + '" min="0" step="1">' + (d.unit ? '<span class="hint">' + esc(d.unit) + "</span>" : "") + "</div></div>";
    if (d.t === "z") return '<div class="field">' + lab + '<textarea id="' + id + '"' + data + ' rows="2">' + esc(v || "") + "</textarea>" + this.tradBadge(f, d, v) + "</div>";
    return '<div class="field">' + lab + '<input type="text" id="' + id + '"' + data + ' value="' + esc(v || "") + '">' + this.tradBadge(f, d, v) + "</div>";
  },
  tradBadge: function (f, d, v) {
    if (d.nt || d.hors || this.vide(v)) return "";
    return this.tradDe(f, d.id, String(v).trim()).ok ? '<span class="av-trad ok">traduit</span>' : '<span class="av-trad">non traduit</span>';
  },
  ficheHtml: function (f) {
    var self = this, esc = this.A.esc, onglets = this.ongletsDe(f);
    if (onglets.indexOf(this.onglet) === -1) this.onglet = onglets[0];
    var pv = f.priseDeVue || {}, fmt = pv.format || "9:16";
    var tete = '<div class="av-fiche-tete"><h3 class="av-fiche-titre">Réglages de la fiche</h3>' +
      '<div class="av-titre"><input type="text" id="avNom" class="av-nom" value="' + esc(f.nom) + '" placeholder="Nom de la fiche" aria-label="Nom de la fiche">' +
      '<button type="button" class="av-favori" data-ava="favori" aria-pressed="' + !!f.favori + '" title="Favori"><span class="av-etoile" aria-hidden="true"></span><span class="av-sr">Favori</span></button></div>' +
      '<div class="av-ligne"><label>Type <select id="avType">' + this.TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === f.type ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") + "</select></label>" +
      '<label>Collection <input type="text" id="avCol" value="' + esc(f.collection) + '" list="avCols"></label>' +
      '<label>Note <select id="avNote">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '"' + (i === (f.note || 0) ? " selected" : "") + ">" + (i ? i + " / 5" : "—") + "</option>"; }).join("") + "</select></label></div>" +
      '<datalist id="avCols">' + Object.keys(this.fiches.reduce(function (o, x) { if (x.collection) o[x.collection] = 1; return o; }, {})).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
      '<div class="av-ligne"><span class="hint">Niveau</span><div class="chips" role="group" aria-label="Niveau de détail">' +
      this.NIVEAUX.map(function (x) { return '<button type="button" class="chip' + (x[0] === (f.niveau || 1) ? " on" : "") + '" data-avniv="' + x[0] + '" aria-pressed="' + (x[0] === (f.niveau || 1)) + '">' + x[1] + "</button>"; }).join("") + "</div></div></div>";
    var onglet = '<div class="av-onglets" role="tablist">' + onglets.map(function (o) { return '<button type="button" role="tab" class="av-onglet" data-avo="' + esc(o) + '" aria-selected="' + (o === self.onglet) + '">' + esc(o) + "</button>"; }).join("") + "</div>";
    var corps;
    if (this.onglet === "Liens") corps = this.liensHtml(f);
    else if (this.onglet === "Prise de vue") corps = this.priseHtml(f);
    else {
      var champs = this.visibles(f).filter(function (d) { return d.g === self.onglet; });
      corps = '<div class="av-champs">' + champs.map(function (d) { return self.champHtml(f, d, false); }).join("") + "</div>" +
        (champs.length ? "" : '<p class="hint">Aucun champ à ce niveau.</p>') +
        '<p class="hint">Niveau « ' + this.NIVEAUX[(f.niveau || 1) - 1][1] + ' » : un champ masqué par le niveau reste enregistré mais n\'entre pas dans le prompt.</p>';
    }
    return tete + onglet + '<div class="av-corps" role="tabpanel">' + corps + "</div>" +
      '<div class="av-fiche-pied"><button type="button" class="small-btn" data-ava="dupliquer">Dupliquer</button><button type="button" class="small-btn" data-ava="supprimer">Supprimer la fiche</button></div>';
  },
  // Centre (fiche ouverte) : en-tête, format et rendu, écran de visualisation, essais, actions, prompts anglais
  studioHtml: function (f) {
    var esc = this.A.esc, fmt = (f.priseDeVue || {}).format || "9:16";
    return '<div class="av-studio"><div class="av-studio-tete"><button type="button" class="small-btn" data-ava="retour">Galerie</button>' +
      '<div class="av-studio-titre"><b>' + esc(this.nomDe(f)) + '</b><span class="hint">' + esc(this.typeNom(f.type)) + (f.collection ? " · " + esc(f.collection) : "") + "</span></div></div>" +
      this.ecranHtml(f, fmt) + this.actionsHtml(f) + '<div class="av-prompts" id="avPrompts">' + this.promptsHtml(f) + "</div></div>";
  },
  liensHtml: function (f) {
    var self = this, esc = this.A.esc, L = f.liens;
    var coches = function (type, titre, cle) {
      var list = self.fiches.filter(function (x) { return x.type === type; });
      return '<div class="field" role="group" aria-label="' + titre + '"><label>' + titre + "</label>" + (list.length ? '<div class="chips">' + list.map(function (x) {
        var on = L[cle].indexOf(x.id) !== -1; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-avl="' + cle + '" data-v="' + x.id + '" aria-pressed="' + on + '">' + esc(x.nom || "Sans nom") + "</button>";
      }).join("") + "</div>" : '<p class="hint">Aucune fiche de ce type : créez-en une dans la galerie.</p>') + "</div>";
    };
    var sel = function (id, cle, ids) { return '<label>' + (cle === "tenueDefaut" ? "Tenue par défaut" : "Lieu par défaut") + ' <select id="' + id + '" data-avd="' + cle + '"><option value="">—</option>' + ids.map(function (x) { return '<option value="' + x.id + '"' + (L[cle] === x.id ? " selected" : "") + ">" + esc(x.nom) + "</option>"; }).join("") + "</select></label>"; };
    var tenues = this.fiches_liees(f, L.tenues), lieux = this.fiches_liees(f, L.lieux), objets = this.fiches_liees(f, L.objets);
    var combis = (f.combinaisons || []).map(function (c) {
      var op = function (list, cur) { return '<option value="">—</option>' + list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === cur ? " selected" : "") + ">" + esc(x.nom) + "</option>"; }).join(""); };
      var cad = self.liste("cadrage");
      return '<div class="av-combi" data-combi="' + c.id + '"><div class="av-ligne"><input type="text" data-avcb="nom" value="' + esc(c.nom) + '" placeholder="Nom (Mardi — bureau)" aria-label="Nom de la combinaison">' +
        '<button type="button" class="small-btn" data-ava="combi-del" data-id="' + c.id + '">Supprimer</button></div>' +
        '<div class="av-ligne"><label>Tenue <select data-avcb="tenue">' + op(tenues, c.tenue) + '</select></label><label>Lieu <select data-avcb="lieu">' + op(lieux, c.lieu) + "</select></label>" +
        '<label>Cadrage <select data-avcb="cadrage"><option value="">—</option>' + (cad ? cad.valeurs : []).map(function (x) { return '<option value="' + x.id + '"' + (x.id === c.cadrage ? " selected" : "") + ">" + esc(x.fr) + "</option>"; }).join("") + "</select></label></div>" +
        (objets.length ? '<div class="chips">' + objets.map(function (o) { var on = (c.objets || []).indexOf(o.id) !== -1; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-avcbo="' + c.id + '" data-v="' + o.id + '" aria-pressed="' + on + '">' + esc(o.nom) + "</button>"; }).join("") + "</div>" : "") +
        '<label class="av-pleine">Action <input type="text" data-avcb="action" value="' + esc(c.action || "") + '" placeholder="Il présente un document à l\'écran"></label></div>';
    }).join("");
    return coches("tenue", "Tenues liées", "tenues") + coches("lieu", "Lieux liés", "lieux") + coches("objet", "Objets liés", "objets") +
      '<div class="av-ligne">' + sel("avTenueDef", "tenueDefaut", tenues) + sel("avLieuDef", "lieuDefaut", lieux) + "</div>" +
      '<h4 class="av-h4">Combinaisons enregistrées</h4><p class="hint">Une tenue, un lieu, des objets et une action : par exemple « Mardi — bureau ».</p>' + combis +
      '<button type="button" class="small-btn" data-ava="combi-add">Ajouter une combinaison</button>';
  },
  priseHtml: function (f) {
    var self = this, pv = f.priseDeVue || {};
    var champs = this.visibles(f, "pv").map(function (d) { return self.champHtml(f, d, true); }).join("");
    return '<div class="av-champs"><div class="field"><label for="avTI">Type d\'image</label><select id="avTI">' +
      this.TYPES_IMAGE.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === (pv.typeImage || self.typeImageDefaut(f.type)) ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") + "</select></div>" +
      champs + "</div>" +
      '<p class="hint">Le style visuel n\'est pas choisi ici : c\'est le style du projet (onglet Projet → Style des prompts) qui s\'applique à l\'envoi au moteur.</p>';
  },
  ecranHtml: function (f, fmt) {
    var esc = this.A.esc;
    return '<div class="av-visu"><div class="av-ligne"><div class="chips" role="group" aria-label="Format de l\'aperçu">' +
      this.FORMATS.map(function (x) { return '<button type="button" class="chip' + (x === fmt ? " on" : "") + '" data-avfmt="' + x + '" aria-pressed="' + (x === fmt) + '">' + x + "</button>"; }).join("") + "</div>" +
      '<label>Rendu de l\'aperçu <select id="avRendu"><option value="projet">Style du projet</option><option value="realiste"' + (this.rendu === "realiste" ? " selected" : "") + '>Réaliste</option><option value="cartoon"' + (this.rendu === "cartoon" ? " selected" : "") + ">Cartoon</option></select></label></div>" +
      '<div class="av-ecran" id="avEcran" data-fmt="' + fmt + '"><canvas id="avCanvas" width="360" height="360" aria-label="Silhouette du cadrage"></canvas><img id="avImg" alt="Aperçu de la fiche" hidden></div>' +
      '<div class="av-info" id="avInfo" aria-live="polite"></div><div class="av-essais" id="avEssais">' + this.essaisHtml(f) + "</div></div>";
  },
  essaisHtml: function (f) {
    var esc = this.A.esc, essais = f.essais || [];
    if (!essais.length) return '<p class="hint">Aucun essai : « Générer l\'aperçu » fait UNE image (crédits ChatGPT ou Agnes selon ⚙ → Moteurs).</p>';
    return essais.map(function (e, i) {
      var val = e.cle === f.imageValidee, voit = e.cle === this.vue || (!this.vue && (val || i === essais.length - 1));
      return '<div class="av-essai' + (val ? " validee" : "") + (voit ? " voit" : "") + '" data-cle="' + esc(e.cle) + '"><button type="button" class="av-mini" data-ava="voir" data-cle="' + esc(e.cle) + '" aria-label="Voir l\'essai ' + (i + 1) + '"><img data-cle="' + esc(e.cle) + '" alt="Essai ' + (i + 1) + '"></button>' +
        '<span class="av-essai-meta">' + esc(e.format) + (val ? " · Validée" : "") + '</span><div class="av-essai-act"><button type="button" class="small-btn" data-ava="valider" data-cle="' + esc(e.cle) + '">Valider cette image</button>' +
        '<button type="button" class="small-btn" data-ava="agrandir" data-cle="' + esc(e.cle) + '">Agrandir</button><button type="button" class="small-btn" data-ava="suppr-essai" data-cle="' + esc(e.cle) + '">Supprimer</button></div></div>';
    }, this).join("");
  },
  promptsHtml: function (f) {
    var esc = this.A.esc, self = this, adn = this.adn(f), ap = this.apercu(f, { combinaison: this.combiSel }), st = this.styleNote(), nt = this.atraduire(f).length;
    var bloc = function (cle, titre, txt) { return '<div class="av-prompt"><div class="av-ligne"><b>' + titre + '</b><button type="button" class="small-btn" data-ava="copier" data-k="' + cle + '">Copier</button></div><div class="ext-copy" data-pk="' + cle + '">' + esc(txt || "(vide)") + "</div></div>"; };
    var combis = this.estPersonne(f.type) ? (f.combinaisons || []) : [];
    var cb = combis.length ? '<label>Aperçu en situation : <select id="avCombiSel"><option value="">Sans combinaison</option>' + combis.map(function (c) { return '<option value="' + c.id + '"' + (c.id === self.combiSel ? " selected" : "") + ">" + esc(c.nom) + "</option>"; }).join("") + "</select></label>" : "";
    var pc = this.combiSel ? this.promptCombinaison(f, this.combiSel) : "";
    return bloc("adn", "ADN court (Bible)", adn) + cb + bloc("apercu", "Prompt d'aperçu (image)", ap) + (pc ? bloc("combi", "Prompt de combinaison", pc) : "") +
      (st ? '<p class="hint">+ règles du style « ' + esc(st) + ' » ajoutées à l\'envoi au moteur.</p>' : "") +
      (nt ? '<p class="hint">' + nt + ' champ(s) libre(s) non traduit(s) (le français est gardé) <button type="button" class="small-btn" data-ava="traduire">Traduire les champs libres</button></p>' : "");
  },
  actionsHtml: function (f) {
    var gen = this.gen && this.gen.id === f.id;
    return '<div class="av-actions"><button type="button" class="primary-btn" data-ava="generer"' + (gen ? " disabled" : "") + ">Générer l'aperçu</button>" +
      (gen ? '<button type="button" class="small-btn" data-ava="annuler">Annuler</button>' : "") +
      '<button type="button" class="small-btn" data-ava="envoyer">Envoyer à l\'Atelier</button></div>';
  },

  // ----- écran de visualisation -----
  dessinerEcran: function () {
    var self = this, f = this.courante(); if (!f) return;
    var img = document.getElementById("avImg"), cv = document.getElementById("avCanvas"); if (!img || !cv) return;
    var cle = this.vue || this.vignetteCle(f);
    if (cle && (f.essais || []).some(function (e) { return e.cle === cle; })) {
      this.urlDe(cle).then(function (u) { if (!u) return; img.src = u; img.hidden = false; cv.hidden = true; });
    } else {
      img.hidden = true; cv.hidden = false;
      var fmt = (f.priseDeVue || {}).format || "9:16", p = fmt.split(":"), r = (+p[0] || 9) / (+p[1] || 16);
      cv.width = r >= 1 ? 640 : Math.round(640 * r); cv.height = r >= 1 ? Math.round(640 / r) : 640;
      this.silhouette(cv, fmt + " · " + (this.listeLabel("cadrage", (f.priseDeVue || {}).cadrage) || "cadrage libre"), (f.priseDeVue || {}).cadrage);
    }
  },
  listeLabel: function (l, vid) { var v = vid && this.valeur(l, vid); return v ? v.fr : ""; },
  // Silhouette du cadrage (tête et épaules, plus ou moins serrées) avec la grille des tiers
  silhouette: function (cv, etiquette, cadrage) {
    var c = cv.getContext("2d"), w = cv.width, h = cv.height; if (!c) return;
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 1;
    [1, 2].forEach(function (i) { c.beginPath(); c.moveTo(w * i / 3, 0); c.lineTo(w * i / 3, h); c.moveTo(0, h * i / 3); c.lineTo(w, h * i / 3); c.stroke(); });
    var serre = { "gros-plan": 1.6, "rapproche-poitrine": 1.25, "plan-taille": 1, "plan-americain": 0.8, "plein-pied": 0.55, "plan-d-ensemble": 0.3 }[cadrage] || 1;
    var u = Math.min(w, h) * 0.2 * serre, cx = w / 2, tete = h * 0.34;
    c.fillStyle = "rgba(143,160,171,.35)";
    c.beginPath(); c.arc(cx, tete, u * 0.62, 0, 7); c.fill();
    c.beginPath(); c.moveTo(cx - u * 1.5, tete + u * 2.6); c.quadraticCurveTo(cx - u * 1.5, tete + u * 0.9, cx, tete + u * 0.9); c.quadraticCurveTo(cx + u * 1.5, tete + u * 0.9, cx + u * 1.5, tete + u * 2.6); c.closePath(); c.fill();
    c.fillStyle = "rgba(238,240,242,.7)"; c.font = Math.max(12, Math.round(w / 26)) + "px sans-serif"; c.textBaseline = "bottom"; c.fillText(etiquette, 12, h - 12);
  },
  majTitre: function () {
    var f = this.courante(), b = this.app && this.app.querySelector(".av-studio-titre b"); if (f && b) b.textContent = this.nomDe(f);
  },
  majPrompts: function () {
    var f = this.courante(), box = document.getElementById("avPrompts"); if (f && box) box.innerHTML = this.promptsHtml(f);
  },
  majEssais: function () {
    var f = this.courante(), box = document.getElementById("avEssais"); if (!f || !box) return;
    box.innerHTML = this.essaisHtml(f);
    var self = this; box.querySelectorAll("img[data-cle]").forEach(function (img) { self.urlDe(img.getAttribute("data-cle")).then(function (u) { if (u) img.src = u; }); });
    this.dessinerEcran();
  },
  agrandir: function (cle, fmt) {
    var self = this; this.urlDe(cle).then(function (u) {
      if (!u) return;
      var z = document.createElement("div"); z.id = "avZoom"; z.className = "av-zoom"; z.setAttribute("role", "dialog"); z.setAttribute("aria-label", "Image agrandie");
      z.innerHTML = '<button type="button" class="small-btn av-zoom-fermer">Fermer (Échap)</button><div class="av-zoom-cadre" data-fmt="' + self.A.esc(fmt) + '"><img src="' + u + '" alt="Aperçu agrandi"></div>';
      z.addEventListener("click", function (e) { if (e.target === z || e.target.closest(".av-zoom-fermer")) z.remove(); });
      document.body.appendChild(z);
    });
  },

  // ----- génération d'UN aperçu (clic de l'utilisatrice) -----
  refsDe: function (f) {
    var self = this, A = this.A, cx = this.estPersonne(f.type) ? this.contexte(f, this.combiSel) : { tenue: null, lieu: null, objets: [] };
    var liees = [cx.tenue, cx.lieu].concat(cx.objets).filter(function (x) { return x && x.imageValidee; });
    return Promise.all(liees.map(function (x) {
      return self.core.store.get(x.imageValidee).then(function (b) { return b ? A.shrinkBlob(b, 1024) : null; }).then(function (b) { return b ? A.blobToDataUrl(b) : null; }).then(function (d) { return d ? { nom: x.nom, data: d } : null; });
    })).then(function (r) { return r.filter(Boolean); });
  },
  styleApercu: function (f) {
    var texte = !!(f.type === "lieu" && f.champs.texte) || !!(f.type === "objet" && (f.champs.texte || f.champs.marque));
    if (this.rendu === "realiste") return { image: "", texteEcran: texte };
    if (this.rendu === "cartoon") return { image: "Expressive 3D cartoon rendering", texteEcran: texte };
    return null;   // style du projet
  },
  generer: function (f) {
    var self = this, P = window.AgnesPlugins, M = P && P.isLoaded && P.isLoaded("moteurs") ? P.get("moteurs") : null;
    if (!M || !M.genererImage) return this.core.toast("Activez les Moteurs de génération dans ⚙ → Extensions.", "err");
    if (this.gen) return this.core.toast("Un aperçu est déjà en cours.", "err");
    if (!this.adn(f)) return this.core.toast("Remplissez au moins un champ avant de générer.", "err");
    var ctrl = new AbortController(), fmt = (f.priseDeVue || {}).format || "9:16";
    this.gen = { id: f.id, ctrl: ctrl };
    var say = function (t) { var el = document.getElementById("avInfo"); if (el) el.textContent = t || ""; };
    this.render(); say("Préparation (traduction des champs libres)…");
    this.traduire(f).then(function (r) {
      if (r.echecs) self.core.toast(r.echecs + " champ(s) libre(s) non traduit(s) : le français est gardé dans le prompt.", "err");
      return self.refsDe(f);
    }).then(function (refs) {
      var type = (f.priseDeVue || {}).typeImage || self.typeImageDefaut(f.type), prompt = self.apercu(f, { combinaison: self.combiSel });
      return M.genererImage({ prompt: prompt, ratio: fmt, refs: refs, planche: type === "planche", signal: ctrl.signal, onInfo: say, style: self.styleApercu(f) })
        .then(function (blob) { return { blob: blob, prompt: prompt }; });
    }).then(function (r) {
      var cle = "avatar:img:" + f.id + ":" + Date.now().toString(36);
      return self.core.store.put(cle, r.blob).then(function () {
        f.essais = f.essais || []; f.essais.push({ cle: cle, format: fmt, prompt: r.prompt, moteur: M.cfg && M.cfg.image, date: Date.now() });
        while (f.essais.length > self.MAX_ESSAIS) {
          var i = f.essais.findIndex(function (e) { return e.cle !== f.imageValidee; }); if (i === -1) break;
          var old = f.essais.splice(i, 1)[0]; self.core.store.del(old.cle); delete self.urls[old.cle];
        }
        self.vue = cle; self.touch(f); self.core.toast("Aperçu prêt. Validez-le si vous le gardez.", "ok");
      });
    }).catch(function (e) {
      if (!(e && e.cancelled)) self.core.toast((e && (e.display || e.message)) || "Aperçu impossible.", "err");
    }).then(function () { self.gen = null; self.render(); });
  },

  // ----- listes (éditer) -----
  listesHtml: function () {
    var self = this, esc = this.A.esc, L = this.liste(this.listeSel) || this.listes[0];
    if (L) this.listeSel = L.id;
    var opts = this.listes.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === self.listeSel ? " selected" : "") + ">" + esc(l.nom) + "</option>"; }).join("");
    var rows = L ? L.valeurs.map(function (v, i) {
      return '<tr data-vid="' + esc(v.id) + '"><td><input type="text" data-avv="fr" value="' + esc(v.fr) + '" aria-label="Libellé français"></td><td><input type="text" data-avv="en" value="' + esc(v.en) + '" aria-label="Traduction anglaise"></td>' +
        '<td class="av-td-act"><button type="button" class="small-btn" data-ava="v-haut"' + (i ? "" : " disabled") + '>Monter</button><button type="button" class="small-btn" data-ava="v-bas"' + (i < L.valeurs.length - 1 ? "" : " disabled") + '>Descendre</button><button type="button" class="small-btn" data-ava="v-suppr">Supprimer</button></td></tr>';
    }).join("") : "";
    return '<div class="av-barre"><label>Liste <select id="avListeSel">' + opts + '</select></label><button type="button" class="small-btn" data-ava="liste-reset">Rétablir les valeurs d\'origine</button></div>' +
      '<p class="hint">Ces listes alimentent les menus des fiches. Le français s\'affiche dans les menus ; l\'anglais est ce qui entre dans le prompt (vide = rien). Supprimer une valeur ne casse pas les fiches qui l\'utilisent.</p>' +
      '<div class="av-tableau"><table><thead><tr><th>Français</th><th>Anglais (prompt)</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="av-ligne"><input type="text" id="avNvFr" placeholder="Nouvelle valeur (français)" aria-label="Nouvelle valeur en français"><input type="text" id="avNvEn" placeholder="Anglais" aria-label="Nouvelle valeur en anglais"><button type="button" class="small-btn" data-ava="v-ajout">Ajouter une valeur</button></div>';
  },
  echangesHtml: function () {
    return '<div class="card"><h3>Import / Export</h3><p class="hint">Sauvegarde de vos fiches et de vos listes dans un fichier .json (les images d\'aperçu ne sont pas incluses : elles restent dans cet ordinateur).</p>' +
      '<div class="row-inline"><button type="button" class="small-btn" data-ava="export">Exporter (.json)</button><label class="small-btn av-fichier">Importer (.json)<input type="file" id="avImport" accept=".json,application/json" hidden></label></div></div>';
  },
  exporter: function () {
    this.core.download(new Blob([JSON.stringify({ format: "agnes-avatar", version: 1, fiches: this.fiches.map(function (f) { var c = Object.assign({}, f); c.essais = []; c.imageValidee = ""; return c; }), listes: this.listes }, null, 1)], { type: "application/json" }), "creation-avatar.json");
  },
  // 02/10 — Import qui CRÉE OU MET À JOUR par type + nom (pour Claude : agnes.py avatar_importer --fichier …) :
  // une fiche déjà présente garde son identifiant, ses essais et son image validée ; les liens (tenues, lieux, objets,
  // combinaisons) sont recâblés vers les identifiants finaux. Aucune génération, rien n'est envoyé au Chef.
  importerMaj: function (j) {
    var self = this; if (typeof j === "string") j = JSON.parse(j);
    if (!j || j.format !== "agnes-avatar") throw new Error("format non reconnu (format: \"agnes-avatar\")");
    var map = {}, crees = [], majs = [], norm = function (s) { return String(s || "").trim().toLowerCase(); };
    (j.fiches || []).forEach(function (f) {
      if (!f || !f.type || !self.estType(f.type)) return;
      var base = self.nouvelleFiche(f.type, f.nom || ""), ex = self.fiches.find(function (x) { return x.type === f.type && norm(x.nom) === norm(f.nom); });
      var nv = Object.assign(base, f, { champs: Object.assign({}, f.champs || {}), traductions: Object.assign({}, f.traductions || {}),
        liens: Object.assign(base.liens, f.liens || {}), priseDeVue: Object.assign(base.priseDeVue, f.priseDeVue || {}), modifie: Date.now() });
      if (ex) {
        map[f.id || ex.id] = ex.id;
        Object.keys(nv).forEach(function (k) { if (["id", "essais", "imageValidee", "envois", "cree"].indexOf(k) === -1) ex[k] = nv[k]; });
        majs.push(ex);
      } else {
        var id = "av" + self.A.uid(); map[f.id || id] = id;
        nv.id = id; nv.essais = []; nv.imageValidee = ""; nv.envois = []; nv.cree = Date.now();
        self.fiches.push(nv); crees.push(nv);
      }
    });
    var re = function (x) { return map[x] || x; };
    crees.concat(majs).forEach(function (f) {
      var L = f.liens; ["tenues", "lieux", "objets"].forEach(function (k) { L[k] = (L[k] || []).map(re); });
      L.tenueDefaut = re(L.tenueDefaut || ""); L.lieuDefaut = re(L.lieuDefaut || "");
      (f.combinaisons || []).forEach(function (c) { c.tenue = re(c.tenue || ""); c.lieu = re(c.lieu || ""); c.objets = (c.objets || []).map(re); });
    });
    this.saveFiches(); this.render();
    return { crees: crees.map(function (f) { return f.type + " « " + self.nomDe(f) + " »"; }), mis_a_jour: majs.map(function (f) { return f.type + " « " + self.nomDe(f) + " »"; }) };
  },
  estType: function (t) { return ["avatar", "personnage", "tenue", "lieu", "objet"].indexOf(t) !== -1; },
  importer: function (txt) {
    var j = JSON.parse(txt), self = this; if (!j || j.format !== "agnes-avatar") throw new Error("format non reconnu");
    var ids = {}; this.fiches.forEach(function (f) { ids[f.id] = 1; });
    (j.fiches || []).forEach(function (f) { if (ids[f.id]) f.id = "av" + self.A.uid(); f.essais = []; f.imageValidee = ""; self.fiches.push(f); });
    if (j.listes && j.listes.length) this.fusionnerListes(this.listes.filter(function (l) { return !j.listes.some(function (x) { return x.id === l.id; }); }).concat(j.listes));
    this.saveFiches(); this.saveListes();
    return (j.fiches || []).length;
  },

  // ----- événements -----
  bind: function () {
    var self = this, app = this.app;
    var cur = function () { return self.courante(); };
    app.addEventListener("click", function (e) {
      var t = e.target, b;
      if ((b = t.closest("[data-avn]"))) { self.nav = b.getAttribute("data-avn"); self.cfg.nav = self.nav; self.cfg.save(); self.centreVue = "galerie"; self.render(); return; }
      if ((b = t.closest("[data-avf]"))) { self.sel = b.getAttribute("data-avf"); self.ouvert = true; self.centreVue = "studio"; self.vue = ""; self.combiSel = ""; self.onglet = ""; self.render(); return; }
      if ((b = t.closest("[data-avniv]"))) { var f0 = cur(); f0.niveau = +b.getAttribute("data-avniv"); self.touch(f0); self.render(); return; }
      if ((b = t.closest("[data-avo]"))) { self.onglet = b.getAttribute("data-avo"); self.render(); return; }
      if ((b = t.closest("[data-avm]"))) {
        var f1 = cur(), id = b.getAttribute("data-avm"), v = b.getAttribute("data-v"), a = Array.isArray(f1.champs[id]) ? f1.champs[id] : [];
        f1.champs[id] = a.indexOf(v) === -1 ? a.concat([v]) : a.filter(function (x) { return x !== v; }); self.touch(f1);
        b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); self.majPrompts(); return;
      }
      if ((b = t.closest("[data-avl]"))) {
        var f2 = cur(), k = b.getAttribute("data-avl"), v2 = b.getAttribute("data-v"), arr = f2.liens[k];
        f2.liens[k] = arr.indexOf(v2) === -1 ? arr.concat([v2]) : arr.filter(function (x) { return x !== v2; });
        if (k === "tenues" && f2.liens.tenueDefaut === v2 && f2.liens[k].indexOf(v2) === -1) f2.liens.tenueDefaut = "";
        if (k === "lieux" && f2.liens.lieuDefaut === v2 && f2.liens[k].indexOf(v2) === -1) f2.liens.lieuDefaut = "";
        self.touch(f2); self.render(); return;
      }
      if ((b = t.closest("[data-avcbo]"))) {
        var f3 = cur(), c = self.combinaison(f3, b.getAttribute("data-avcbo")), o = b.getAttribute("data-v"); if (!c) return;
        c.objets = (c.objets || []).indexOf(o) === -1 ? (c.objets || []).concat([o]) : c.objets.filter(function (x) { return x !== o; });
        self.touch(f3); b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); self.majPrompts(); return;
      }
      if ((b = t.closest("[data-avfmt]"))) { var f4 = cur(); f4.priseDeVue.format = b.getAttribute("data-avfmt"); self.touch(f4); self.render(); return; }
      if ((b = t.closest("[data-ava]"))) self.action(b.getAttribute("data-ava"), b);
    });
    app.addEventListener("input", function (e) {
      var t = e.target, f = cur();
      if (t.id === "avQ") { self.q = t.value; var pos = t.selectionStart; self.render(); var q = document.getElementById("avQ"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } } return; }
      if (!f) return;
      if (t.id === "avNom") { f.nom = t.value; self.touch(f); self.majTitre(); self.majPrompts(); return; }
      if (t.id === "avCol") { f.collection = t.value.trim(); self.touch(f); return; }
      if (t.hasAttribute("data-avc")) { self.setChamp(f, t); return; }
      if (t.hasAttribute("data-avcb")) { var c = self.combinaison(f, t.closest("[data-combi]").getAttribute("data-combi")); if (c) { c[t.getAttribute("data-avcb")] = t.value; self.touch(f); self.majPrompts(); } return; }
      if (t.hasAttribute("data-avv")) {
        var L = self.liste(self.listeSel), v = L && L.valeurs.find(function (x) { return x.id === t.closest("tr").getAttribute("data-vid"); });
        if (v) { v[t.getAttribute("data-avv")] = t.value; self.saveListes(); }
      }
    });
    app.addEventListener("change", function (e) {
      var t = e.target, f = cur();
      if (t.id === "avTri") { self.tri = t.value; self.render(); return; }
      if (t.id === "avListeSel") { self.listeSel = t.value; self.render(); return; }
      if (t.id === "avImport") {
        var file = t.files[0]; t.value = ""; if (!file) return;
        file.text().then(function (x) { var n = self.importer(x); self.render(); self.core.toast(n + " fiche(s) importée(s).", "ok"); }).catch(function (er) { self.core.toast("Import : " + er.message, "err"); });
        return;
      }
      if (t.id === "avRendu") { self.rendu = t.value; return; }
      if (!f) return;
      if (t.id === "avType") { f.type = t.value; f.priseDeVue.typeImage = self.typeImageDefaut(f.type); self.onglet = ""; self.touch(f); self.render(); return; }
      if (t.id === "avNote") { f.note = +t.value; self.touch(f); return; }
      if (t.id === "avTI") { f.priseDeVue.typeImage = t.value; self.touch(f); self.majPrompts(); return; }
      if (t.id === "avCombiSel") { self.combiSel = t.value; self.majPrompts(); return; }
      if (t.hasAttribute("data-avc") && t.tagName === "SELECT") { self.setChamp(f, t); return; }
      if (t.hasAttribute("data-avd")) { f.liens[t.getAttribute("data-avd")] = t.value; self.touch(f); self.majPrompts(); return; }
      if (t.hasAttribute("data-avcb") && t.tagName === "SELECT") { var c = self.combinaison(f, t.closest("[data-combi]").getAttribute("data-combi")); if (c) { c[t.getAttribute("data-avcb")] = t.value; self.touch(f); self.majPrompts(); } }
    });
  },
  setChamp: function (f, el) {
    var id = el.getAttribute("data-avc"), pv = el.hasAttribute("data-pv"), val = el.value;
    if (pv) { if (id === "aEviter") f.aEviter = val; f.priseDeVue[id] = val; } else f.champs[id] = val;
    this.touch(f);
    if (id === "prenom") this.majTitre();
    // Un champ libre modifié : le badge « traduit » repasse en « non traduit » ; on rafraîchit seulement les prompts
    var badge = el.parentNode && el.parentNode.querySelector(".av-trad");
    if (badge) { var d = this.def(f.type, id, pv); if (d) { var ok = this.tradDe(f, id, String(val).trim()).ok; badge.className = "av-trad" + (ok ? " ok" : ""); badge.textContent = ok ? "traduit" : "non traduit"; } }
    this.majPrompts();
  },
  action: function (a, b) {
    var self = this, f = this.courante(), A = this.A;
    switch (a) {
      case "nouvelle": {
        var n = this.nouvelleFiche(b.getAttribute("data-type") || "avatar", ""); this.fiches.push(n); this.sel = n.id; this.ouvert = true; this.centreVue = "studio"; this.onglet = ""; this.vue = ""; this.combiSel = "";
        this.nav = this.nav === "listes" || this.nav === "echanges" ? n.type : this.nav; this.saveFiches(); this.render();
        var nom = document.getElementById("avNom"); if (nom) nom.focus(); return;
      }
      case "retour": this.ouvert = false; this.centreVue = "galerie"; return this.render();
      case "favori": f.favori = !f.favori; this.touch(f); return this.render();
      case "dupliquer": {
        var c = JSON.parse(JSON.stringify(f)); c.id = "av" + A.uid(); c.nom = f.nom + " (copie)"; c.essais = []; c.imageValidee = ""; c.envois = []; c.cree = c.modifie = Date.now();
        this.fiches.push(c); this.sel = c.id; this.saveFiches(); return this.render();
      }
      case "supprimer":
        if (!window.confirm("Supprimer la fiche « " + this.nomDe(f) + " » et ses images d'aperçu ? (La Bible et la Bibliothèque ne sont pas touchées.)")) return;
        (f.essais || []).forEach(function (e) { self.core.store.del(e.cle); delete self.urls[e.cle]; });
        this.fiches = this.fiches.filter(function (x) { return x !== f; }); this.fiches.forEach(function (x) {
          ["tenues", "lieux", "objets"].forEach(function (k) { x.liens[k] = (x.liens[k] || []).filter(function (i) { return i !== f.id; }); });
          if (x.liens.tenueDefaut === f.id) x.liens.tenueDefaut = ""; if (x.liens.lieuDefaut === f.id) x.liens.lieuDefaut = "";
        });
        this.sel = ""; this.ouvert = false; this.saveFiches(); return this.render();
      case "copier": {
        var k = b.getAttribute("data-k"), el = this.app.querySelector('[data-pk="' + k + '"]');
        if (el && navigator.clipboard) navigator.clipboard.writeText(el.textContent).then(function () { self.core.toast("Copié.", "ok"); }); return;
      }
      case "traduire":
        this.core.toast("Traduction des champs libres…");
        return this.traduire(f).then(function (r) { self.core.toast(r.faits ? r.faits + " champ(s) traduit(s)." : (r.echecs ? "Aucune IA n'a répondu : le français est gardé." : "Rien à traduire."), r.faits ? "ok" : "err"); self.render(); });
      case "generer": return this.generer(f);
      case "annuler": if (this.gen) this.gen.ctrl.abort(); return;
      case "voir": this.vue = b.getAttribute("data-cle"); this.majEssais(); return;
      case "valider": f.imageValidee = b.getAttribute("data-cle"); this.touch(f); this.majEssais(); return this.render();
      case "agrandir": {
        var e = (f.essais || []).find(function (x) { return x.cle === b.getAttribute("data-cle"); }); return this.agrandir(b.getAttribute("data-cle"), e ? e.format : "9:16");
      }
      case "suppr-essai": {
        var cle = b.getAttribute("data-cle");
        f.essais = (f.essais || []).filter(function (x) { return x.cle !== cle; }); if (f.imageValidee === cle) f.imageValidee = ""; if (this.vue === cle) this.vue = "";
        this.core.store.del(cle); delete this.urls[cle]; this.touch(f); return this.render();
      }
      case "envoyer": {
        if (!f.imageValidee && !window.confirm("Aucune image n'est validée : le Chef créera la fiche de la Bible sans image. Envoyer quand même ?")) return;
        try { var ok = this.envoyer(f); this.core.toast(ok ? "Envoyé : le Chef de l'Atelier va créer la Bible (autorisations dans l'Atelier IA)." : "Document ajouté à l'Atelier ; le Chef est occupé : demandez-lui de le lire.", ok ? "ok" : undefined); }
        catch (er) { this.core.toast(er.message, "err"); }
        return this.render();
      }
      case "combi-add": f.combinaisons.push({ id: "c" + A.uid(), nom: "Combinaison " + (f.combinaisons.length + 1), tenue: f.liens.tenueDefaut || "", lieu: f.liens.lieuDefaut || "", objets: [], cadrage: "", action: "" }); this.touch(f); return this.render();
      case "combi-del": f.combinaisons = f.combinaisons.filter(function (c) { return c.id !== b.getAttribute("data-id"); }); if (this.combiSel === b.getAttribute("data-id")) this.combiSel = ""; this.touch(f); return this.render();
      case "export": return this.exporter();
      case "liste-reset":
        if (!window.confirm("Rétablir les valeurs d'origine de cette liste ? Vos valeurs ajoutées sont gardées.")) return;
        this.retablirListe(this.listeSel); this.saveListes(); return this.render();
      case "v-ajout": {
        var fr = document.getElementById("avNvFr"), en = document.getElementById("avNvEn");
        if (!this.ajouterValeur(this.listeSel, fr.value, en.value)) return this.core.toast("Écrivez le libellé français.", "err");
        this.saveListes(); return this.render();
      }
      case "v-suppr": case "v-haut": case "v-bas": {
        var L = this.liste(this.listeSel), vid = b.closest("tr").getAttribute("data-vid"), i = L.valeurs.findIndex(function (x) { return x.id === vid; });
        if (a === "v-suppr") this.supprimerValeur(this.listeSel, vid);
        else { var j = a === "v-haut" ? i - 1 : i + 1; if (j < 0 || j >= L.valeurs.length) return; var tmp = L.valeurs[i]; L.valeurs[i] = L.valeurs[j]; L.valeurs[j] = tmp; }
        this.saveListes(); return this.render();
      }
    }
  }
});
