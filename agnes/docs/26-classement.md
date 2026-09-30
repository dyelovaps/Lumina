# 26 — Classement des cartes (par thématique, ou dans un dossier choisi)

*Extension « Classement » : active par défaut (désactivable dans ⚙). Fichier : `plugins/plugin-classement.js`.*

Quand une carte du Storyboard est terminée, le bouton **Classer** copie tout ce qui la concerne sur votre ordinateur. Rien n'est supprimé d'Agnes : c'est une copie. Deux rangements au choix, dans la fenêtre « Classer la carte » :

- **Local : dossier Production, par thématique** (par défaut). Les fichiers passent par le **pont local** (`lancer_pont.bat`). Il n'y a pas de dossier à choisir, et Claude ou un agent peut aussi classer.
- **Dossier choisi dans le navigateur** : le rangement d'origine (Projet / Saison / Épisode / Carte), dans le dossier de votre choix.

[← Retour au README](../README.md)

---

## Rangement local par thématique
Racine : le dossier **Production** (`D:\Rmaopn\a classser\Dernier_projet\TitTok_Histoires_vraie\_BlackLow\Production`). Chaque sous-dossier est une **thématique** : `Serie`, `Film`, `Marketing`, `Court_metrage`… Les dossiers techniques (`App`, `Apps`, `Process_Production`, `Rush_reutilisables`, et ceux qui commencent par « _ ») ne sont pas proposés.

```
Production\
  Serie\<Série>\Ep03\                          Images, Video, Fiches
  Marketing\<Personnage>\20260930 - <sujet>\   Images, Video, Fiches
  Film\<Titre>\   Court_metrage\<Titre>\   <Nouvelle thématique>\<Titre>\   Images, Video, Fiches
```
- Les fichiers de la carte s'appellent **« Carte NN - titre »** : `Images\Carte 05 - titre.png`, `Video\Carte 05 - titre.mp4`, `Fiches\Carte 05 - titre.md`.
- Les dates sont écrites **AAAAMMJJ** (ex. `20260930`).
- **Nouvelle thématique…** dans la liste crée le dossier dans Production (par exemple *Illustration*).
- Les réglages (thématique, nom, épisode ou date, sujet) sont retenus pour le projet : la carte suivante se range au même endroit.
- Le pont n'écrit **que** sous Production, ne supprime rien et ne touche pas aux fichiers déjà présents, sauf les fichiers de cette même carte quand vous la reclassez.
- Les vidéos Google Flow faites en **mode manuel** (voir [24](24-moteurs.md)) sont rangées toutes seules dans `…\Video` de la carte, selon ce réglage.

## Ce qui est copié
- **l'image** de départ choisie sur la carte ;
- **la vidéo** sélectionnée ;
- **la fiche** : prompts image et vidéo, références, et les **Notes** de la carte (Plus d'options → Notes). Pour une vidéo marketing, ce sont la réplique, le montage, le **carton de fin**, la publication, la **description** et les **hashtags** (recopiés par le Chef de l'Atelier, voir [21](21-atelier.md)).

## Classer une carte
1. Sur la carte : **Classer**.
2. **Rangement** :
   - **Local** : choisissez la **thématique**, puis le nom (série, personnage ou titre), l'épisode (série) ou la date AAAAMMJJ et le sujet (marketing). L'emplacement exact s'affiche avant de classer.
   - **Dossier choisi** : la première fois, **Choisir le dossier racine…**, puis vérifiez Projet, Saison, Épisode et le nom du dossier de la carte.
3. **Classer**. Le résumé de la carte affiche ensuite « Classée », avec la date et le dossier.

Classer à nouveau la même carte remplace ses fichiers (par exemple après une nouvelle prise).

## Bon à savoir
- Mode local : si le pont est arrêté, la fenêtre le signale. Lancez `lancer_pont.bat`, ou passez en « Dossier choisi ».
- Mode dossier choisi : le navigateur peut redemander l'autorisation d'écrire après un redémarrage. Sans sélecteur de dossier, les fichiers sont **téléchargés** avec le chemin dans leur nom.
- Une carte sans image ni vidéo donne seulement la fiche.
- L'extension ne dépend d'aucune autre extension. Elle indique aux autres (moteur Flow manuel) le dossier local de la carte.
