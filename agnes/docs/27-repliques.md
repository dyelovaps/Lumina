# 27 — Calculateur de répliques (caractères)

*Extension « Calculateur de répliques » : active par défaut (désactivable dans ⚙). Fichier : `plugins/plugin-repliques.js`. Onglet **Répliques**.*

Mesure vos répliques en **caractères** (plus simple et plus juste que les mots : un mot long prend plus de temps à dire), avec la durée estimée et ce qu'il faut ajouter ou retirer pour tenir la limite. Sert pour les vidéos d'Anthony comme pour les dialogues de série et de court métrage. Le Chef de l'Atelier s'en sert aussi.

[← Retour au README](../README.md)

---

## Dans les cartes du Storyboard (automatique)
Les répliques écrites **entre guillemets** dans le prompt d'une carte (« … », “ … ” ou " … ") sont comptées toutes seules, sous le prompt :
- **Tout va bien** : une petite ligne discrète, par exemple « 💬 155 car. · 6,7 s ». Cliquez-la pour voir le détail.
- **Trop longue ou trop courte** : la ligne passe en rouge (« ⚠ Réplique trop longue : 188 car. (150–180) ») et le détail s'ouvre :
  - la réplique dans un champ modifiable, avec son compteur en direct ;
  - **✔ Corriger ici** : votre version remplace la réplique dans le prompt (seul le texte entre guillemets change) ;
  - **🎬 Demander au Chef** : l'Atelier IA s'ouvre et la demande part toute seule. Le Chef écrit une version plus courte, la mesure, puis demande directement l'autorisation « Remplacer la réplique de la carte #N par : « … » (N caractères) ». **Autoriser** = la réplique est remplacée dans la carte (rien d'autre ne change dans le prompt). Aucun copier-coller. Sans l'Atelier IA, un message vous invite à l'activer.
  - **Garde-fou** : une proposition du Chef qui ne tient pas le réglage (trop longue, trop courte, deux-points que la voix lit mal) ne vous est pas présentée ; elle lui revient avec la raison et il recommence (testé le 30/09 : première version refusée pour « : », seconde à 174 caractères présentée puis appliquée).
- **Réglage du projet** (dans le détail) : Anthony pour le marketing, Série ou Court métrage pour vos épisodes ; il vaut pour toutes les cartes du projet.

### Garde-fou : une réplique travaillée en amont n'est pas « corrigée » pour rien
- **Validée par l'agent Marketing** : si la réplique est mot pour mot celle d'un document « Marketing — date » de l'Atelier (ou des Notes de la carte), elle porte « ✓ validée par l'agent Marketing » et n'est plus signalée pour son nombre de caractères.
- **👍 Garder telle quelle** : vous validez vous-même une réplique ; l'alerte ne revient que si son texte change (**↩ Ne plus garder** pour annuler).
- Seule la **durée** reste contrôlée pour une réplique validée (la parole qui déborde sur le carton), avec la mention « estimation : calibrez la vitesse si la vidéo réelle tient » : si la vraie vidéo tient, **Calibrer** corrige l'estimation pour toutes les cartes.
- **« Phrase longue »** n'est qu'un conseil (gris, jamais rouge), et il n'apparaît pas quand la voix enchaîne d'une traite (réglage Anthony : les points y deviennent des virgules, donc les phrases paraissent longues).

### Plusieurs interlocuteurs dans un même prompt
- **Qui parle** : l'étiquette de chaque réplique est la **pastille du personnage**, comme dans les Références de la carte. Agnes cherche le nom écrit juste avant la réplique : d'abord parmi les références **cochées sur la carte**, puis dans la Bibliothèque, puis « Paul says / Marc répond… ».
  - pastille normale = personnage coché sur la carte ;
  - pastille grisée + « référence pas cochée sur cette carte » = il est dans la Bibliothèque mais pas coché ici (cochez-le pour qu'il ressemble à sa planche) ;
  - « Réplique 3 — qui parle ? » = nom introuvable (« he whispers ») : écrivez son nom juste avant la réplique.
- **Maximum** : vérifié pour **chaque** réplique. **Minimum** : pour tout l'**échange** (une réplique courte comme « Non. » n'est pas une erreur).
- **Durée** : tout l'échange, avec une pause entre deux interlocuteurs (réglage « Pause entre interlocuteurs »). Il doit tenir dans la durée de la vidéo du réglage, ou à défaut **dans la durée de la carte** (ex. 10 s).
- La ligne discrète résume l'échange : « 💬 Léa 62 · Marc 4 → 66 car. · 4,7 s ».
- **Demander au Chef** lui donne tout l'échange : il raccourcit la bonne réplique sans changer qui parle.

