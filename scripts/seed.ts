import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, chmod, access } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { trades } from "../shared/mds";
import * as s from "../drizzle/schema";
import { closeDatabase } from "../server/db";
import { dbRequired, hash, principal } from "../server/mds/common";

const activationFile = "/home/ubuntu/mds-artisan-activation.txt";
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
async function seed() {
  const db = await dbRequired();
  await db.transaction(async tx => {
    await tx.insert(s.settings).values({ id: 1, legalNotice: "" }).onDuplicateKeyUpdate({ set: { id: 1 } });
    const p = await principal(tx, true);
    if (!p.trackingSecret) {
      await tx.update(s.settings).set({ trackingSecret: randomBytes(32).toString("hex") }).where(eq(s.settings.id, 1));
      console.log("Clé de suivi applicative indépendante initialisée une fois, non exposée.");
    }
    if (!p.artisanUserId && !p.activationHash) {
      let code: string;
      if (await exists(activationFile)) {
        code = (await readFile(activationFile, "utf8")).trim();
        if (!/^[a-f0-9]{64}$/.test(code)) throw new Error("Le fichier d’activation existant est invalide ; aucune régénération automatique.");
      } else {
        code = randomBytes(32).toString("hex");
        await writeFile(activationFile, code + "\n", { flag: "wx", mode: 0o600 });
      }
      await chmod(activationFile, 0o600);
      await tx.update(s.settings).set({ activationHash: hash(code) }).where(eq(s.settings.id, 1));
      console.log("Activation initialisée : fichier privé hors Git (code non affiché).");
    } else if (await exists(activationFile)) {
      await chmod(activationFile, 0o600);
      if (p.activationHash && hash((await readFile(activationFile, "utf8")).trim()) !== p.activationHash) throw new Error("Le fichier d’activation ne correspond pas au hash enregistré ; aucune régénération.");
    } else if (!p.artisanUserId && p.activationHash) {
      console.warn("Code déjà initialisé mais fichier absent : aucune régénération automatique. Récupération opérateur requise.");
    }
    const version = "catalogue-inactive-v1";
    const [applied] = await tx.select().from(s.seedVersions).where(eq(s.seedVersions.version, version));
    if (applied) { console.log("Seed catalogue v1 déjà appliqué ; modifications préservées."); return; }
    let count = 0;
    for (const trade of trades) {
      for (const [position, name] of trade.services.entries()) {
        const seedKey = `v1:${trade.slug}:${position}`;
        const [existing] = await tx.select({ id: s.services.id }).from(s.services).where(eq(s.services.seedKey, seedKey));
        if (existing) continue;
        await tx.insert(s.services).values({ seedKey, trade: trade.slug, name, description: "", photoUrl: "", priceCents: null, pricingRule: "Sur devis après analyse", durationMinutes: 60, questions: [], problemTypes: [], conditions: "", zone: "", active: false });
        count++;
      }
    }
    await tx.insert(s.seedVersions).values({ version });
    console.log(`${count} prestations de configuration inactives ajoutées ; aucun client ni tarif fictif.`);
  });
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeDatabase);
