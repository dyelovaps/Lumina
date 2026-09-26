# 02 — Storyboard

C'est l'onglet principal. On y écrit les plans, on choisit comment chacun est généré, et on garde les meilleures prises.

[← Retour au README](../README.md)

---

## Découpage du scénario (création rapide)
1. Collez votre texte dans **Découpage du scénario**. Chaque paragraphe, séparé par une ligne vide, devient un plan.
2. Choisissez le **Mode par défaut** (ex. Texte → Vidéo).
3. Cliquez **Découper en plans**.

Format, durée, nombre de sorties et style viennent des réglages du **Projet** ([08](08-projet.md)).

> Pour un vrai scénario avec dialogues et personnages, utilisez plutôt l'onglet **Scénario** ([10](10-scenario.md)) : il sépare actions et répliques.

## Les modes de génération

| Mode | Il faut fournir | Résultat | Usage typique |
|---|---|---|---|
| **Texte → Image** | Un prompt (+ références facultatives) | Image | Plan fixe, décor, recherche de look |
| **Image → Image** | Une image **source** | Image | Modifier une image en gardant sa base (tenue, lumière, angle) |
| **Ingrédients → Image** | 1 à 5 **ingrédients** | Image | Réunir un personnage et un décor dans une même image |
| **Texte → Vidéo** | Un prompt (+ références facultatives) | Vidéo | Plan d'ambiance ; avec des références, un personnage récurrent |
| **Texte → Vidéo + prompt image** (« Texte → Image → Vidéo ») | Un prompt image, un prompt vidéo (+ références) | Image validée, puis vidéo | La méthode la plus fiable, dans **une seule carte** (voir ci-dessous) |
| **Image → Vidéo** | Une image **source** (+ références en mode « Scène + références ») | Vidéo | Animer une image validée : meilleure continuité |
| **Première + dernière frame → Vidéo** | Image de **début** et de **fin** | Vidéo | Mouvement maîtrisé d'un état A à un état B |
| **Ingrédients → Vidéo** | 1 à 5 **ingrédients** | Vidéo | Personnage récurrent dans une scène nouvelle |

**Références possibles** : n'importe quelle image de la **Bibliothèque** ([05](05-bibliotheque.md)), ou **« Dernière image du plan précédent »**. Cette dernière option enchaîne les plans sans coupure visible : le plan attend automatiquement que le précédent soit terminé.

## Texte → Image → Vidéo (une seule carte)
En mode **Texte → Vidéo**, la carte a deux zones de texte : **Prompt image** (facultatif) et **Prompt vidéo**.
- Prompt image **vide** : Texte → Vidéo classique.
- Prompt image **rempli** : la carte devient « Texte → Image → Vidéo ».
  1. **Générer l'image** : l'image est créée avec le prompt image et **les références de la carte** (2 variantes par défaut, réglage *Variantes*). Le plan passe en **« image à valider »**.
  2. Cliquez la bonne variante dans **Image de départ** (**Agrandir** pour la voir en grand, **Nouvelle image** pour en refaire).
  3. **Animer cette image →** : Image → Vidéo avec le prompt vidéo, en *Scène verrouillée* et *mouvement subtil* par défaut.
- **Animer sans attendre ma validation** enchaîne les deux étapes d'un coup.
- Une carte **Texte → Image** déjà générée ? **🎬 Convertir (vidéo)** la fait passer directement à l'étape 2, avec ses images.
- Seule la **vidéo** est une prise du plan : l'Assemblage n'utilise jamais l'image de départ.
- **Tout mettre en file** ne lance pas l'animation des images à valider. Pour animer plusieurs plans validés : cochez-les, puis **Générer la sélection**.

> Chaque carte garde **ses propres références** : Léa sur un plan, Marc sur un autre.

## La carte d'un plan

**En-tête**
- ☐ case de sélection (pour agir sur plusieurs plans) · **#numéro** · mode · statut (en attente, en cours, terminé, erreur) · 🎙 si une voix est attachée
- **↑ / ↓** : changer l'ordre · **Dupliquer** · **🗑** supprimer le plan et ses prises

