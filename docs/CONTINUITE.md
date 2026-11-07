

## Ouverture directe des dossiers — 8 novembre 2026

Le bouton « Ouvrir le dossier » de l’espace artisan sélectionne désormais la demande puis fait défiler automatiquement vers le panneau détail avec `scrollIntoView({ block: "start" })`. Le précédent `scrollTo(0)` pouvait laisser le détail sous la zone d’action ; il a été supprimé. Le panneau reçoit le focus pour faciliter l’usage au clavier et sur mobile.
