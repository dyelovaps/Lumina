// js/skill-packs.js — Packs de skills prêts à l'emploi (Skills → Import en masse → Packs)
// Chaque skill : [id, nom visible, explication, action cachée (anglais), cible, catégories supplémentaires]
(function () {
  "use strict";
  var A = window.AgnesApp;
  function pack(id, title, category, desc, rows) {
    return { id: id, title: title, description: desc, skills: rows.map(function (r) {
      return { id: "pk-" + id + "-" + r[0], title: r[1], description: r[2], action: r[3], target: r[4] || "both", categories: [category].concat(r[5] || []) };
    }) };
  }
  A.SKILL_PACKS = [
    pack("spatial", "Positions spatiales", "Position spatiale",
      "Où se trouve le personnage et d'où on le voit : voiture, face caméra, canapé, rue, transports… Idéal pour les avatars et le format UGC.", [
      ["car-driver", "Voiture — conducteur", "Le personnage conduit, filmé depuis le siège passager.", "the character sits in the driver's seat of a car, hands on the steering wheel, filmed from the passenger seat, dashboard and side window visible, daylight through the windshield"],
      ["car-dashcam", "Voiture — face caméra (tableau de bord)", "Caméra posée sur le tableau de bord : l'avatar parle face à nous, ceinture attachée. Format UGC très courant.", "the character sits in the driver's seat facing the camera mounted on the dashboard, seatbelt on, talking to camera, car interior and rear window behind, natural daylight"],
      ["car-passenger", "Voiture — passager avant", "Le personnage est côté passager, vu de profil ou de trois quarts.", "the character sits in the front passenger seat of a car, three-quarter view, side window with passing scenery"],
      ["car-back", "Voiture — banquette arrière", "Le personnage est assis à l'arrière, vu depuis l'avant.", "the character sits on the back seat of a car, seen from between the front seats, soft light through the rear windows"],
      ["car-windshield", "Voiture — vu à travers le pare-brise", "On voit le conducteur depuis l'extérieur, à travers le pare-brise.", "view from outside the car through the windshield, the character at the wheel, reflections of the sky on the glass"],
      ["selfie", "Selfie bras tendu", "Le personnage se filme lui-même, bras tendu, en marchant ou sur place.", "handheld selfie point of view, the character holds the phone at arm's length and talks to camera, slight natural wobble, vertical smartphone framing"],
      ["talking-head", "Face caméra (trépied)", "Talking head : face caméra, cadré à la poitrine, caméra fixe.", "the character faces the camera, framed from the chest up, eye contact with the lens, static camera on tripod, softly blurred background"],
      ["studio-plain", "Studio fond uni", "Fond uni de studio, éclairage doux : avatar, publicité, présentation produit.", "the character stands in front of a seamless plain studio backdrop, soft even key light, clean commercial look"],
      ["desk", "Derrière un bureau", "Le personnage est assis derrière un bureau, face caméra.", "the character sits behind a desk facing the camera, laptop and a few objects on the desk, office background slightly out of focus"],
      ["counter", "Derrière un comptoir", "Comptoir d'accueil, de boutique ou de bar.", "the character stands behind a counter, shop or reception interior behind, the counter in the foreground"],
      ["sofa", "Canapé du salon", "Assis dans un canapé, ambiance cosy.", "the character sits on a sofa in a cozy living room, cushions, warm lamp light"],
      ["bed", "Assis sur un lit", "Chambre, lumière douce : confidence, vlog intime.", "the character sits on a bed in a bedroom, soft morning light from the window, intimate atmosphere"],
      ["kitchen", "Dans la cuisine", "Debout dans une cuisine, plan de travail devant.", "the character stands in a home kitchen behind the countertop, utensils and plants around, natural daylight"],
      ["mirror", "Selfie miroir", "Le personnage se filme dans un miroir (salle de bain, dressing).", "mirror selfie, the character holds the phone in front of a mirror, bathroom or dressing room, the reflection fills the frame"],
      ["walk-talk", "Marche et parle", "Le personnage marche vers nous en parlant, la caméra recule.", "walk and talk, the character walks toward the camera while talking, the camera moves backward at the same pace, street background", "video"],
      ["street", "Dans la rue", "Trottoir d'une ville, passants flous en arrière-plan.", "the character stands on a city sidewalk, passers-by blurred in the background, urban daylight"],
      ["cafe", "Terrasse de café", "Assis en terrasse, tasse sur la table.", "the character sits at a café terrace table with a cup, street life softly blurred behind"],
      ["transport", "Dans le métro ou le bus", "Assis près de la fenêtre, le paysage défile.", "the character sits by the window in a metro or bus, city lights passing outside, gentle vibration"],
      ["elevator", "Dans un ascenseur", "Espace clos, reflets métalliques : tension, face-à-face.", "the character stands inside an elevator, brushed metal walls, harsh overhead light, confined space"],
      ["hallway", "Couloir (lycée, bureau)", "Long couloir en perspective, casiers ou portes.", "the character stands in a long hallway with lockers or doors in perspective, fluorescent lighting"],
      ["window", "À la fenêtre", "De dos ou de profil, regard vers l'extérieur.", "the character stands at a window looking outside, seen from behind or in profile, backlit silhouette"],
      ["rain-stop", "Sous la pluie, abribus", "Nuit pluvieuse, reflets sur le bitume.", "the character waits at a bus stop at night in the rain, wet reflective street, streetlight glow"],
      ["parking", "Parking souterrain", "Béton, néons blafards : thriller, rendez-vous secret.", "the character stands in an underground parking garage, concrete pillars, cold flickering fluorescent lights"],
      ["gym", "Salle de sport", "Appareils de musculation autour, ambiance énergique.", "the character stands in a gym among training machines, energetic bright lighting"],
      ["pov", "Vue subjective (POV)", "On voit ce que voit le personnage : ses mains, son point de vue.", "first-person point of view shot, the character's hands visible in the foreground, what they see fills the frame"]
    ]),
    // France : voitures à conduite à gauche, circulation à droite. Les modèles confondent la gauche du personnage,
    // celle de la voiture et celle de l'image : chaque skill « voiture » donne les places EN POSITION DANS L'IMAGE
    // pour un angle de caméra précis. Un seul skill voiture par plan.
    pack("france", "France", "France",
      "Séries tournées en France : contexte français, et voitures françaises (volant à gauche) avec la place exacte du conducteur et du passager dans l'image selon l'angle de caméra.", [
      ["context", "France — contexte", "La scène se passe en France : voitures à volant à gauche, circulation à droite, plaques, rues et intérieurs français.", "the scene takes place in France: French everyday setting, European left-hand-drive cars driving on the right side of the road, French-style license plates with unreadable characters, French street furniture and architecture"],
      ["traffic", "France — circulation à droite", "Rue ou route : les voitures roulent à droite, les voitures d'en face à gauche.", "French traffic drives on the RIGHT side of the road: cars moving away from the camera are in the right lane, oncoming cars are in the left lane; every car is left-hand drive with the driver sitting on the car's left side"],
      ["car-front", "Voiture FR — de face (pare-brise)", "Caméra devant la voiture, à l'extérieur. Conducteur et volant à DROITE de l'image, passager à GAUCHE.", "French left-hand-drive car seen from the front, from outside, through the windshield: the steering wheel and the driver are on the RIGHT side of the image, the front passenger is on the LEFT side of the image (never the British layout)"],
      ["car-dashcam", "Voiture FR — face caméra (tableau de bord)", "Caméra posée sur le tableau de bord, tournée vers les occupants. Conducteur à DROITE de l'image, passager à GAUCHE.", "camera mounted on the dashboard of a French left-hand-drive car, facing the occupants: the driver with the steering wheel is on the RIGHT side of the image, the front passenger is on the LEFT side of the image, rear window behind them"],
      ["car-rear-seat", "Voiture FR — depuis la banquette arrière", "Caméra à l'arrière, tournée vers l'avant. Conducteur et volant à GAUCHE de l'image, passager à DROITE.", "view from the back seat of a French left-hand-drive car looking forward through the windshield: the driver and the steering wheel are on the LEFT side of the image, the front passenger is on the RIGHT side of the image, both seen from behind"],
      ["car-driver-window", "Voiture FR — vitre conducteur (extérieur)", "Caméra dehors, côté conducteur. Le conducteur est au premier plan, l'avant de la voiture et le volant sont à GAUCHE de l'image, le passager derrière lui.", "view from outside the driver's side window of a French left-hand-drive car: the driver is in the foreground closest to the camera, the front of the car, the windshield and the steering wheel are toward the LEFT side of the image, the driver faces image left, the passenger sits further away behind the driver"],
      ["car-passenger-window", "Voiture FR — vitre passager (extérieur)", "Caméra dehors, côté passager. Le passager est au premier plan, l'avant de la voiture est à DROITE de l'image, le conducteur au fond derrière le volant.", "view from outside the front passenger's side window of a French left-hand-drive car: the passenger is in the foreground closest to the camera, the front of the car and the windshield are toward the RIGHT side of the image, the driver sits further away at the steering wheel, facing image right"],
      ["car-from-passenger", "Voiture FR — depuis le siège passager", "Caméra à la place du passager, tournée vers le conducteur : on le voit de profil, regard vers la DROITE de l'image, volant devant lui à droite.", "view from the front passenger seat of a French left-hand-drive car toward the driver: the driver is seen in profile facing the RIGHT side of the image, hands on the steering wheel in front of them on the right of the frame, the driver's side window behind them"],
      ["car-from-driver", "Voiture FR — depuis le siège conducteur", "Caméra à la place du conducteur, tournée vers le passager : on le voit de profil, regard vers la GAUCHE de l'image.", "view from the driver's seat of a French left-hand-drive car toward the front passenger: the passenger is seen in profile facing the LEFT side of the image, the passenger side window behind them, the edge of the steering wheel in the near foreground"],
      ["car-behind", "Voiture FR — de dos (extérieur)", "Caméra derrière la voiture, à l'extérieur. Conducteur à GAUCHE de l'image, passager à DROITE.", "French left-hand-drive car seen from behind, from outside, through the rear window: the driver is on the LEFT side of the image, the front passenger on the RIGHT side of the image, the car drives in the right lane"]
    ]),
    pack("styles", "Styles visuels", "Style visuel",
      "L'esthétique générale du plan : animé, brainrot, UGC smartphone, publicité, VHS, noir et blanc… À combiner avec une position spatiale.", [
      ["anime", "Animé japonais", "Dessin animé japonais 2D, aplats de couleur, grands yeux expressifs.", "Japanese anime style, 2D cel-shaded animation, clean line art, vibrant colors, expressive large eyes, painted background"],
      ["brainrot", "Brainrot (mème absurde)", "Esthétique mème absurde : couleurs saturées, créatures hybrides, énergie chaotique et comique.", "absurd surreal meme aesthetic, hyper-saturated colors, glossy 3D render of a bizarre hybrid creature or object with a human expression, exaggerated features, chaotic comedic energy"],
      ["brainrot-motion", "Brainrot — rythme", "Zooms brusques et timing comique rapide, pour accompagner le style Brainrot.", "fast punchy zoom-ins, snappy comedic timing, sudden exaggerated reactions, energetic camera", "video"],
      ["ugc", "UGC smartphone", "Vidéo d'utilisateur authentique : filmée au téléphone, lumière naturelle, pas « pro ».", "authentic user-generated content, shot on a smartphone, vertical framing, natural available light, slightly imperfect handheld framing, real everyday setting"],
      ["commercial", "Publicité premium", "Pub haut de gamme : lumière travaillée, image impeccable.", "high-end commercial look, polished lighting with soft highlights, pristine product and skin detail, shallow depth of field, premium advertising aesthetic"],
      ["vlog", "Vlog", "Vlog lumineux et naturel, ambiance créateur de contenu.", "bright casual vlog look, natural light, warm tones, relaxed content creator vibe"],
      ["documentary", "Documentaire / reportage", "Caméra à l'épaule, lumière naturelle, rendu reportage.", "documentary look, handheld observational camera, available natural light, candid realistic moments"],
      ["cinema35", "Cinéma 35 mm", "Pellicule 35 mm : grain, couleurs riches, profondeur de champ cinéma.", "shot on 35mm film, fine film grain, rich natural colors, cinematic shallow depth of field, anamorphic feel"],
      ["noir", "Film noir (noir et blanc)", "Noir et blanc contrasté, ombres dures, années 40.", "black and white film noir, high contrast, hard shadows, venetian blind light patterns, 1940s mood"],
      ["vhs", "Rétro VHS années 90", "Image vidéo 90 : bruit, couleurs baveuses, léger flou.", "1990s VHS home video look, analog noise, color bleeding, soft focus, slight tracking distortion"],
      ["telenovela", "Soap / télénovela", "Drame très éclairé, couleurs vives, regards appuyés.", "dramatic soap opera look, bright high-key lighting, saturated colors, intense close-ups and lingering stares"],
      ["cartoon", "Cartoon 2D", "Dessin animé occidental : contours épais, formes simples.", "2D western cartoon style, bold outlines, simple shapes, flat bright colors, playful expressions"],
      ["comics", "Bande dessinée", "Style comics : encrage, trames, couleurs franches.", "comic book illustration style, bold ink lines, halftone shading, flat saturated colors, dynamic composition"],
      ["watercolor", "Aquarelle", "Illustration à l'aquarelle, douce et poétique.", "soft watercolor illustration, paper texture, gentle color bleeds, delicate pastel palette"],
      ["clay", "Pâte à modeler (claymation)", "Personnages et décors en pâte à modeler, texture visible.", "claymation style, characters and sets made of modeling clay, visible fingerprints and texture, handcrafted look"],
      ["stopmotion", "Stop motion", "Animation image par image, mouvements légèrement saccadés.", "stop-motion animation, slightly jerky frame-by-frame movement, handcrafted miniature set", "video"],
      ["pixel", "Pixel art", "Jeu vidéo rétro 16 bits.", "16-bit pixel art style, retro video game look, limited color palette, crisp pixels"],
      ["lowpoly", "3D low-poly", "3D à facettes, couleurs unies, rendu stylisé.", "low-poly 3D style, faceted geometry, flat shaded colors, minimal stylized render"],
      ["minimal", "Épuré minimaliste", "Composition simple, beaucoup d'espace, couleurs neutres.", "minimalist clean aesthetic, simple composition, generous negative space, neutral muted palette"],
      ["dreamy", "Onirique", "Lumière diffuse, halo, atmosphère de rêve.", "dreamy ethereal atmosphere, soft diffused glow, light haze, pastel highlights"]
    ])
  ];
})();
