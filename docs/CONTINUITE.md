

## Diagnostic vidéo artisan — 8 novembre 2026

La vidéo montrait un dossier dont `quoteRequired(request)` était vrai. Le bouton « Accepter » était visuellement présent mais désactivé par `needsAcceptedQuote`, car le serveur exige un devis distinct avant toute proposition. La modale Refuser fonctionnait, ce qui confirmait que l’interface n’était pas globalement figée. L’interface affiche maintenant « Préparer le devis », ouvre directement l’action `quote` et explique la règle sous les boutons. La validation serveur reste obligatoire. Le bandeau « Publication en cours » visible dans la vidéo correspondait à l’état de déploiement de la version observée, pas à une action métier de l’artisan.
