# 21 — Atelier IA

*Extension « Atelier IA » — active par défaut (désactivable dans ⚙). Fichier : `plugins/plugin-atelier.js`.*

L'Atelier IA est la **salle d'écriture** du studio. Une équipe de 16 agents IA (**Agnes AI** par défaut, avec votre clé Agnes ; en option Google Gemini, Groq, OpenRouter, Mistral ou toute API compatible OpenAI) développe la série étape par étape : concept, bibles, épisodes, scènes, scénario, direction artistique, prompts, storyboard, publication.

Un **Chef de production** coordonne l'équipe. Il fait aussi le lien avec l'app : **avec votre autorisation**, il range le travail au bon endroit (personnages et lieux dans la Bible, scénario dans l'onglet Scénario, prompts dans Le lot, textes dans Publication).

[← Retour au README](../README.md)

---

## Sommaire
1. [Avant de commencer](#1-avant-de-commencer)
2. [L'écran](#2-lécran)
3. [L'équipe](#3-léquipe)
4. [Travailler agent par agent](#4-travailler-agent-par-agent)
5. [Le Chef de production](#5-le-chef-de-production)
6. [Appeler un agent directement avec @](#6-appeler-un-agent-directement-avec-)
7. [Les documents](#7-les-documents)
8. [Personnaliser l'équipe](#8-personnaliser-léquipe)
9. [Importer vos agents RMAOPN AI](#9-importer-vos-agents-rmaopn-ai)
10. [Un épisode de A à Z](#10-un-épisode-de-a-à-z)
11. [Séries et épisodes](#11-séries-et-épisodes)
12. [Bonnes pratiques et limites](#12-bonnes-pratiques-et-limites)
13. [Dépannage](#13-dépannage)

---

## 1. Avant de commencer

### Les fournisseurs d'IA
**Par défaut, l'Atelier utilise Agnes AI avec votre clé Agnes (⚙ Réglages) : rien à configurer.** Les autres fournisseurs sont facultatifs ; en ajouter additionne leurs offres gratuites et sert de relais.

| Fournisseur | Offre gratuite (septembre 2026) | Où prendre la clé | Conseil |
|---|---|---|---|
| **Agnes AI** | 20 requêtes/minute pour les modèles texte, sans limite par jour annoncée. Modèles `agnes-2.5-flash` (par défaut), `agnes-3.0-flash`, `agnes-2.0-flash` ; `agnes-2.5-pro-alpha` est payant | Votre clé Agnes des réglages ⚙ | **Fournisseur principal** : déjà configuré, appels d'outils pris en charge |
| **Google Gemini** | Sans carte bancaire. Flash-Lite : environ 500 requêtes/jour ; Flash : environ 20/jour (les limites de votre compte sont affichées dans AI Studio) | aistudio.google.com → **Get API key** | Bon **relais** : très grand contexte |
| **Groq** | Sans carte bancaire. Environ 30 requêtes/minute et 1 000/jour **par modèle**, mais peu de tokens par minute | console.groq.com → **API Keys** | Très rapide : parfait en **repli**, et pour le chef ou les petits agents |
| **OpenRouter** | Modèles se terminant par `:free` : 20 requêtes/minute, 50/jour tant qu'aucun crédit n'a été acheté | openrouter.ai → **Keys** | Appoint |
| **Mistral** | Mode gratuit limité par modèle, crédits API mensuels | console.mistral.ai | Facultatif |
| **Autre (compatible OpenAI)** | Selon le service | — | Toute API au format OpenAI (`…/v1/chat/completions`) |

Ces offres changent souvent : les chiffres ci-dessus sont indicatifs.

### Se connecter
1. Vérifiez que votre **clé Agnes** est dans ⚙ Réglages : l'Atelier la reprend automatiquement (la ligne Agnes AI affiche « clé des réglages ⚙ utilisée »).
2. *(Facultatif)* Onglet **Atelier IA → Connexion aux IA** : collez d'autres clés dans le tableau (le lien **obtenir une clé** mène au bon site).
3. Laissez **Agnes AI** comme **fournisseur principal** et **Repli automatique** coché.
4. **Enregistrer**, puis **Tester les connexions** : chaque fournisseur est testé avec un seul appel (✅ ou ❌ avec la raison), et la liste de ses modèles disponibles remplit le champ **Modèle**.

Les clés restent dans ce navigateur et ne sont envoyées qu'au fournisseur concerné.

### Le repli automatique
Quand le fournisseur utilisé atteint sa limite (erreur 429, quota du jour épuisé), est surchargé ou ne connaît pas le modèle, l'Atelier refait la même demande chez le **fournisseur suivant configuré**, avec son modèle par défaut. Un message indique qui a pris le relais. Une limite **par minute** est d'abord réessayée une ou deux fois (8 puis 20 s) ; un **quota du jour** épuisé passe directement au suivant. Chaque fournisseur a son propre rythme d'envoi pour rester sous ses limites.

### ⚠️ Confidentialité : à savoir avant d'écrire
Avec les offres gratuites, vos requêtes peuvent servir à améliorer les modèles du fournisseur (Google et Mistral l'indiquent pour leurs offres gratuites). Vos scénarios, vos personnages et vos documents seraient concernés. Pour une série inédite sensible, tenez-en compte : consultez les conditions de chaque fournisseur, ou passez à une offre payante.

### Les réglages communs
| Réglage | Détail |
|---|---|
| Modèle par défaut (par fournisseur) | Celui qu'utilisent les agents sans modèle propre. Chaque agent peut avoir le sien ([8](#8-personnaliser-léquipe)) |
| Créativité | 0 = très constant, 0,7 = équilibré (par défaut), 1 et plus = plus inventif |
| Le chef peut lancer les agents sans me demander | Le chef enchaîne les agents seul. **Le rangement dans l'app reste toujours soumis à autorisation** |

### Les autres extensions utiles
Pour que le chef puisse ranger le travail, activez dans ⚙ : **Bible de continuité**, **Import de scénario** et **Publication**.

---

## 2. L'écran

| Zone | Rôle |
|---|---|
| **Connexion aux IA** (en haut, repliable) | Clés des fournisseurs, fournisseur principal, repli, créativité, test |
| **🎬 Chef de production** (à gauche) | La discussion avec le chef, les demandes d'autorisation, les appels directs avec @ |
| **📎 Documents** (sous la discussion) | Vos fichiers, pages web et textes collés, transmis aux agents choisis |
| **Chaîne de production** (à droite) | Les 16 agents. Cliquez un agent pour voir ce qu'il lit, lui donner une demande, le lancer, relire son travail |

La pastille devant chaque agent indique son état :
| Pastille | État |
|---|---|
| Grise | Rien produit |
| Bleu-gris | Travail produit |
| Verte | Travail **validé** par vous |
| Orange clignotante | Au travail |

---

## 3. L'équipe

| N° | Agent | Lit | Destination dans l'app |
|---|---|---|---|
| 1 | **Développeur de Concept** | votre idée | — |
| 2 | **Bible de Série** | 1 | Bible : style commun, lieux |
| 3 | **Bible de Personnages** | 2 + Bible | Bible : fiches et ADN |
| 4 | **Architecte d'Épisodes** | 2, 3 | — |
| 5 | **Découpeur de Scènes** | 3, 4 + Bible | — |
| 6 | **Scénariste Dialoguiste** | 3, 5 + Bible | **Onglet Scénario** |
| 7 | **Directeur Artistique** | 2, 3 + Bible | Bible : style commun |
| 8 | **Prompt Image** (Agnes Image 2.5) | 3, 5, 7 + Bible + Bibliothèque | Le lot |
| 9 | **Prompt Vidéo** (Agnes Video 2.5) | 5, 6, 8 | Le lot |
| 10 | **Storyboard → Le lot** | 8, 9 + Bibliothèque | **Le lot** |
| 11 | **Vidéo externe** (Seedance / Veo) | 10 | — (pour vos outils externes) |
| 12 | **Package de Production** | 1, 2, 3, 4, 7 | — |
| 13 | **Plan de Tournage Vidéo** | 10 | — |
| 14 | **Community Manager** | 1, 4 | **Publication** |
| 15 | **Expert Montage** | 6, 10 | — |
| 0 | **Auditeur de Continuité** *(hors chaîne)* | 3, 6, 10 + Bible + Bibliothèque | Bible |

**« Lit »** : l'agent reçoit le travail de ces agents (la version que vous avez relue), plus, si indiqué, les fiches de la Bible et les noms de la Bibliothèque. Il reçoit aussi les [documents](#7-les-documents) qui lui sont destinés.

### Les formats écrits pour l'app
Certains agents écrivent directement dans un format que l'app sait lire :
| Agent | Format | Où il sert |
|---|---|---|
| 3, 7, 0 | Une ligne `ADN (anglais) :` par personnage ou lieu, et `STYLE COMMUN (anglais) :` | Bible : l'ADN est ajouté automatiquement aux prompts |
| 6 | Scénario : `INT. LIEU – MOMENT`, actions en paragraphes, `NOM` en majuscules puis la réplique | Onglet Scénario : plans, dialogues, casting |
| 8, 9, 10 | Script numéroté `01 — libellé` / `IMAGE :` / `VIDÉO :` / `RÉF :` | Le lot : une carte **Texte → Image → Vidéo** par numéro, avec ses références ([03](03-le-lot.md)) |
| 14 | Bloc final `FICHE PUBLICATION` (Titre, Accroche, Résumé, Hashtags, Appel à l'action) | Onglet Publication |

> Dans `RÉF :`, les agents 8 et 10 utilisent les **noms de votre Bibliothèque**. Donnez à vos images de référence les mêmes noms que dans la Bible (« Léa », « Cabinet Prunier »).

---

## 4. Travailler agent par agent

1. Cliquez un agent dans **Chaîne de production**.
2. Vérifiez ses **entrées** : en vert celles qui existent, en rouge celles qui manquent.
3. Écrivez la **Demande** : votre idée brute pour l'agent 1 ; pour les autres, l'épisode visé et vos contraintes (« Épisode 2 uniquement », « dialogues très courts », « 6 scènes maximum »).
4. **Lancer l'agent**. Si une entrée manque, l'app vous le signale avant de lancer.
5. **Relisez et corrigez** le travail directement dans la zone de texte. **Les agents suivants lisent votre version corrigée.**
6. **Valider** marque l'étape comme approuvée (pastille verte). **Refaire** relance l'agent, avec une demande ajustée si besoin.
7. Le bouton de destination (**→ Bible**, **→ Onglet Scénario**, **→ Le lot**, **→ Publication**) range le travail dans l'app, après confirmation.

**Ranger dans la Bible** se fait en deux temps : l'app extrait d'abord les fiches (nom, type, ADN) et le style commun, puis vous montre la liste avant d'enregistrer. Une fiche qui existe déjà est mise à jour, sans doublon.

---

## 5. Le Chef de production

Parlez-lui normalement. **Ctrl + Entrée** envoie le message.

| Vous écrivez | Il fait |
|---|---|
| « Voici mon idée : … » | Confie l'idée au Développeur de Concept, puis propose la suite |
| « Continue la chaîne jusqu'au scénario de l'épisode 1 » | Lance les agents dans l'ordre, un par un |
| « Range les personnages dans la Bible » | Lit la bible de personnages, en tire les fiches et l'ADN, puis demande l'autorisation |
| « Envoie le storyboard de l'épisode 1 dans Le lot » | Lit le travail de l'agent 10 et le place dans Le lot |
| « Lis mon script et dis-moi ce qu'il manque » | Lit le document, puis répond ou confie le travail à l'agent compétent |
| « Où en est-on ? » | Fait le point sur la chaîne et propose l'étape suivante |
| « Fais le prompt parfait des cartes 3 à 5 : voiture vue de face, Mangoustino conduit » | Confie les cartes à l'agent 16 **Directeur de plans**, puis écrit ses prompts dans les cartes du Storyboard |
| « Crée-moi un agent qui raccourcit les répliques à 12 mots » | Propose un nouvel agent (nom, consignes, entrées) et le crée après votre accord |

Il connaît à chaque message l'état de chaque agent, votre Bible, votre Bibliothèque et la liste de vos documents. Il **n'écrit pas lui-même** le contenu créatif : il le confie à l'agent compétent, avec une consigne précise.

### Ce qu'il peut faire, et ce qui demande votre accord
| Action | Autorisation |
|---|---|
| Lire le travail d'un agent | Non (lecture seule) |
| Lire un document | Non (lecture seule) |
| Lancer un agent | **Oui**, sauf si vous avez coché « Le chef peut lancer les agents sans me demander » |
| Créer ou mettre à jour des fiches de la Bible (ADN, style commun) | **Toujours** |
| Placer un scénario dans l'onglet Scénario (et l'analyser) | **Toujours** |
| Placer un script dans Le lot | **Toujours** |
| Remplir la fiche Publication | **Toujours** |
| Lire les cartes du Storyboard | Non (lecture seule) |
| Écrire les prompts des cartes du Storyboard | **Toujours** |
| Créer un nouvel agent dans l'équipe | **Toujours** |

Chaque demande s'affiche dans la discussion avec un **aperçu du contenu** : **Autoriser** ou **Refuser**. Après un refus, le chef ne recommence pas sans vous le demander.

**Ce qu'il ne fait jamais** : créer ou supprimer des cartes, lancer une génération chez Agnes ou supprimer quoi que ce soit. Après son envoi, c'est vous qui cliquez **Créer les plans** dans Le lot ou dans Scénario.

**Nouvelle discussion** efface la conversation avec le chef. Le travail des agents et les documents sont conservés.

---

### Le prompt parfait (agent 16 — Directeur de plans)
L'agent 16 lit le Storyboard (numéros des cartes, prompts actuels, références et skills cochés), la Bible, la Bibliothèque et les Skills. Pour chaque carte il choisit **un angle de caméra**, place chaque personnage **en position dans l'image** (gauche, droite, premier plan…), applique les règles France (volant à gauche, circulation à droite) et vos règles de jeu et de rendu. Il écrit avec les mentions de l'app : `@[Nom]` pour les personnages, lieux et objets (la référence est cochée d'office) et `#[Skill]` à l'endroit voulu (voir [25](25-mentions.md)).

Sa sortie, des blocs `PLAN n / IMAGE : / VIDÉO :`, est écrite telle quelle dans les cartes : par le chef (avec votre accord) ou par le bouton **→ Cartes du Storyboard** de l'agent. Vérifiez ensuite « Plus d'options → Prompt envoyé » sur les cartes.

### Nouveaux agents
Si aucun agent ne convient, le chef peut en **créer un** à votre demande (ou le proposer) : nom, rôle, consignes, entrées et ce qu'il lit (Bible, Bibliothèque, Skills, Storyboard). Il apparaît dans la liste de l'équipe, modifiable comme les autres, et part avec **Exporter l'équipe**.

---

## 6. Appeler un agent directement avec @

Comme dans RMAOPN AI : tapez **@** dans la zone de message, et une liste d'agents s'affiche. Tapez quelques lettres ou un numéro pour filtrer, puis cliquez.

```
@6 réécris la scène 2 avec des répliques plus sèches
@8 ajoute un plan large du parking au début
@Auditeur vérifie l'épisode 1
```

L'agent travaille tout de suite, **sans passer par le chef et sans autorisation**, puisque c'est vous qui le demandez. Son travail remplace le précédent dans la chaîne, à relire. Le chef voit ces appels et en tient compte pour la suite.

---

## 7. Les documents

Donnez à l'équipe vos propres textes : un script déjà écrit, des notes, une bible existante, un article, un fait divers, des consignes de ton…

### Ajouter un document
| Bouton | Formats |
|---|---|
| **+ Fichier** | `.txt`, `.md`, `.fountain`, `.csv`, `.json`, `.srt`, `.vtt`, `.html`, **`.docx`** (Word), **`.pdf`** (texte). Plusieurs fichiers à la fois |
| **+ Texte collé** | Donnez un nom, collez le texte, **Ajouter** |
| **Lire la page** | Collez l'adresse d'une page web. Le texte est récupéré par le service gratuit **Jina Reader** (r.jina.ai), qui reçoit l'adresse de la page |

> Un **PDF scanné** (une image de texte) ne contient pas de texte lisible : utilisez un PDF texte, ou copiez le texte avec « + Texte collé ».

### Choisir qui le lit
Chaque document a une ligne avec :
- une **case** pour l'activer ou le désactiver sans le supprimer ;
- un **menu** : **Tous les agents**, **Chef de production seulement**, ou **un agent précis** (par exemple vos consignes de ton pour le Scénariste seulement) ;
- **👁** pour voir le texte réellement lu (utile pour un PDF ou une page web) ;
- **✕** pour le retirer.

### Comment il est utilisé
- Un agent reçoit, avec ses entrées, les documents actifs qui lui sont destinés (ou destinés à tous). La consigne lui demande de s'en servir en priorité quand votre demande s'y rapporte.
- Le chef voit la liste de tous les documents et peut lire celui dont vous parlez.
- Les documents sont **enregistrés dans le projet** : ils restent après un rechargement, et suivent le projet quand vous le dupliquez.

### Limites de taille
| Limite | Valeur |
|---|---|
| Texte gardé par document | 200 000 caractères (environ 60 pages) |
| Documents envoyés à un agent, au total | 60 000 caractères par requête, partagés entre les documents |
| Document lu par le chef | 40 000 caractères |

Au-delà, le texte est coupé et l'agent en est averti. Pour un long document, destinez-le à l'agent qui en a vraiment besoin plutôt qu'à tous.

---

## 8. Personnaliser l'équipe

Sur un agent : **Modifier l'agent**.

| Champ | Rôle |
|---|---|
| Nom, Description | Affichés dans la chaîne ; la description aide le chef à choisir le bon agent |
| **Consignes** | Les instructions de l'agent. **Collez ici celles de vos Gems** pour retrouver exactement leur comportement |
| Entrées | Le travail des autres agents qu'il reçoit |
| Lit la Bible / la Bibliothèque | Ajoute les fiches existantes et les noms des images de référence |
| Connaît les Skills | Ajoute la liste de vos skills par catégorie : l'agent peut écrire une ligne `SKILLS :` par plan (activé pour les agents 8 et 10) |
| Destination | Où le bouton de rangement (et le chef) envoie son travail |
| **Modèle** | Vide = le fournisseur principal. Sinon `fournisseur:modèle`, proposé dans la liste : ex. `agnes:agnes-3.0-flash` pour le Scénariste, `groq:openai/gpt-oss-20b` pour le Community Manager. Un modèle d'un fournisseur sans clé (par exemple un agent RMAOPN réglé sur Mistral) est remplacé par le fournisseur principal |
| **Créativité** | Vide = celle de l'Atelier. Plus haut pour le concept et le scénario, plus bas pour les prompts et la continuité |
| **Longueur max** | Vide = celle du modèle. Montez-la (8 000 et plus) pour un scénario complet |

**Consignes par défaut** remet l'agent d'origine. **Exporter l'équipe (.json)** sauvegarde toute l'équipe ; le bouton **⬆ Importer des agents** la recharge.

> Les consignes par défaut ont été écrites d'après la description de vos Gems Gemini, car leur contenu exact n'est pas lisible depuis l'app. Pour un résultat identique à vos Gems, collez leurs instructions, ou importez-les depuis RMAOPN AI.

Quelle que soit la consigne, chaque agent reçoit aussi une règle commune : répondre en français (prompts et ADN en anglais), s'appuyer sur ses entrées sans les contredire, ne mettre ni texte, ni sous-titres, ni musique dans les prompts.

---

## 9. Importer vos agents RMAOPN AI

Vos agents existent déjà dans **RMAOPN AI** ? Inutile de les recopier.

1. Dans RMAOPN, exportez-les : un par un (bouton d'export sur la carte de l'agent), ou tous d'un coup (**Données → Exporter**, fichier `RMAOPN-backup-….RMAOPN.json`).
2. Dans l'Atelier : **⬆ Importer des agents**. Plusieurs fichiers sont acceptés.
3. Un tableau propose une place pour chaque agent : d'après le numéro en tête de son nom (« 8. », « Gem 8 — »), sinon d'après les mots du nom. Corrigez si besoin, décochez ceux à ignorer, puis **Importer**.

| Choix | Effet |
|---|---|
| **Remplace « N. … »** | L'agent prend cette place. Il **garde** les entrées et la destination de la chaîne. Il **reprend** de RMAOPN le nom, la description, les consignes (avec l'entrée en matière, le style et les interdits), le modèle, la créativité et la longueur maximale |
| **➕ Nouvel agent** | Ajouté en fin de liste (16, 17…), sans entrée ni destination : réglez-les avec **Modifier l'agent** |

Deux agents importés ne peuvent pas viser la même place. Un export de l'Atelier (**Exporter l'équipe**) se réimporte par le même bouton, sans tableau.

---

## 10. Un épisode de A à Z

1. **Idée** : « Voici mon idée : une avocate découvre que son associé ment depuis dix ans. » Le chef lance l'agent 1. Relisez, corrigez, **Valider**.
2. **Bibles** : « Continue avec la bible de série et les personnages. » Agents 2 et 3. Relisez l'ADN de chaque personnage.
3. **Rangement Bible** : « Range les personnages et les lieux dans la Bible. » Autorisez. Vérifiez ensuite l'onglet **Bible**.
4. **Références** : générez une fiche personnage par rôle principal (Bibliothèque → Fiche IA), **sous le même nom que dans la Bible**.
5. **Épisode** : « Fais l'architecture de la saison, puis le découpage et le scénario de l'épisode 1. » Agents 4, 5, 6.
6. **Direction artistique** : agent 7, puis rangement du style commun dans la Bible.
7. **Prompts** : « Prompts image et vidéo de l'épisode 1, puis le storyboard. » Agents 8, 9, 10.
8. **Vérification** : `@Auditeur vérifie l'épisode 1`. Corrigez ce qu'il signale.
9. **Envoi** : « Envoie le storyboard de l'épisode 1 dans Le lot » et « Envoie le scénario dans l'onglet Scénario ». Autorisez.
10. **Dans Le lot** : vérifiez la liste et les références (les noms en rouge n'existent pas dans la Bibliothèque), puis **Créer les plans**. Validez chaque image sur sa carte avant de l'animer.
11. **Dialogues** : depuis l'onglet Scénario, les répliques partent dans **Voix**.
12. **Publication** : agent 14, puis « Remplis la fiche Publication ».

---

## 11. Séries et épisodes

- Un **projet** de l'app correspond à un **épisode**. Le travail des agents, la discussion et les documents sont enregistrés **dans le projet**.
- Pour l'épisode suivant : **Projet → Dupliquer le projet actif**. Concept, bibles, personnages et documents sont gardés ; demandez ensuite aux agents 5 à 15 l'épisode 2.
- La **Bible de l'app** est partagée par tous les épisodes d'une même série ([11](11-bible.md)) : ce que le chef y range sert à toute la série.
- L'**équipe d'agents** (consignes, réglages) est commune à tous les projets.

---

## 12. Bonnes pratiques et limites

- **Relisez chaque étape** : une erreur de l'agent 3 (un âge, une tenue) se propage à tous les suivants. Corrigez-la dans son texte avant de continuer.
- **Un épisode à la fois** pour les étapes 5 à 15 : les résultats sont plus précis et les requêtes plus courtes.
- **Débit** : l'offre gratuite limite le nombre de requêtes. L'Atelier envoie les requêtes l'une après l'autre (1,3 s d'écart minimum) et réessaie seul en cas de refus « 429 ». Une chaîne complète prend quelques minutes.
- **Documents** : destinez les longs documents à un seul agent ; désactivez ceux qui ne servent plus.
- **Coût en quota** : chaque agent lancé, chaque message au chef et chaque rangement dans la Bible (extraction) consomme une requête chez le fournisseur utilisé. Réservez les modèles les plus limités (Gemini Flash, environ 20/jour) aux agents qui en valent la peine, et laissez les autres sur Flash-Lite ou Groq.
- **Le chef s'arrête** après 8 actions d'affilée pour une même demande et vous demande comment continuer.

---

## 13. Dépannage

| Symptôme | Solution |
|---|---|
| « Ajoutez au moins une clé API » | Connexion aux IA → collez une clé → **Enregistrer** |
| « … : clé refusée (401 / 403) » | Recopiez la clé depuis le site du fournisseur ; vérifiez qu'elle n'a pas été supprimée |
| « … : limite atteinte (429, quota du jour épuisé) » | Normal avec une offre gratuite : ajoutez un second fournisseur et laissez **Repli automatique** coché, ou attendez le lendemain |
| « Tous les fournisseurs ont refusé » | Tous vos quotas sont épuisés pour le moment : attendez, ou ajoutez un fournisseur |
| « … : modèle « X » indisponible » | Le nom du modèle a changé : **Tester les connexions** liste les modèles disponibles ; choisissez-en un dans le champ Modèle |
| « … injoignable depuis la page » | Vérifiez la connexion internet. Si c'est systématique pour un fournisseur, le navigateur bloque peut-être l'appel (CORS) : utilisez-en un autre et signalez-le |
| Le chef ne range rien | Il attend votre **Autoriser** dans la discussion ; vérifiez que les extensions Bible, Scénario et Publication sont actives |
| « Activez l'extension … » | ⚙ → cochez l'extension demandée |
| Un agent ignore mon document | Vérifiez que la case est cochée et que le menu vise « Tous les agents » ou cet agent ; précisez dans la demande « d'après le document X » |
| « PDF sans texte » | PDF scanné : copiez le texte avec « + Texte collé » |
| « … illisible : module de lecture indisponible » | Les lecteurs .docx et .pdf se chargent depuis internet la première fois : vérifiez la connexion |
| Noms en rouge dans Le lot après envoi | Ces personnages n'ont pas d'image dans la Bibliothèque : ajoutez-la sous le même nom |
| « Deux agents importés visent la même place » | Dans le tableau d'import, choisissez une autre place ou « Nouvel agent » pour l'un d'eux |
| Le travail d'un agent est tronqué | Montez sa **Longueur max** (Modifier l'agent), ou demandez-lui une partie à la fois |
| Groq refuse une longue demande (limite de tokens) | Groq a peu de tokens par minute en gratuit : mettez les agents à longues entrées (bibles, scénario, storyboard) sur Gemini |

Voir aussi [99 — Dépannage](99-depannage.md).
