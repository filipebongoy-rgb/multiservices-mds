// Vignettes illustratives des types de problèmes (images générées, stockage
// du projet). Une photo administrée dans le catalogue (photoUrl) est
// prioritaire sur ces vignettes par défaut.
const base = "/manus-storage/async-images";

export const problemImages: Record<string, string> = {
  // Plomberie
  Fuite: `${base}/MZ2sADzjxUPMKC1juKZZeE/image-1.webp`,
  Débouchage: `${base}/MZ2sADzjxUPMKC1juKZZeE/image-2.webp`,
  Robinetterie: `${base}/MZ2sADzjxUPMKC1juKZZeE/image-3.webp`,
  "Lavabo et évier": `${base}/MZ2sADzjxUPMKC1juKZZeE/image-4.webp`,
  WC: `${base}/MZ2sADzjxUPMKC1juKZZeE/image-5.webp`,
  "Chasse d’eau": `${base}/hHgPTYTEAXAVXLIFxEDOwl/image-1.webp`,
  "Douche et baignoire": `${base}/hHgPTYTEAXAVXLIFxEDOwl/image-2.webp`,
  "Chauffe-eau": `${base}/hHgPTYTEAXAVXLIFxEDOwl/image-3.webp`,
  Raccordements: `${base}/hHgPTYTEAXAVXLIFxEDOwl/image-4.webp`,
  // Électricité
  "Panne électrique": `${base}/hHgPTYTEAXAVXLIFxEDOwl/image-5.webp`,
  Prises: `${base}/KcrBY9cVj8LriNqXF0zZks/image-1.webp`,
  Interrupteurs: `${base}/KcrBY9cVj8LriNqXF0zZks/image-2.webp`,
  Éclairage: `${base}/KcrBY9cVj8LriNqXF0zZks/image-3.webp`,
  "Tableau électrique": `${base}/KcrBY9cVj8LriNqXF0zZks/image-4.webp`,
  "Mise en sécurité": `${base}/KcrBY9cVj8LriNqXF0zZks/image-5.webp`,
  VMC: `${base}/NOp9nsNPNVZ68mMoHImJMZ/image-1.webp`,
  // Chauffage
  "Panne de chauffage": `${base}/NOp9nsNPNVZ68mMoHImJMZ/image-2.webp`,
  Radiateurs: `${base}/NOp9nsNPNVZ68mMoHImJMZ/image-3.webp`,
  Chaudière: `${base}/NOp9nsNPNVZ68mMoHImJMZ/image-4.webp`,
  Thermostat: `${base}/NOp9nsNPNVZ68mMoHImJMZ/image-5.webp`,
  Entretien: `${base}/LHcqSOnB9JAHYJdBJaAgUy/image-1.webp`,
  "Circuit de chauffage": `${base}/LHcqSOnB9JAHYJdBJaAgUy/image-2.webp`,
  // Peinture
  Murs: `${base}/LHcqSOnB9JAHYJdBJaAgUy/image-3.webp`,
  Plafonds: `${base}/LHcqSOnB9JAHYJdBJaAgUy/image-4.webp`,
  Portes: `${base}/LHcqSOnB9JAHYJdBJaAgUy/image-5.webp`,
  "Préparation des surfaces": `${base}/yRsfOb5yJUzHHBEvfcR1ur/image-1.webp`,
  Rebouchage: `${base}/yRsfOb5yJUzHHBEvfcR1ur/image-2.webp`,
  Ponçage: `${base}/yRsfOb5yJUzHHBEvfcR1ur/image-3.webp`,
  Rénovation: `${base}/yRsfOb5yJUzHHBEvfcR1ur/image-4.webp`,
  // Petits travaux
  "Montage de meubles": `${base}/yRsfOb5yJUzHHBEvfcR1ur/image-5.webp`,
  Fixations: `${base}/uF5hc4GfjK5OScI9HN4c3l/image-1.webp`,
  Réglages: `${base}/uF5hc4GfjK5OScI9HN4c3l/image-2.webp`,
  "Petites réparations": `${base}/uF5hc4GfjK5OScI9HN4c3l/image-3.webp`,
  "Entretien courant": `${base}/uF5hc4GfjK5OScI9HN4c3l/image-4.webp`,
};

export function problemImage(name: string, adminPhotoUrl?: string | null) {
  return adminPhotoUrl || problemImages[name] || "";
}
