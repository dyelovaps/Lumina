# 30 — Studio (anciennement « Création d'avatar », 01/10/2026, renommé le 02/10)

Extension **Studio** (`plugins/plugin-avatar.js`, active par défaut). Où cliquer : **onglet « Studio »**.
Pour la désactiver : ⚙ → Extensions. Sans elle, Agnes marche exactement comme avant.

## À quoi ça sert

Créer, au même endroit, tout ce qui touche à un **avatar ou à un personnage** : son **corps et son visage**, ses **tenues**,
ses **lieux** et ses **objets**. Vous remplissez des listes déroulantes et quelques champs libres en français. Agnes compose
le **prompt anglais**, vous montre un **aperçu** (9:16 ou 16:9), puis vous cliquez sur **Envoyer à l'Atelier** : c'est le
**Chef de l'Atelier** qui crée la fiche de la **Bible** et y rattache l'image. Cet onglet n'écrit **jamais** dans la Bible.

Exemple : Anthony a une tenue différente chaque jour et un lieu différent par scène. La tenue, le lieu et l'objet sont donc
des **fiches séparées**, liées à l'avatar, que vous combinez.

## L'écran

- **À gauche** : Avatars, Personnages, Tenues, Lieux, Objets, Favoris, vos Collections, **Listes (éditer)**, **Import / Export**.
- **Au centre** :
  - sans fiche ouverte : la galerie des fiches (miniature = image validée, sinon le dernier essai), avec Recherche, tri et
    **Nouvelle fiche** ;
  - avec une fiche ouverte (02/10) : l'**écran de visualisation** et tout ce qui va avec, c'est-à-dire le format (9:16, 16:9,
    1:1, 4:5, 3:4), le rendu de l'aperçu, l'écran, les essais, **Générer l'aperçu**, **Envoyer à l'Atelier** et les prompts
    anglais (ADN, aperçu, combinaison). Le bouton **Galerie** (ou la touche Échap) ramène à la galerie.
- **À droite** : les **réglages de la fiche** seulement (nom, type, niveau, onglets de champs, liens). En bas : Dupliquer et
  Supprimer la fiche.
- Écran moyen : le menu de gauche devient une barre horizontale. Petit écran (téléphone) : une seule colonne, avec l'écran
  de visualisation puis les réglages de la fiche en dessous.
- Le nom affiché est celui de la fiche, sinon le **prénom** saisi.

## La fiche

En haut : le nom, le **favori** (le bouton à étoile), le type, la collection, la note de 0 à 5.

**Niveau de détail** : **Essentiel**, **Détaillé** ou **Extrême**. Plus le niveau est élevé, plus il y a de champs. Un champ
rempli puis masqué par le niveau reste enregistré mais **n'entre pas dans le prompt**.

Onglets d'un **avatar / personnage** : Identité, Corps, Visage, Cheveux, Signes, Jeu, **Liens**, **Prise de vue**.
Une **tenue**, un **lieu** ou un **objet** ont leur onglet de champs, puis Prise de vue.

- **Listes** : choix dans un menu (genre, corpulence, teint, coiffure, lumière…). Les couleurs, matières et palettes se
  choisissent à plusieurs.
- **Nombres** : l'âge et la taille en cm. `178` devient `about 1.78 m tall`, `35` devient `35-year-old`.
- **Champs libres** : écrivez en français. Ils sont traduits par l'IA de l'Atelier (voir plus bas).
- Les champs marqués **hors image** (voix, ton de marque, expression, à ne jamais changer…) ne vont pas dans l'image : ils
  vont seulement dans le document pour le Chef.
- Le **style visuel** n'est pas choisi ici : c'est le style du projet (onglet Projet → Style des prompts, [29](29-styles.md))
  qui s'applique à l'envoi au moteur.

### Liens et combinaisons (avatar / personnage)

Dans **Liens** : cochez les tenues, lieux et objets de l'avatar, choisissez la tenue et le lieu **par défaut**, puis créez des
**combinaisons** : un nom (« Mardi — bureau »), une tenue, un lieu, des objets, un cadrage et une action. Une combinaison donne
un **prompt en situation**.

### Prise de vue

