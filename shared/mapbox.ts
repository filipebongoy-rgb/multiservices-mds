// Jeton public Mapbox (préfixe pk.) : prévu pour un usage navigateur.
// Le restreindre aux domaines MDS dans le tableau de bord Mapbox avant
// l'ouverture au public. Il sert aussi au serveur pour géocoder l'adresse
// d'intervention et déclencher la notification d'approche.
export const MAPBOX_PUBLIC_TOKEN =
  "pk.eyJ1IjoiZmlsaXBlLWJvbmdveSIsImEiOiJjbXczdGF2ZDgwMHB1MnlzY2hnOXZlMDQzIn0.U0shgx7cdZ4G-UNgK35-9A";

/** Distance à vol d'oiseau en mètres entre deux points GPS. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

/** Seuil de la notification « votre artisan arrive bientôt ». */
export const APPROACH_DISTANCE_M = 1000;
/** Au-delà de cette distance, « Je suis arrivé » est refusé si le GPS est récent. */
export const ARRIVAL_MAX_DISTANCE_M = 500;
/** Une position plus ancienne que ce délai est considérée comme périmée. */
export const STALE_POSITION_MS = 2 * 60 * 1000;