## Mesurer dans l'onglet Répliques
1. Onglet **Répliques**.
2. Choisissez le **réglage** (Anthony — TikTok 10 s, Série, Court métrage, Voix-off, ou le vôtre).
3. Collez vos répliques, **une par ligne**. `NOM : réplique` (ou `NOM (off) : …`) est accepté : le nom n'est pas compté.

Pour chaque réplique, une fiche montre :
| Info | Détail |
|---|---|
| Texte tel que dit | Guillemets et deux-points retirés ; si le réglage le demande, les points internes deviennent des virgules (voix d'une traite, comme Grok) |
| **Caractères** | Espaces compris, avec la fourchette du réglage (ex. 150–180) |
| Sans espaces, mots, phrases | Pour comparer |
| Durée | Caractères ÷ vitesse + une petite pause entre les phrases |
| Statut | ✅ Bon · ⬆ Trop court (ajoutez N caractères) · ⬇ Trop long (retirez N caractères, ou la parole finit trop tard) · phrase trop longue |

**📋 Copier le résultat** copie le bilan en texte (pour le coller à une IA ou dans vos notes). Le texte tapé est gardé d'une ouverture à l'autre.

## Les réglages (modifiables)
Ouvrez « Réglage … (modifiable) » :
| Champ | Rôle |
|---|---|
| Caractères minimum / maximum | La fourchette (0 = pas de limite) |
| Caractères par seconde | La vitesse de la voix, espaces compris |
| Pause entre phrases | Ajoutée à la durée à chaque phrase |
| Caractères max par phrase | Au-delà, une alerte (phrase difficile à dire d'une traite) |
| Durée de la vidéo · Secondes gardées après la parole | Ex. 10 s et 2 s de carton de fin : la parole doit finir avant 8 s |
| La voix enchaîne d'une traite | Points internes → virgules (répliques Grok d'Anthony) |

**Enregistrer le réglage** le garde ; **+ Nouveau réglage** en crée une copie à renommer (ex. « Série Mangoustino — Léa ») ; **Valeurs d'origine** remet un réglage fourni.

| Réglage fourni | Caractères | Vitesse | Pour |
|---|---|---|---|
| Anthony — TikTok 10 s (Grok) | 150–180 | 22,5 car./s | Vidéos d'Anthony : parole finie avant 8 s, carton de fin après |
| Série — dialogue | jusqu'à 140 | 15 car./s | Réplique jouée ; plus long = deux plans |
| Court métrage — dialogue | jusqu'à 200 | 14 car./s | Jeu plus posé |
| Voix-off | libre | 16 car./s | Narration |

### Calibrer la vitesse (recommandé)
La vitesse d'origine est une estimation. Pour qu'elle colle à votre voix (Grok, ElevenLabs, comédien) :
1. Mettez en **1re ligne** une réplique déjà générée ou enregistrée.
2. Dans la vidéo, mesurez le temps entre le premier et le dernier mot.
3. Réglage → **Durée réelle de la 1re réplique** → **Calibrer**. La vitesse est recalculée et notée dans le réglage.

## Pour les IA
- **Chef de l'Atelier** : il mesure une réplique avant de la proposer ou de la valider (outil `mesurer_replique`, réglage `anthony`, `serie`, `court`, `voixoff` ou le vôtre) et vous donne le nombre de caractères et la durée. Sans l'extension, il vous demande de l'activer.
- **Agent Marketing** : ses répliques visent la même fourchette (`settings.yaml → video.caracteres_min / caracteres_max`) ; hors fourchette, un avertissement s'affiche (la règle bloquante reste 25–28 mots).
- Autres extensions : `AgnesPlugins.get("repliques").mesurer(texte, "serie")` renvoie le détail, `.resume(texte, id)` le bilan en texte.
