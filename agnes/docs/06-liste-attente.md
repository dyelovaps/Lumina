# 06 — Liste d'attente

Toutes les générations passent par cette file, **tous projets confondus**. Le badge sur l'onglet indique le nombre de tâches en cours ou en attente.

[← Retour au README](../README.md)

---

## Commandes générales
| Commande | Effet |
|---|---|
| **Mettre en pause** / Reprendre | Les tâches en cours finissent, les suivantes attendent |
| **Générations simultanées** | 1 à 4 tâches en parallèle. Agnes autorise environ 20 requêtes par minute : restez à 2–3 pour éviter les refus |
| **Relancer les échecs** | Remet en file toutes les tâches en erreur |
| **Retirer les tâches finies** | Nettoie la liste |
| **Tout annuler** | Arrête tout |

## Sur chaque tâche
- **↑ / ↓** : changer la priorité.
- **Annuler** · **Relancer** (si erreur) · **Voir le plan** (ouvre le projet et le plan concernés).
- La ligne affiche le projet, le plan, l'étape (envoi des références, création, rendu en cours…) et la progression.

## Bon à savoir
- **Reprise automatique** : si vous fermez ou rechargez la page pendant qu'une vidéo se génère chez Agnes, l'app reprend le suivi au prochain démarrage, sans rien refacturer.
- Un plan réglé sur **« dernière image du plan précédent »** attend que le plan précédent soit terminé avant de partir.
- En cas de surcharge de l'API (erreurs 429 ou 5xx), l'app réessaie seule, en espaçant les tentatives.
- **File d'attente vidéo d'Agnes pleine** (503 « video_queue_full ») : la tâche affiche « File d'attente Agnes pleine : nouvel essai dans … » et patiente jusqu'à 20 minutes avant d'abandonner. Gardez *Générations simultanées* à 1 pendant ces périodes.
