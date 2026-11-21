/**
 * Active le catalogue avec les tarifs officiels des flyers MDS
 * ("à partir de X € TTC", Rennes et alentours).
 * Idempotent : ne touche pas aux dossiers clients existants.
 */
import { getDb } from "../server/db";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { services } from "../drizzle/schema";

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
  { trade: "electricite", name: "Installation électrique", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Installation ou modification de circuits électriques selon le besoin.", photoUrl: "", durationMinutes: 120 },
  { trade: "electricite", name: "Installation de prises", priceCents: null, pricingRule: "Sur devis selon le nombre de prises", pricingMode: "quote", description: "Ajout ou déplacement de prises électriques.", photoUrl: "/problems/prises.webp", durationMinutes: 90 },
  { trade: "electricite", name: "Pose de plafonnier", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Pose de plafonnier, suspension ou luminaire au domicile.", photoUrl: "/problems/eclairage.webp", durationMinutes: 90 },
  { trade: "electricite", name: "Changement de disjoncteur", priceCents: null, pricingRule: "Sur devis après diagnostic", pricingMode: "quote", description: "Remplacement de disjoncteur ou protection électrique après contrôle.", photoUrl: "/problems/panne-electrique.webp", durationMinutes: 90 },
  { trade: "electricite", name: "Court-circuit", priceCents: null, pricingRule: "Diagnostic sur devis après analyse", pricingMode: "quote", description: "Recherche de court-circuit et mise en sécurité du circuit concerné.", photoUrl: "/problems/panne-electrique.webp", durationMinutes: 90 },
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
  { trade: "peinture", name: "Papier peint", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Dépose et pose de papier peint après préparation des murs.", photoUrl: "/problems/murs.webp", durationMinutes: 120 },
  { trade: "peinture", name: "Pose de papier peint", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Pose de papier peint, intissé ou décoration murale.", photoUrl: "/problems/murs.webp", durationMinutes: 120 },
  { trade: "peinture", name: "Peinture intérieure", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Peinture intérieure d’une pièce, d’un appartement ou d’un logement.", photoUrl: "/problems/murs.webp", durationMinutes: 120 },
  { trade: "peinture", name: "Peinture extérieure", priceCents: null, pricingRule: "Sur devis après visite", pricingMode: "quote", description: "Rafraîchissement et peinture extérieure selon l’état du support.", photoUrl: "/problems/renovation.webp", durationMinutes: 180 },
  // Petits travaux
  { trade: "maintenance", name: "Montage de meubles", priceCents: null, pricingRule: "Sur devis selon le mobilier", pricingMode: "quote", description: "Montage de meubles en kit (IKEA, etc.) et pose.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Fixations", priceCents: 5000, pricingRule: "À partir de 50 € TTC", pricingMode: "fixed", description: "Pose d’étagères, tringles, miroirs et éléments muraux.", photoUrl: "/problems/fixations.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Réglages", priceCents: 5000, pricingRule: "À partir de 50 € TTC", pricingMode: "fixed", description: "Réglage de portes, fenêtres, charnières et serrures.", photoUrl: "/problems/portes.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Petites réparations", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Bricolage courant et interventions diverses.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Entretien courant", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Maintenance préventive pour particuliers et bailleurs.", photoUrl: "/problems/murs.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Fixation de télévision", priceCents: null, pricingRule: "Sur devis selon support", pricingMode: "quote", description: "Fixation d’une télévision au mur avec contrôle du support.", photoUrl: "/problems/fixations.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Fixation d’étagère", priceCents: null, pricingRule: "Sur devis selon support", pricingMode: "quote", description: "Pose d’étagères et de rangements muraux.", photoUrl: "/problems/fixations.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Pose de tringles à rideaux", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Pose de tringles, stores et accessoires de fenêtre.", photoUrl: "/problems/fixations.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Réparation de porte", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Réparation de porte, poignée, charnière ou fermeture.", photoUrl: "/problems/portes.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Réglage de fenêtre", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Réglage de fenêtre, ouvrant, poignée ou fermeture.", photoUrl: "/problems/portes.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Pose de serrure", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Pose ou remplacement de serrure et mécanisme de fermeture.", photoUrl: "/problems/portes.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Changement de poignée", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Remplacement de poignées de porte, meuble ou fenêtre.", photoUrl: "/problems/portes.webp", durationMinutes: 60 },
  { trade: "maintenance", name: "Montage de cuisine", priceCents: null, pricingRule: "Sur devis selon le mobilier", pricingMode: "quote", description: "Montage et pose de meubles de cuisine selon le périmètre validé.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 180 },
  { trade: "maintenance", name: "Pose de meubles", priceCents: null, pricingRule: "Sur devis selon le mobilier", pricingMode: "quote", description: "Pose de meubles et éléments d’aménagement intérieur.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 120 },
  { trade: "maintenance", name: "Installation de dressing", priceCents: null, pricingRule: "Sur devis selon le mobilier", pricingMode: "quote", description: "Montage et installation de dressing ou rangement.", photoUrl: "/problems/montage-meubles.webp", durationMinutes: 180 },
  { trade: "maintenance", name: "Réparation de volet", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Réparation de volet, manivelle, sangle ou mécanisme.", photoUrl: "/problems/portes.webp", durationMinutes: 90 },
  { trade: "maintenance", name: "Pose de carrelage", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Pose ou remplacement de carrelage et finitions.", photoUrl: "", durationMinutes: 180 },
  { trade: "maintenance", name: "Remplacement de joints", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Remplacement de joints sanitaires, carrelage ou finition.", photoUrl: "", durationMinutes: 60 },
  { trade: "maintenance", name: "Pose de parquet", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Pose de parquet ou revêtement de sol selon le support.", photoUrl: "", durationMinutes: 180 },
  { trade: "maintenance", name: "Réparation de sol", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Réparation et remise en état de sol ou revêtement.", photoUrl: "", durationMinutes: 120 },
  { trade: "maintenance", name: "Aménagement intérieur", priceCents: null, pricingRule: "Sur devis après analyse", pricingMode: "quote", description: "Petits travaux d’aménagement et de finition intérieure.", photoUrl: "", durationMinutes: 120 },
  { trade: "maintenance", name: "Jardinage", priceCents: null, pricingRule: "Sur devis après description du besoin", pricingMode: "quote", description: "Tonte, taille et entretien courant du jardin selon disponibilité.", photoUrl: "", durationMinutes: 120 },
  { trade: "maintenance", name: "Nettoyage", priceCents: null, pricingRule: "Sur devis selon surface", pricingMode: "quote", description: "Nettoyage courant de logement ou de locaux selon le périmètre.", photoUrl: "", durationMinutes: 120 },
  { trade: "maintenance", name: "Déménagement", priceCents: null, pricingRule: "Sur devis selon volume et distance", pricingMode: "quote", description: "Aide au déménagement, manutention et transport de meubles selon disponibilité.", photoUrl: "", durationMinutes: 180 },
  { trade: "maintenance", name: "Couverture", priceCents: null, pricingRule: "Sur devis après visite", pricingMode: "quote", description: "Recherche de fuite et petites réparations de toiture selon faisabilité.", photoUrl: "", durationMinutes: 180 },
  { trade: "maintenance", name: "Maçonnerie", priceCents: null, pricingRule: "Sur devis après visite", pricingMode: "quote", description: "Petites réparations de maçonnerie, fissures et finitions selon faisabilité.", photoUrl: "", durationMinutes: 180 },
  { trade: "maintenance", name: "Vitrerie", priceCents: null, pricingRule: "Sur devis après description du vitrage", pricingMode: "quote", description: "Remplacement de vitrage ou intervention après description de la casse.", photoUrl: "", durationMinutes: 120 },
];

async function run() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  let updated = 0;
  for (const e of entries) {
    const changed = await db
      .update(services)
      .set({
        name: e.name,
        description: e.description,
        photoUrl: e.photoUrl,
        priceCents: e.priceCents,
        pricingRule: e.pricingRule,
        pricingMode: e.pricingMode,
        durationMinutes: e.durationMinutes,
        travelMode: "included",
        zone: "Rennes et 30 km",
        active: true,
        deletedAt: null,
      })
      .where(
        and(
          eq(services.trade, e.trade),
          sql`lower(${services.name}) = lower(${e.name})`
        )
      )
      .returning({ id: services.id });
    if (changed.length) updated += changed.length;
    else {
      // Pas de ligne au même nom (ex. « Chasse d’eau ») : on crée la prestation.
      const created = await db
        .insert(services)
        .values({
          seedKey:
            "v1:" + e.trade + ":" + e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          trade: e.trade,
          name: e.name,
          description: e.description,
          photoUrl: e.photoUrl,
          priceCents: e.priceCents,
          pricingRule: e.pricingRule,
          durationMinutes: e.durationMinutes,
          questions: [],
          problemTypes: [],
          conditions: "",
          zone: "Rennes et 30 km",
          active: true,
          pricingMode: e.pricingMode,
          travelMode: "included",
        })
        .returning({ id: services.id });
      updated += created.length;
    }
  }
  const [cnt] = await db
    .select({ total: count() })
    .from(services)
    .where(and(eq(services.active, true), isNull(services.deletedAt)));
  console.log(`Updated catalogue: ${updated} services updated, ${cnt.total} active.`);
}

run().then(
  () => process.exit(0),
  e => {
    console.error(e);
    process.exit(1);
  }
);
