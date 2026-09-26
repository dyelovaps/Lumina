# 📌 FICHE DE RÉFÉRENCE : STRUCTURATION DES PROMPTS (AGNES AI 2.5 FLASH)

> 💡 **Conseil d'or :** Bien qu'Agnes AI accepte le français, rédigez vos prompts finaux en **anglais** pour obtenir une précision maximale et éviter les contresens de traduction automatique.

---

## 🖼️ 1. STRUCTURE TEXT-TO-IMAGE (Agnes Image 2.5 Flash)

Pour les visuels complexes et à haute densité d'information, suivez cet ordre hiérarchique :

### 📋 La Formule

`[Sujet] + [Environnement / Contexte] + [Style] + [Lumière] + [Composition] + [Exigences de Qualité]`

### 🔧 Bloc par bloc

- **[Subject] :** L'élément central (personnage, objet, produit, créature).
- **[Scene / Environment] :** Le décor, l'arrière-plan, l'époque, le lieu ou l'atmosphère.
- **[Style] :** Style artistique (ex: _cinematic realism, vector illustration, 3D render, oil painting_).
- **[Lighting] :** Type, couleur et direction de la lumière (ex: _golden hour, neon cyberpunk, studio lighting, soft rim light_).
- **[Composition] :** Angle et cadrage (ex: _wide-angle shot, macro, bird's-eye view, rule of thirds_).
- **[Quality Requirements] :** Précision sur les textures fines (ex: _rich architectural details, high visual density, photorealistic skin texture_).

### 📝 Exemple-type

> _« A futuristic cybernetic cyber-panther [Subject] stealthily walking through a rain-slicked Tokyo alleyway at night [Environment], cinematic realism [Style], flickering purple and cyan neon lighting [Lighting], low-angle tracking shot [Composition], sharp reflections on puddles, high visual density [Quality]. »_

---

## 🔄 2. STRUCTURE MULTI-IMAGE / IMAGE-TO-IMAGE

Si vous donnez une ou plusieurs images de référence au modèle pour générer un nouveau visuel :

### 📋 La Formule

`[Rôle des images de référence] + [Scène cible] + [Relation entre les images] + [Style / Lumière / Composition]`

### 📝 Exemple-type

> _« Use <Picture 1> as the main character and <Picture 2> as the clothing style reference. Place the character from Picture 1 into a medieval banquet hall, wearing the outfit from Picture 2. Masterpiece, volumetric lighting, photorealistic. »_

---

## 🎬 3. STRUCTURE TEXT-TO-VIDEO / IMAGE-TO-VIDEO (Agnes Video 2.5 Flash)

Pour la génération de clips, la formule intègre impérativement le mouvement et la notion d'évolution temporelle.

### 📋 La Formule

`[Sujet & Cadre] + [Action & Évolution] + [Mouvement de caméra] + [Style visuel] + [Exigences de cohérence]`

### 🔧 Bloc par bloc

- **[Subject and setting] :** Description précise des personnages/objets, du décor de départ et du moment de la journée.
- **[Action and change] :** Comment le sujet bouge et comment la scène évolue à l'écran au fil des secondes.
- **[Camera language] :** Mouvements de caméra physiques et cinématographiques (ex: _slow camera push, dynamic tracking shot, pan left, tilt up, fixed camera_).
- **[Visual style] :** Palette de couleurs, textures, réalisme et ambiance générale.
- **[Consistency requirements] :** Préciser ce qui ne doit absolument pas bouger ou changer (ex: _maintain facial features consistency, product shape remains intact_).

### 📝 Exemple-type

> _« An astronaut standing on the edge of a Martian cliff looking at a dust storm [Subject & Setting]. The astronaut slowly raises their hand to shield their eyes as lightning crackles within the storm [Action & Change]. Slow camera push-in towards the astronaut's visor [Camera language], cinematic sci-fi film aesthetic, muted orange and red color palette [Visual style]. Maintain strict suit design and helmet reflections throughout the video [Consistency]. »_
