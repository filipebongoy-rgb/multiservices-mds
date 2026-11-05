// Traduction des statuts internes en phrases claires pour le client,
// sur le modèle des descriptions de statut d'un suivi de commande.

const finishedStatuses = [
  "draft",
  "refused",
  "cancelled",
  "closed",
  "expired",
  "quote_refused",
];

/** Une demande « en cours » reste visible dans le bandeau d'accueil. */
export function isActiveRequest(status: string) {
  return !finishedStatuses.includes(status);
}

/** 0 = reçue, 1 = confirmée, 2 = en route / en cours, 3 = terminée. */
export function requestProgressIndex(status: string) {
  if (["completed", "invoiced", "paid", "closed"].includes(status)) return 3;
  if (["en_route", "in_progress"].includes(status)) return 2;
  if (["confirmed", "planned", "quote_accepted"].includes(status)) return 1;
  return 0;
}

export const progressSteps = ["Reçue", "Confirmée", "En cours", "Terminée"];

/** Phrase principale, au présent, de ce qui se passe maintenant. */
export function requestHeadline(status: string, arrived = false) {
  if (status === "en_route")
    return arrived ? "Votre artisan est arrivé" : "Votre artisan est en route";
  if (status === "in_progress") return "Intervention en cours chez vous";
  if (["completed", "invoiced", "paid"].includes(status))
    return "Travaux terminés : vérifiez les photos";
  if (["confirmed", "planned", "quote_accepted"].includes(status))
    return "Rendez-vous confirmé";
  if (status === "proposed_slot" || status === "awaiting_client")
    return "MDS vous propose un créneau";
  if (status === "needs_information") return "MDS a besoin d’une précision";
  if (status === "quote_pending") return "Votre devis est prêt";
  if (status === "closed") return "Intervention clôturée";
  if (["refused", "cancelled", "expired", "quote_refused"].includes(status))
    return "Demande terminée";
  return "Demande reçue par MDS";
}

/** Ce que le client doit faire, ou ce qu'il peut attendre. */
export function requestNextAction(status: string) {
  if (["completed", "invoiced", "paid"].includes(status))
    return "Confirmez la fin des travaux ou signalez un problème.";
  if (status === "proposed_slot" || status === "awaiting_client")
    return "Acceptez le créneau proposé ou demandez-en un autre.";
  if (status === "needs_information")
    return "Répondez à la question de MDS pour continuer.";
  if (status === "quote_pending") return "Consultez et validez le devis.";
  if (["confirmed", "planned", "quote_accepted"].includes(status))
    return "Vous serez prévenu dès le départ de l’artisan.";
  if (status === "en_route")
    return "Suivez son arrivée en direct sur la carte.";
  if (status === "in_progress")
    return "Les photos après travaux arriveront à la fin.";
  if (["refused", "cancelled", "expired", "quote_refused"].includes(status))
    return "Ouvrez le dossier pour consulter le détail.";
  if (status === "closed") return "Retrouvez vos photos et documents.";
  return "MDS vous répond rapidement.";
}

/** Une action est attendue du client : le bandeau devient prioritaire. */
export function clientMustAct(status: string) {
  return [
    "completed",
    "invoiced",
    "paid",
    "proposed_slot",
    "awaiting_client",
    "needs_information",
    "quote_pending",
  ].includes(status);
}

const guestKey = "mds-active-request";

/** Mémorise sur cet appareil la dernière demande déposée sans compte. */
export function rememberGuestRequest(reference: string, token: string) {
  try {
    localStorage.setItem(guestKey, JSON.stringify({ reference, token }));
  } catch {}
}

export function readGuestRequest(): {
  reference: string;
  token: string;
} | null {
  try {
    const value = JSON.parse(localStorage.getItem(guestKey) || "null");
    if (
      value &&
      typeof value.reference === "string" &&
      typeof value.token === "string"
    )
      return value;
  } catch {}
  return null;
}

export function forgetGuestRequest() {
  try {
    localStorage.removeItem(guestKey);
  } catch {}
}
