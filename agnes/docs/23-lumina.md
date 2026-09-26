# 23 — Lumina (Grok Imagine) et sauvegarde complète

Agnes peut s'ouvrir **dans l'extension Chrome Lumina** (onglet **Agnes** du panneau latéral). Vous écrivez, préparez la Bible et le storyboard dans Agnes ; Lumina génère les images et les clips sur **Grok Imagine** (et peut le faire seule avec le pilote auto) ; chaque rendu revient dans Agnes comme une **prise** du plan, prête pour l'Assemblage.

[← Retour au README](../README.md)

---

## 1. Ouvrir Agnes dans Lumina
Panneau Lumina → onglet **Agnes** → **Ouvrir Agnes Studio**. Agnes s'ouvre dans un onglet (adresse `chrome-extension://…/agnes/index.html`).

> **Stockage séparé.** Agnes ouverte depuis Lumina ne voit pas les projets de l'`index.html` ouvert directement (chaque adresse a son propre stockage du navigateur). Pour les transférer, voir **§4**. Avantage : dans Lumina, Agnes profite du stockage illimité de l'extension.

## 2. Envoyer des plans vers Grok
- **Depuis Agnes** : Storyboard → **⇢ Grok (Lumina)** (plans cochés, sinon tous), ou **⇢ Grok** sur une carte.
- **Depuis Lumina** : onglet Agnes → choisissez le projet, les plans et le mode, puis **Importer dans le lot** (ou **Importer et lancer**).

Ce que Lumina reçoit pour chaque plan :
| Agnes | Lumina |
|---|---|
| Image validée (Texte → Image → Vidéo), ou image source d'un plan Image → Vidéo | Carte **Stills → Clips** |
| Prompt image + prompt vidéo, sans image | Paire du **Lot mixte** (Grok fait l'image puis le clip) ; sans prompt image, l'image part du prompt vidéo |
| « Dernière image du plan précédent » | Clip « suite » (dernière image du clip d'avant) |
| Références du plan (personnages, décors, objets) | Références Lumina du même nom, désignées dans le prompt |
| Durée 4 à 12 s | 6, 10 ou 15 s (la plus proche) |

Les plans « média » (cartons, récap) sont ignorés. Avec **ADN Bible, skills et style du projet**, Lumina reçoit le prompt final d'Agnes, sans le verrou d'identité propre à Agnes Video (Lumina ajoute ses règles qualité).

## 3. Retour des rendus
Avec **Renvoyer les rendus dans Agnes** (coché par défaut) :
- image générée → **image validée** du plan (à animer dans Agnes ou par Grok) ;
- clip → **nouvelle prise sélectionnée** (marquée `source: "grok"`), le plan passe à « terminé ».

Si Agnes est fermée, Lumina l'ouvre en arrière-plan. Le fichier reste aussi dans Téléchargements.

## 4. Sauvegarde complète et transfert
Onglet **Projet** → carte Export :
- **💾 Sauvegarde complète (.zip)** : tous les projets, médias (prises, bibliothèque, voix, musiques), Bible, équipe de l'Atelier, réglages. Vous choisissez d'y mettre ou non vos clés API.
- **↺ Restaurer une sauvegarde…** : ajoute les projets de la sauvegarde (même projet = remplacé), complète les réglages vides, conserve la Bible et l'équipe déjà présentes ; la page se recharge.

**Transfert vers Lumina** : sauvegarde complète dans l'`index.html` habituel → dans Agnes ouverte depuis Lumina, Restaurer.

## 5. Pilote auto (prod-fruits)
```
python pilote.py lancer-agnes "Nom du projet"
python pilote.py attendre
```
Pré-requis : pont lancé, Lumina ouverte avec **Pilote auto** coché, onglet grok.com/imagine ouvert. `--mode montage` force Stills → Clips.

## Limites
- **Whisper dans le navigateur** (Extraire) ne fonctionne pas dans Lumina : Chrome interdit le code distant dans une extension. Utilisez l'API OpenAI, un fichier de sous-titres, ou l'`index.html` ouvert directement.
- Après une modification d'Agnes (dossier `Agnes_production`), recopiez-la dans Lumina : `npm run sync:agnes` dans le dossier de Lumina, puis rechargez l'extension.
