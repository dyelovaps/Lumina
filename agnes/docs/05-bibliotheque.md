# 05 — Bibliothèque (ingrédients)

Les images de référence du projet : **personnages, décors, objets, styles**. Elles servent de source, de première/dernière image, ou d'ingrédient dans les plans.

[← Retour au README](../README.md)

---

## Ajouter un ingrédient
1. **Image ou vidéo** : choisissez un fichier.
   - **Image** : tracez un rectangle pour **recadrer** (ex. isoler un personnage). Sans rectangle, l'image entière est gardée. *Annuler le recadrage* pour recommencer.
   - **Vidéo** : lisez-la jusqu'au bon moment, puis capturez la **Première image**, l'**Image affichée** ou la **Dernière image**.
2. Renseignez :

| Champ | Détail |
|---|---|
| Nom | Utilisez le même nom que dans vos prompts et la Bible (ex. « Léa ») : la Bible le reconnaît |
| Type | Personnage, Décor, Objet, Style, Source (lot), Autre |
| Seed associé | Optionnel : seed qui a produit ce personnage, pour le retrouver |
| URL publique | Optionnel : si l'image est déjà en ligne, elle est envoyée telle quelle à Agnes |
| Générer aussi une fiche personnage IA | Crée automatiquement un plan Image → Image « face / profil / dos ». Le résultat arrive dans la bibliothèque |

3. **Ajouter à la bibliothèque**.

## Actions sur un ingrédient
| Bouton | Action |
|---|---|
| **→ Vidéo** | Crée un plan Image → Vidéo avec cette image comme source |
| **→ Image** | Crée un plan Image → Image |
| **Fiche IA** | Génère une fiche personnage (face / profil / dos) à partir de cette image |
| **Renommer** | Change le nom (la Bible s'appuie dessus) |
| **Retirer** | Supprime l'ingrédient (le fichier n'est effacé que si plus aucun plan ne l'utilise) |

Les filtres en haut de la liste affichent un seul type (Personnage, Décor…).

## Bonnes pratiques de continuité
- Une **fiche personnage** (face/profil/dos sur fond neutre) est la meilleure référence pour garder un visage identique.
- Pour un décor récurrent, capturez une image **sans personnage**.
- Reliez les ingrédients à la **Bible** ([11](11-bible.md)) : leur description est alors ajoutée automatiquement au prompt.
- Les images sont mises en ligne via **imgbb** au premier usage, puis l'URL est réutilisée ([01](01-reglages.md)).
