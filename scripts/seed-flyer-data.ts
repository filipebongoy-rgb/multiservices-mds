/**
 * Active le catalogue avec les tarifs officiels des flyers MDS
 * ("à partir de X € TTC", Rennes et alentours).
 * Idempotent : ne touche pas aux dossiers clients existants.
 */
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

interface Entry {
  trade: string;
  name: string;
  priceCents: number | null;
  pricingRule: string;
  pricingMode: "fixed" | "quote";
  description: string;
  photoUrl: string;
  durationMinutes: number;
}

const entries: Entry[] = [
  // Plomberie
  { trade: "plomberie", name: "Fuite", priceCents: 11000, pricingRule: "À partir de 110 € TTC — recherche et réparation", pricingMode: "fixed", description: "Localisation et réparation de fuite d’eau (alimentation, évacuation, réseau).", photoUrl: "/problems/fuite.webp", durationMinutes: 90 },
  { trade: "plomberie", name: "Débouchage", priceCents: 9000, pricingRule: "À partir de 90 € TTC (WC)", pricingMode: "fixed", description: "Débouchage évier, lavabo, douche, baignoire ou WC.", photoUrl: "/problems/debouchage.webp", durationMinutes: 60 },
  { trade: "plomberie", name: "Robinetterie", priceCents: 9000, pricingRule: "90 € TTC — remplacement mitigeur", pricingMode: "fixed", description: "Remplacement ou réparation de robinet, mitigeur, groupe de sécurité.", photoUrl: "/problems/robinetterie.webp", durationMinutes: 60 },
  { trade: "plomberie", name: "Lavabo et évier", priceCents: 6000, pricingRule: "À partir de 60 € TTC (siphon)", pricingMode: "fixed", description: "Remplacement de siphon, vidage, flexible et fuite sous évier.", photoUrl: "/problems/lavabo-evier.webp", durationMinutes: 60 },
  { trade: "plomberie", name: "WC", priceCents: 22000, pricingRule: "À partir de 220 € TTC (dépose/pose)", pricingMode: "fixed", description: "Remplacement de WC, cuvette, réservoir et réparation de colonne.", photoUrl: "/problems/wc.webp", durationMinutes: 90 },
  { trade: "plomberie", name: "Chasse d’eau", priceCents: 8000, pricingRule: "80 € TTC — remplacement mécanisme", pricingMode: "fixed", description: "Mécanisme de chasse, robinet flotteur, joints et détartrage.", photoUrl: "/problems/wc.webp", durationMinutes: 60 },
  { trade: "plomberie", name: "Douche et baignoire", priceCents: 9000, pricingRule: "À partir de 90 € TTC", pricingMode: "fixed", description: "Mitigeur, douchette, siphon, débouchage et joints silicone.", photoUrl: "/problems/douche-baignoire.webp", durationMinutes: 90 },
  { trade: "plomberie", name: "Chauffe-eau", priceCents: 25000, pricingRule: "À partir de 250 € TTC (remplacement ballon)", pricingMode: "fixed", description: "Remplacement et dépannage de chauffe-eau électrique ou ballon d’eau chaude.", photoUrl: "/problems/chauffe-eau.webp", durationMinutes: 120 },
  { trade: "plomberie", name: "Raccordements", priceCents: 6000, pricingRule: "À partir de 60 € TTC", pricingMode: "fixed", description: "Raccordement de flexibles, machine à laver, évacuation et tuyauterie.", photoUrl: "/problems/raccordements.webp", durationMinutes: 60 },
  // Électricité
  { trade: "electricite", name: "Panne électrique", priceCents: null, pricingRule: "Diagnostic sur devis après analyse", pricingMode: "quote", description: "Recherche de panne, coupure générale, diagnostic sécurité.", photoUrl: "/problems/panne-electrique.webp", durationMinutes: 60 },
  { trade: "electricite", name: "Prises", priceCents: 5000, pricingRule: "50 € TTC par prise", pricingMode: "fixed", description: "Remplacement de prises électriques murales défectueuses.", photoUrl: "/problems/prises.webp", durationMinutes: 45 },
  { trade: "electricite", name: "Interrupteurs", priceCents: 5000, pricingRule: "50 € TTC par interrupteur", pricingMode: "fixed", description: "Remplacement d’interrupteurs simples, va-et-vient et commandes.", photoUrl: "/problems/interrupteurs.webp", durationMinutes: 45 },
  { trade: "electricite", name: "Éclairage", priceCents: 6000, pricingRule: "À partir de 60 € TTC (pose luminaire)", pricingMode: "fixed", description: "Suspension, plafonnier, spot encastré, ruban LED.", photoUrl: "/problems/eclairage.webp", durationMinutes: 60 },
  { trade: "electricite", name: "Tableau électrique", priceCents: 7000, pricingRule: "À partir de 70 € TTC (disjoncteur)", pricingMode: "fixed", description: "Disjoncteurs divisionnaires, interrupteurs différentiels 30 mA.", photoUrl: "/problems/panne-electrique.webp", durationMinutes: 90 },
  { trade: "electricite", name: "Mise en sécurité", priceCents: 11000, pricingRule: "À partir de 110 € TTC (différentiel)", pricingMode: "fixed", description: "Mise aux normes et protection différentielle des personnes.", photoUrl: "/problems/panne-electrique.webp", durationMinutes: 90 },
  { trade: "electricite", name: "VMC", priceCents: 7500, pricingRule: "Forfait nettoyage VMC à 75 € TTC", pricingMode: "fixed", description: "Pose DAAF, nettoyage/remplacement de bouches et forfait VMC.", photoUrl: "/problems/vmc.webp", durationMinutes: 60 },
  // Chauffage
  { trade: "chauffage", name: "Panne de chauffage", priceCents: null, pricingRule: "Diagnostic sur devis après analyse", pricingMode: "quote", description: "Recherche de panne chaudière ou ballon, relance de circuit.", photoUrl: "/problems/panne-chauffage.webp", durationMinutes: 60 },
  { trade: "chauffage", name: "Radiateurs", priceCents: 4000, pricingRule: "À partir de 40 € TTC (purge)", pricingMode: "fixed", description: "Purge, rééquilibrage et robinets thermostatiques.", photoUrl: "/problems/radiateurs.webp", durationMinutes: 60 },
  { trade: "chauffage", name: "Chaudière", priceCents: 8000, pricingRule: "À partir de 80 € TTC (diagnostic & réglage)", pricingMode: "fixed", description: "Entretien courant, réglage et diagnostic de chaudière.", photoUrl: "/problems/panne-chauffage.webp", durationMinutes: 90 },
  { trade: "chauffage", name: "Thermostat", priceCents: 6500, pricingRule: "À partir de 65 € TTC (robinet thermostatique)", pricingMode: "fixed", description: "Remplacement de robinets et thermostats de régulation.", photoUrl: "/problems/thermostat.webp", durationMinutes: 60 },
  { trade: "chauffage", name: "Entretien", priceCents: 11000, pricingRule: "À partir de 110 € TTC (détartrage ballon)", pricingMode: "fixed", description: "Détartrage/vidange de ballon, groupe de sécurité, résistance.", photoUrl: "/problems/entretien-chauffage.webp", durationMinutes: 90 },
  { trade: "chauffage", name: "Circuit de chauffage", priceCents: 15000, pricingRule: "150 € TTC (désembouage & rinçage)", pricingMode: "fixed", description: "Remplacement de circulateur, désembouage et rinçage de circuit.", photoUrl: "/problems/circuit-chauffage.webp", durationMinutes: 120 },
  // Peinture (sur devis selon surfaces)
  { trade: "peinture", name: "Murs", priceCents: null, pricingRule: "Sur devis après visite — selon surface", pricingMode: "quote", description: "Peinture des murs intérieurs et remise en état.", photoUrl: "/problems/murs.webp", durationMinutes: 120 },
  { trade: "peinture", name: "Plafonds", priceCents: null, pricingRule: "Sur devis après visite — selon surface", pricingMode: "quote", description: "Préparation et peinture des plafonds.", photoUrl: "/problems/plafonds.webp", durationMinutes: 120 },
  { trade: "peinture", name: "Portes", priceCents: null, pricingRule: "Sur devis après visite — selon surface", pricingMode: "quote", description: "Peinture et lasure des portes et encadrements.", photoUrl: "/problems/portes.webp", durationMinutes: 90 },
  { trade: "peinture", name: "Préparation des surfaces", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Nettoyage, décapage et lissage avant mise en peinture.", photoUrl: "/problems/poncage.webp", durationMinutes: 90 },
  { trade: "peinture", name: "Rebouchage", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Rebouchage de trous, fissures et réparations d’enduit.", photoUrl: "/problems/rebouchage.webp", durationMinutes: 60 },
  { trade: "peinture", name: "Ponçage", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Ponçage fin pour une finition parfaitement lisse.", photoUrl: "/problems/poncage.webp", durationMinutes: 90 },
  { trade: "peinture", name: "Rénovation", priceCents: null, pricingRule: "Sur devis après visite", pricingMode: "quote", description: "Rénovation complète d’une pièce ou d’un logement.", photoUrl: "/problems/renovation.webp", durationMinutes: 120 },
  // Petits travaux
  { trade: "maintenance", name: "Montage de meubles", priceCents: null, pricingRule: "Sur devis selon le mobilier", pricingMode: "quote", description: "Montage de meubles en kit (IKEA, etc.) et pose.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Fixations", priceCents: 5000, pricingRule: "À partir de 50 € TTC", pricingMode: "fixed", description: "Pose d’étagères, tringles, miroirs et éléments muraux.", photoUrl: "/problems/fixations.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Réglages", priceCents: 5000, pricingRule: "À partir de 50 € TTC", pricingMode: "fixed", description: "Réglage de portes, fenêtres, charnières et serrures.", photoUrl: "/problems/portes.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Petites réparations", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Bricolage courant et interventions diverses.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Entretien courant", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Maintenance préventive pour particuliers et bailleurs.", photoUrl: "/problems/murs.webp", durationMinutes: 60 },
];

async function run() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  let updated = 0;
  for (const e of entries) {
    const res: any = await db.execute(sql`UPDATE mds_services SET
      name = ${e.name},
      description = ${e.description},
      photoUrl = ${e.photoUrl},
      priceCents = ${e.priceCents},
      pricingRule = ${e.pricingRule},
      pricingMode = ${e.pricingMode},
      durationMinutes = ${e.durationMinutes},
      travelMode = 'included',
      zone = 'Rennes et 30 km',
      active = 1,
      deletedAt = NULL
    WHERE trade = ${e.trade} AND LOWER(name) = LOWER(${e.name})`);
    if (res[0]?.affectedRows) updated += res[0].affectedRows;
    else {
      // name didn't match existing row (e.g. "Chasse d’eau")
      const res2: any = await db.execute(sql`INSERT INTO mds_services
        (seedKey, trade, name, description, photoUrl, priceCents, pricingRule, durationMinutes, questions, problemTypes, conditions, zone, active, pricingMode, travelMode)
      VALUES (
        ${"v1:" + e.trade + ":" + e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")},
        ${e.trade}, ${e.name}, ${e.description}, ${e.photoUrl},
        ${e.priceCents}, ${e.pricingRule}, ${e.durationMinutes},
        JSON_ARRAY(), JSON_ARRAY(), '', 'Rennes et 30 km', 1, ${e.pricingMode}, 'included'
      )`);
      if (res2[0]?.affectedRows) updated += res2[0].affectedRows;
    }
  }
  const [cnt] = await db.execute(sql`SELECT COUNT(*) c FROM mds_services WHERE active = 1 AND deletedAt IS NULL`);
  console.log(`Updated catalogue: ${updated} services updated, ${(cnt as any)[0].c} active.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