Type d'image (planche de référence, portrait en situation, plein pied, lieu vide, packshot d'objet), cadrage, angle, objectif,
lumière, profondeur de champ, rendu, et **À éviter** (devient `Avoid: …` dans le prompt : ChatGPT et Grok ne reçoivent pas le
prompt négatif d'Agnes, c'est donc ici qu'il compte).

## Les prompts anglais

Trois sorties, chacune avec un bouton **Copier** :
1. **ADN court** : une ligne, l'identité stable (sans émotion, sans action, sans décor). C'est ce que le Chef met dans la Bible.
2. **Prompt d'aperçu** : l'image à générer. La planche commence par « Character reference sheet of ».
3. **Prompt de combinaison** : l'avatar avec la tenue, le lieu, les objets et l'action d'une combinaison.

Les listes sont traduites par un **dictionnaire intégré** (sans IA, toujours le même résultat). Seuls les **champs libres** passent
par l'IA : au clic sur **Traduire les champs libres**, ou au premier **Générer l'aperçu**. La traduction est gardée et n'est
refaite que si vous changez le français. Si aucune IA ne répond, le français reste dans le prompt (« non traduit »), rien ne
bloque. Le prénom, la marque inventée et les textes écrits ne sont jamais traduits.

Pas de guillemets « » (réservés aux répliques), pas d'emoji dans les prompts. Les textes à écrire dans l'image sont mis entre
apostrophes.

## Les listes déroulantes (modifiables)

**Listes (éditer)** : choisissez une liste, puis modifiez le français (menu) et l'anglais (prompt), **Monter / Descendre /
Supprimer**, **Ajouter une valeur**. **Rétablir les valeurs d'origine** remet les valeurs d'origine et garde les vôtres.
Supprimer une valeur ne casse pas les fiches qui l'utilisent : elle reste affichée avec « valeur retirée de la liste ».

## L'aperçu : écran de visualisation

- Choisissez le **format** : **9:16**, **16:9**, 1:1, 4:5 ou 3:4. Sans image, une silhouette du cadrage s'affiche.
- **Rendu de l'aperçu** : style du projet (par défaut), Réaliste ou Cartoon.
- **Générer l'aperçu** : un clic = **une** image. Elle passe par **ChatGPT** (pont local) si c'est le moteur d'images choisi dans
  ⚙ → Moteurs, sinon par Agnes. **Elle consomme vos crédits** : Agnes ne la lance jamais toute seule. **Annuler** arrête l'attente.
- Si une tenue, un lieu ou un objet lié a une image validée, elle est envoyée comme **référence** : c'est ce qui garde la cohérence.
- Sous l'écran, les **essais** (12 au plus) : **Valider cette image**, **Agrandir** (Échap pour fermer), **Supprimer**.
  L'image validée est la seule que le Chef rattache à la Bible ; elle n'est jamais effacée par la limite des 12 essais.
- Si le pont ne répond pas : lancez `lancer_pont.bat` dans prod-fruits, ou choisissez Agnes dans ⚙ → Moteurs.

## Envoyer à l'Atelier

Le bouton **Envoyer à l'Atelier** (actif si la fiche a un nom et au moins un champ) :
1. crée ou remplace le document **« Studio — Nom »** dans l'Atelier IA (identifiant de fiche, ADN, résumé en français,
   fiches liées, combinaisons, prompts, image validée oui/non) ;
2. prévient le **Chef**, qui lit le document, crée la fiche de la Bible (**bible_upsert**, ADN recopié tel quel), puis rattache
   l'image validée avec **bible_attacher_image** : l'image est ajoutée à la fiche de la Bible **et** rangée dans la
   **Bibliothèque** de l'épisode. Chaque étape vous demande **votre autorisation** dans l'Atelier IA.

Le Chef ne crée **aucune carte** : les cartes restent créées par vous ou par Claude. Si le Chef est occupé, le document est quand même
ajouté ; demandez-lui de le lire. Si aucune image n'est validée, Agnes vous le dit avant d'envoyer.

## La pastille Bible sur les cartes du Storyboard

Si l'extension **Bible** est active, chaque carte qui utilise une fiche de la Bible (référence cochée ou nom cité dans le prompt)
affiche une pastille **« Bible · Anthony »** sous ses références. Au clic :
- **lire** : le type, l'ADN en anglais, la note de l'épisode, et **Copier l'ADN** ;
- **demander une modification au Chef** : écrivez ce que vous voulez changer, puis **Demander une modification au Chef**.

## Les filtres de la Bible

L'onglet **Bible** a maintenant des boutons **Tous, Personnages, Tenues, Lieux, Objets, Autres** et une recherche par nom ou alias,
comme la Bibliothèque. Le filtre choisi est retenu. L'édition manuelle des fiches reste possible.

## Import / Export

**Exporter (.json)** enregistre vos fiches et vos listes ; **Importer (.json)** les ajoute (sans écraser vos fiches). Les images
d'aperçu ne sont pas dans le fichier.

## Commandes pour Claude (pont local)

Aucune ne lance de génération payante :
```
python agnes.py avatars [type=avatar]                 # liste des fiches (id, type, nom, image validée, envoyée)
python agnes.py avatar id=av… | nom="Anthony"          # fiche complète + ADN + prompts
python agnes.py avatar_prompt id=av… [format=9:16]     # prompt anglais d'aperçu
python agnes.py envoyer_avatar id=av…                  # comme le bouton « Envoyer à l'Atelier »
```
(dans `Production\App\prod-fruits`, avec « Piloté par Claude » actif.)

## Limites

- Les fiches sont **communes à tous les projets** ; elles sont enregistrées dans le navigateur (IndexedDB), comme la Bibliothèque.
- Les types de fiche sont extensibles : la **gestion publicitaire** viendra plus tard, dans une extension à part.
- La qualité de la traduction des champs libres dépend de l'IA disponible dans l'Atelier IA.

## Pour le Chef et pour Claude (02/10/2026)
- **Le Chef** lit vos fiches avec `studio_fiches` et `studio_fiche`, sans autorisation. Il ne les modifie jamais. Il crée la
  Bible à partir du document « Studio — Nom » que vous lui envoyez.
- **Claude** :
  - `python agnes.py avatars`
  - `python agnes.py avatar nom="Nicolas"` (le prénom suffit quand la fiche n'a pas de nom)
  - `python agnes.py avatar_prompt id=av…`
  - `python agnes.py envoyer_avatar id=av…`
- **Prompts plus propres** :
  - majuscule après chaque point ;
  - « navy blue and dusty pink » au lieu d'une liste avec des virgules ;
  - plus de « fabric fabrics ».
