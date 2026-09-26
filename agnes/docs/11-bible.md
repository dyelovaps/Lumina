# 11 — Bible de continuité

*Extension « Bible de continuité » — à activer dans ⚙.*

La bible garde vos **personnages, lieux, objets et costumes identiques** d'un plan à l'autre et d'un épisode à l'autre. Chaque fiche a un **ADN**, une description stable ajoutée **automatiquement** au prompt final quand le plan en a besoin.

[← Retour au README](../README.md)

---

## Série
Une bible = **une série**, partagée par tous ses épisodes (projets).
- **+ Série** · **Renommer** · **Supprimer** · **Exporter (.json)** · **Importer (.json)** (images de référence comprises).
- **Style commun de la série** : ajouté à **tous** les prompts de tous les épisodes (ex. `cyber-noir, cold teal and deep red neon, 35mm anamorphic, no text, no subtitles, no music`).

**Comment un épisode est relié à sa bible**, dans l'ordre :
1. la série choisie dans le menu de l'onglet Bible ;
2. sinon, la bible qui porte **le même nom** que la série de l'épisode (onglets Publication, Épisodes ou Planning).

Un **nouveau projet n'est jamais rattaché d'office** à la bible d'une autre série : il démarre sans bible. **+ Créer la bible de ce projet** pour une nouvelle série ; pour un nouvel épisode, choisissez la série dans le menu (ou donnez le même nom de série).
*(Les projets créés avant la version 3.9 gardent l'ancienne règle : s'il n'existe qu'une bible, ils l'utilisent.)*

Sous le menu, l'onglet indique **avec quels autres projets la bible est partagée**. Si ce projet est en réalité une autre série : **+ Nouvelle bible pour ce projet**, ou **Ne pas utiliser de bible ici**. Les fiches de l'autre série ne sont pas touchées.

Choisir « — aucune série pour ce projet — » désactive aussi la bible pour ce projet.

## Fiches
| Champ | Rôle |
|---|---|
| Nom | Tel qu'il apparaît dans vos prompts (« Léa ») |
| Type | Personnage, Lieu / décor, Objet / accessoire, Costume / look, Autre |
| Alias | Autres façons de le nommer, séparées par des virgules (« Lea, la juge ») |
| **ADN** | Description stable, **en anglais de préférence** : âge, morphologie, visage, cheveux, peau, signes distinctifs, tenue par défaut |
| **Note pour cet épisode** | Ce qui change **dans cet épisode seulement** : tenue, blessure, coiffure (ex. `wet raincoat, bandage on right hand`) |
| Ajouter aussi quand le prompt cite le nom | Sinon, l'ADN n'est ajouté que si la référence de la fiche est utilisée en ingrédient ou en source |
| Images de référence | **+ Image de référence** ou **Depuis la bibliothèque…** |

Le compteur « n plan(s) ici » montre combien de plans de l'épisode utilisent la fiche.

### Exemple d'ADN efficace
```
Léa, 34-year-old French woman, sharp oval face, high cheekbones, dark brown
shoulder-length hair with a side part, olive skin, small scar on left eyebrow,
hazel eyes, charcoal tailored coat over a white shirt
```
Évitez les émotions et les actions dans l'ADN : elles changent d'un plan à l'autre et vont dans le prompt du plan.

## Quand l'ADN est-il ajouté ?
Au moment de la génération, pour chaque plan, si :
- une référence du plan (source, début/fin, ingrédient) est une image **reliée à la fiche** (copiée depuis la bible, ou qui porte le même nom) ;
- **ou** le prompt du plan **cite le nom ou un alias** (si l'option est cochée).

Sont alors ajoutés : l'ADN, la note de l'épisode, puis le style commun de la série.
➡️ Vérifiez le résultat avec **📖 Prompt final** sur la carte du plan.

## Boutons utiles
| Bouton | Effet |
|---|---|
| **→ Bibliothèque de cet épisode** | Copie les images de référence de la fiche dans la bibliothèque de l'épisode ouvert, déjà reliées |
| **Depuis la bibliothèque…** | Ajoute une image de la bibliothèque à la fiche |
| **Relier les références aux plans** | Pour les plans en mode **Ingrédients**, ajoute la référence de chaque personnage cité s'il manque |

## Méthode conseillée pour une nouvelle série
1. Créez la série, puis une fiche par personnage principal et par lieu récurrent.
2. Générez une **fiche personnage** (face/profil/dos) dans la Bibliothèque ([05](05-bibliotheque.md)) et ajoutez-la à la fiche.
3. Écrivez l'ADN à partir de cette image.
4. À chaque épisode : **→ Bibliothèque de cet épisode**, puis travaillez en **Ingrédients → Vidéo** ou **Image → Vidéo**.
5. Exportez la bible (.json) de temps en temps : c'est votre « bible de série ».
