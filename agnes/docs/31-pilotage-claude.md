# 31 — Claude aux commandes : piloter Agnes de A à Z (02/10/2026)

Quand vous le lui demandez, Claude (Claude Code) pilote Agnes à votre place, par le pont local. Il faut que :
- le pont soit lancé (`prod-fruits\lancer_pont.bat`) ;
- Agnes soit ouverte ;
- **⚙ → Piloté par Claude : actif** soit coché.

Toutes les commandes se lancent depuis `…\Production\App\prod-fruits`, sous la forme `python agnes.py <commande> …`. Vous
avez donné à Claude toutes les autorisations. Pour les actions qui coûtent des crédits ou qui effacent, il le dit avant :
générations, suppressions, pour lesquelles `confirmer=oui` est obligatoire.

| Étape | Commandes |
|---|---|
| Projet | `projets`, `creer_projet nom=…`, `ouvrir_projet projet=…`, `projet_reglages` (nom, style_base, negatif, format, duree, resolution, sorties, seed), `supprimer_projet projet=… confirmer=oui` |
| Extensions | `extensions` (cochée, chargée, erreur), `extension cle=bible actif=oui` |
| Style des prompts | `styles`, `style nom=…`, `style retablir=oui`, `style supprimer=…` |
| Moteurs | `moteurs image=chatgpt video=grok` (réglage commun à **tous** les projets) |
| Studio | `avatars`, `avatar nom=…`, `avatar_prompt`, `avatar_importer --fichier …`, `studio_generer` (payant), `studio_valider`, `studio_image chemin=…`, `envoyer_avatar` |
| Bible | `bible`, `bible_maj --json …`, `bible_image nom=… fiche=…` ou `chemin=…` |
| Bibliothèque | `bibliotheque`, `importer_image chemin=… nom=… type=…`, `vers_bibliotheque plan=… nom=…` |
| Cartes | `lot --fichier …`, `plans --json …` (prompts et réglages), `references plan=… noms=…`, `notes plan=… texte=…`, `prompt_final plan=…`, `supprimer_cartes cartes=… confirmer=oui`, `storyboard` |
| Générations | `generer plans=… etape=image|video` (payant), `choisir_prise`, `vider_file`, `exporter_prises` |
| Atelier IA | `chef message=…`, `autoriser reponse=oui|non`, `chef_historique`, `chef_effacer`, `agent`, `sortie_agent`, `document`, `outil nom=…` (voix, son, étalonnage, sous-titres, Studio, styles, classement) |
| Fin de chaîne | `classer cartes=… thematique=… nom=… episode=…` (**avant** le montage), `monter`, `compiler`, `episode`, `etat_montage`, `modeles_montage` |

**Chemins de fichiers :** `importer_image`, `bible_image` et `studio_image` acceptent un fichier de `prod-fruits`, du
dossier de sortie, ou du dossier **Production**. Ce dernier passe par la route `/classement/lire` du pont, en lecture seule.

**Chef :** il reçoit aussi `bible_lire` pour lire la Bible avant de l'écrire. Ses consignes interdisent deux choses vues le
02/10 : annoncer une action refusée comme faite, et changer le style commun sans demande.
