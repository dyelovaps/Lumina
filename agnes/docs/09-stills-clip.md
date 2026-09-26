# 09 — Stills → Clip

*Extension « Stills → Clip » — active par défaut (désactivable dans ⚙).*

Importez d'un coup toutes vos **images de plan**, faites dans ChatGPT, Midjourney ou ailleurs. L'app les **classe par numéro**, leur **associe leur prompt** et crée les plans **Image → Vidéo** prêts à être animés par Agnes.

[← Retour au README](../README.md)

---

## En bref
1. **Nommez** vos images avec un numéro au début : `01.png`, `02.png`, `03.png`…
2. **Écrivez** vos prompts d'animation en les numérotant de la même façon : `01 : …`, `02 : …`
3. Onglet **Stills → Clip** → déposez les images, collez les prompts, vérifiez la liste, puis **Créer les plans**.

---

## 1. Nommer les images
Le numéro doit être **au début du nom**. Tout ce qui suit est ignoré.

| Nom du fichier | Reconnu comme |
|---|---|
| `01.png`, `1.jpg`, `001.webp` | Plan 1 |
| `plan_03.png`, `Plan 03 - cuisine.jpg`, `shot-3.png`, `sc3.png` | Plan 3 |
| `05a.png` + `05b.png` | **Plan 5 en Première + dernière frame** (a = début, b = fin) |
| `05_debut.png` + `05_fin.png`, `05_start.png` + `05_end.png` | Idem |
| `ChatGPT Image 23 sept. 2026, 10_14_03.png` | **Sans numéro** : placé à la fin (vous pourrez le numéroter dans la liste) |

> 💡 Les noms donnés par ChatGPT commencent par « ChatGPT Image » : renommez-les `01`, `02`… avant l'import, ou donnez-leur un numéro directement dans la liste de vérification.

Les images **sans numéro** sont placées après les autres, dans l'**ordre alphabétique** ou par **date du fichier** (réglage « Images sans numéro »).

## 2. Les prompts
Trois façons de faire, qui se combinent.

**a) Une liste numérotée**, collée dans la zone de texte ou importée (`.txt`, `.md`, `.json`, `.csv`) :
```
01 : Léa pose son dossier sur le comptoir, regard fatigué
02 : La porte vitrée s'ouvre et se referme doucement
3. L'agent lève les yeux de son écran, sans se lever
Plan 04 — Le néon grésille au-dessus du comptoir vide
[05] Lent travelling avant sur le visage de Léa
```
Formats reconnus : `01 :`, `01.`, `01)`, `01 -`, `Plan 01 —`, `[01]`, `**01.**`… Un prompt peut s'étaler sur plusieurs lignes : tout ce qui suit un numéro lui appartient, jusqu'à la ligne vide ou au numéro suivant. Pour une paire début/fin, un seul prompt `05 :` suffit (`05a :` et `05b :` marchent aussi).

**b) Un fichier `.txt` par image**, au même nom : `04.txt` à côté de `04.png`. Déposez-les avec les images.

**c) Des prompts sans numéros**, séparés par une **ligne vide** : ils sont attribués dans l'ordre des plans.

**Formats de fichiers acceptés**
| Format | Exemple |
|---|---|
| `.txt` / `.md` | comme la liste ci-dessus |
| `.csv` | `01;Léa pose son dossier…` (séparateur `;`, `,` ou tabulation) |
| `.json` | `{"01": "…", "02": "…"}` ou `[{"n": 1, "prompt": "…"}]` ou `["…", "…"]` |

**Texte ajouté à chaque prompt** : par exemple `no text, no music, realistic handheld feel`.

> ✍️ **Décrivez le mouvement, pas l'image** : elle est déjà là. « Elle lève lentement les yeux vers la caméra, la pluie coule sur la vitre » donne un bien meilleur résultat que la description de la scène. C'est aussi ce qui limite le plus les inventions.

## 3. Réglages (appliqués à tous les plans)
| Réglage | Détail |
|---|---|
| Format | **Automatique** : le format Agnes le plus proche de chaque image (16:9, 9:16, 1:1, 4:3, 3:4) · celui du **projet** · ou un format imposé |
| Durée | En secondes (5 conseillé) |
| Tenue de la scène | **Scène verrouillée** (par défaut) : la vidéo part de l'image et y revient, l'IA n'invente presque rien · **Standard** : l'image sert de départ, la suite est libre |
| Mouvement | **Subtil** (par défaut), **modéré** ou **libre** |
| Verrou d'identité | Rien d'inventé, pas de coupe, même personnage du début à la fin |

Détail de ces options : [02 — Storyboard, Image → Vidéo](02-storyboard.md#image--vidéo--tenir-la-scène).

> 📐 **Format des images ChatGPT** : 1024×1536 (portrait) devient **3:4**, 1536×1024 (paysage) devient **4:3**. Pour TikTok, demandez directement à ChatGPT une image **9:16**, ou imposez « 9:16 » ici (l'image risque alors d'être recadrée).

## 4. Vérification
La liste montre, pour chaque plan : les miniatures, le **numéro** (modifiable), le type (*Image → Vidéo* ou *Début + fin*), le format retenu, le **prompt** (modifiable) et d'où il vient (numéro, ordre, fichier .txt, nom du fichier).

En haut, un résumé signale **en rouge** les plans **sans prompt** et les **numéros en double**. ✕ retire une image.

**Créer les plans** :
- les images vont dans la **Bibliothèque** (« Plan 01 », « Plan 05 — début »…) ;
- les plans sont ajoutés **à la fin du Storyboard**, dans l'ordre des numéros ;
- cochez **Lancer l'animation tout de suite** pour les mettre directement en file.

## Astuces
- **Clé imgbb** indispensable ici : Agnes doit recevoir vos images par une URL publique ([01](01-reglages.md)).
- Pour ajouter les **visages de vos personnages** en plus de la scène, passez ensuite un plan en « Scène + références personnages » dans le Storyboard.
- Des images tirées d'une vidéo existante ? **Extraire → → Stills → Clip** les envoie ici, déjà numérotées ([19](19-extracteur.md)).
- Vous avez aussi des **prompts image** (images à générer par Agnes) ? **Le lot → Script numéroté** gère les deux dans le même script ([03](03-le-lot.md)).
- Pour animer plusieurs images **sans** numérotation ni prompt par image : **Le lot**, opération *Image → Vidéo*.
