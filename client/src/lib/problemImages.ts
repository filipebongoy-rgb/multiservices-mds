// Vraies photos d'illustration des problèmes/services (photos libres de
// droits optimisées en WebP dans /public/problems/). Une photo administrée dans
// le catalogue (photoUrl) reste prioritaire.
export const problemImages: Record<string, string> = {
  // Plomberie
  Fuite: "/problems/fuite.webp",
  Débouchage: "/problems/debouchage.webp",
  Robinetterie: "/problems/robinetterie.webp",
  "Lavabo et évier": "/problems/lavabo-evier.webp",
  WC: "/problems/wc.webp",
  "Chasse d’eau": "/problems/wc.webp",
  "Douche et baignoire": "/problems/douche-baignoire.webp",
  "Chauffe-eau": "/problems/chauffe-eau.webp",
  Raccordements: "/problems/raccordements.webp",
  // Électricité
  "Panne électrique": "/problems/panne-electrique.webp",
  Prises: "/problems/prises.webp",
  Interrupteurs: "/problems/interrupteurs.webp",
  Éclairage: "/problems/eclairage.webp",
  "Tableau électrique": "/problems/panne-electrique.webp",
  "Mise en sécurité": "/problems/panne-electrique.webp",
  VMC: "/problems/vmc.webp",
  // Chauffage
  "Panne de chauffage": "/problems/panne-chauffage.webp",
  Radiateurs: "/problems/radiateurs.webp",
  Chaudière: "/problems/panne-chauffage.webp",
  Thermostat: "/problems/thermostat.webp",
  Entretien: "/problems/entretien-chauffage.webp",
  "Circuit de chauffage": "/problems/circuit-chauffage.webp",
  // Peinture
  Murs: "/problems/murs.webp",
  Plafonds: "/problems/plafonds.webp",
  Portes: "/problems/portes.webp",
  "Préparation des surfaces": "/problems/poncage.webp",
  Rebouchage: "/problems/rebouchage.webp",
  Ponçage: "/problems/poncage.webp",
  Rénovation: "/problems/renovation.webp",
  // Petits travaux
  "Montage de meubles": "/problems/montage-meubles.webp",
  Fixations: "/problems/fixations.webp",
  Réglages: "/problems/portes.webp",
  "Petites réparations": "/problems/montage-meubles.webp",
  "Entretien courant": "/problems/murs.webp",
};

export function problemImage(name: string, adminPhotoUrl?: string | null) {
  return adminPhotoUrl || problemImages[name] || "";
}