**Vignette et prises**
- La vignette montre la prise sélectionnée. Cliquez dessus pour l'agrandir.
- Si le plan a plusieurs prises (plusieurs sorties ou regénérations), les miniatures en dessous permettent de **choisir la prise** utilisée au montage.

**Réglages du plan**
| Champ | Détail |
|---|---|
| Description | Le prompt du plan. Décrivez l'action et le cadrage ; le style commun vient du Projet et de la Bible |
| Mode | Voir le tableau ci-dessus |
| Format | 16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 21:9, 3:2, 2:3 |
| Résolution | 480p à 4K. **Vidéo 2.5 Flash : toujours 720P** (1080P et 2K avec Agnes Video 2.5, payant). Images : palier 1K (≤ 720p), 2K (1080p, 2K) ou 4K |
| Durée (vidéo) | En secondes : **4 à 12 s** avec Agnes Video 2.5 / 2.5 Flash (une durée hors limites est ramenée dans cette plage) |
| Sorties | 1 à 4 variantes générées d'un coup (chaque variante vidéo reçoit un seed différent) |
| Références | Source, début/fin, ou bloc **Références — personnages, lieux, objets** selon le mode (voir ci-dessous) |
| Tenue de la scène · Mouvement | *(Image → Vidéo)* voir [Image → Vidéo : tenir la scène](#image--vidéo--tenir-la-scène) |
| Verrou d'identité | Case cochée par défaut, voir [ci-dessous](#verrou-didentité) |
| + Ajouter un skill | Mouvement de caméra, cadrage, lumière, style ([04](04-skills.md)) |

**Plus d'options**
- **Seed** : même seed + même prompt = résultat proche. Vide = seed du projet, ou hasard.
- **Prompt négatif** : ce qu'on ne veut pas voir (remplace celui du projet pour ce plan).
- **Force de transformation (0–1)** : en Image → Image, 0 = très proche de la source, 1 = très libre.

**Boutons**
| Bouton | Action |
|---|---|
| **Générer / Regénérer** | Met le plan dans la liste d'attente. Une regénération **ajoute** une prise, elle n'efface rien |
| Annuler | Arrête une génération en cours |
| Télécharger | Enregistre la prise sélectionnée |
| **⬇ 1080p** | *(vidéo)* Agrandit la prise en 1080p (petit côté = 1080 px, bicubique + netteté adaptative) puis la télécharge. Réencodage dans le navigateur : compte la durée de la vidéo, onglet visible. Même réglage que l'« Agrandissement » de l'Assemblage |
| **🎬 Convertir (vidéo)** | *(image)* Garde les images de la carte comme **images de départ** et transforme la carte en plan vidéo (« Texte → Image → Vidéo ») : la prise choisie est présélectionnée, il ne reste qu'à écrire le **prompt vidéo** puis **Animer l'image** |
| → Bibliothèque | *(image)* Ajoute la prise comme ingrédient |
| 1re image / Dernière image → Bibliothèque | *(vidéo)* Capture une image de la vidéo comme ingrédient, idéal pour enchaîner |
| Supprimer la prise | Retire uniquement la prise affichée |
| ⟳ Reprendre le suivi | Apparaît après un « délai dépassé » : interroge à nouveau Agnes pour la **même** tâche, sans relancer ni refacturer |
| ⟳ Récupérer le fichier | Apparaît si le rendu n'a pas pu être enregistré dans l'app (voir [ci-dessous](#aucun-rendu-ou-rendu-en-ligne-sur-un-plan-terminé)) |
| 🎙 Voix | *(extension Voix)* Ouvre le dialogue du plan |
| 📖 Prompt final | *(extension Bible)* Affiche le texte exact envoyé à Agnes |
| Réponse brute | En cas d'erreur : message complet de l'API |

## Références : personnages, lieux, objets
Les modes **Texte → Image**, **Texte → Vidéo**, **Image → Image**, **Ingrédients → Image/Vidéo** (et **Image → Vidéo** en « Scène + références ») affichent un bloc **Références**. Les images choisies sont envoyées à Agnes avec le prompt, pour garder **le même visage, la même tenue, le même décor**.

- **+ Importer** : ajoute une image depuis votre ordinateur, à la fois au plan et à la Bibliothèque. Renommez-la ensuite (nom du personnage ou du lieu) dans la Bibliothèque.
- **Puces** : toutes les images de la Bibliothèque, personnages d'abord, puis décors et objets. Cliquez pour ajouter ou retirer (✓ = utilisée). **5 maximum** par plan (réglable dans ⚙ → options avancées).
- **📖 Depuis la Bible** *(extension Bible)* : un clic sur un personnage ajoute ses images au plan, et son ADN au prompt.

> Une bonne référence : personnage **de face**, **fond neutre**, bien éclairé, en plan américain. La « Fiche personnage IA » de la Bibliothèque en fabrique une.

## Image → Vidéo : tenir la scène
Deux menus sous l'image de la scène.

**Tenue de la scène**
| Choix | Ce qui est envoyé à Agnes | Quand l'utiliser |
|---|---|---|
| **Standard** | L'image comme première image | Le mouvement compte plus que la fidélité |
| **Scène verrouillée** | L'image en **première et en dernière** image clé : la vidéo part de l'image et y revient | **Dialogues, plans où l'on bouge peu** : l'IA n'a presque aucune marge pour inventer |
| **Scène + références personnages** | L'image de la scène, puis vos références (visages, tenues) | Le personnage change d'apparence pendant le plan |

**Mouvement** : **subtil** (respiration, clignements, petits gestes, caméra fixe), **modéré** ou **libre**. Plus le mouvement est ample, plus l'IA doit inventer ce qui n'est pas dans l'image : restez en *subtil* dès que la fidélité compte.

> 🎯 **Méthode la plus fiable** : image du plan en Texte → Image avec les références → vérification → Image → Vidéo en *Scène verrouillée* + *mouvement subtil*. Pour un mouvement ample maîtrisé, utilisez **Première + dernière frame** avec deux images validées.

## Verrou d'identité
Case cochée par défaut sur les plans vidéo et les plans avec références. Elle ajoute au prompt :
- **même visage, même coiffure, même tenue** que les références ;
- **un seul plan continu**, sans coupe ni transformation : un personnage qui change au milieu d'un clip vient très souvent d'une coupe inventée par le modèle ;
- en **Image → Vidéo** : n'animer **que ce qui est déjà dans l'image** (ni personnage, ni objet, ni texte en plus, rien de révélé hors champ), avec un **prompt négatif** automatique (nouveaux personnages, changement de visage, transformation, coupe, texte).

**Décochez-la** si le plan doit justement faire entrer quelqu'un, ou enchaîner plusieurs plans dans un même rendu.

## Aucun rendu ou rendu en ligne sur un plan terminé
Le serveur des vidéos d'Agnes peut refuser qu'une page web télécharge le fichier (blocage « CORS »). La vidéo existe bien : l'app l'affiche alors **directement depuis le lien d'Agnes** (mention « ▶ vidéo · en ligne »). En revanche, **sans fichier local, l'Assemblage et le kit FFmpeg ignorent ce plan**.

Cliquez **⟳ Récupérer le fichier**. L'app réessaie, puis explique la raison exacte en cas d'échec : blocage, lien expiré, ou adresse qui n'est pas une vidéo. Dans ce cas, **1.** ouvrez le rendu, **2.** « Enregistrer la vidéo sous… », **3.** *Joindre le fichier enregistré*. Le plan redevient utilisable partout.

## Agir sur plusieurs plans
Cochez des plans (ou **Tout sélectionner**). Une barre apparaît :
- **Appliquer** : modifie d'un coup le mode, le format, la résolution, la durée, les sorties, ou ajoute un skill aux plans cochés ;
- **Générer la sélection** · **Dupliquer** · **Supprimer** · **Désélectionner**.

**Tout mettre en file** lance tous les plans qui ne sont ni terminés ni déjà en file (en attente ou en erreur).
La barre de progression indique « x / y plans terminés ».

## Conseils
- Validez d'abord une **image** (Texte → Image, plusieurs sorties), puis animez-la en **Image → Vidéo** : c'est plus fiable et moins cher que de multiplier les vidéos.
- Pour garder un personnage identique : **ingrédient** + **Bible** + même **seed**.
- Gardez le prompt vidéo **sans texte, sous-titres ni musique** (skill « Sans texte ni musique »). Ces éléments se gèrent dans Voix, Son et Publication.
