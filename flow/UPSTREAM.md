# FlowKit intégré à Lumina

Source : https://github.com/crisng95/flowkit
Révision : 57b52e6375ac7034848c13da461838a6f7545aca
Extension source : 0.3.2 — licence MIT, conservée dans LICENSE.

Fichiers repris : background.js, content.js, injected.js, side_panel.html,
side_panel.js, rules.json depuis extension/.

Adaptations Lumina : import du service worker comme module ; chemins sous flow/ ;
protection contre les doubles injections ; alarmes préfixées lumina-flow- ;
messages inconnus ignorés pour ne pas bloquer Grok ; activation explicite et
persistante ; initialisation attendue avant traitement des commandes ; suppression
de la télémétrie synthétique historique ; états du panneau adaptés à la connexion
locale actuelle et lien vers le tableau de bord. Pas de modification du protocole
WebSocket ou de la construction des requêtes Flow.

Le service Python et le tableau de bord de FlowKit sont des composants externes,
non démarrés par l’extension. Voir setup.html. Le clone .research/flowkit sert à
l’étude ; aucun fichier de l’extension n’en dépend à l’exécution.
