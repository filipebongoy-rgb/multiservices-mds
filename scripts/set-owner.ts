import { and, eq } from "drizzle-orm";
import { closeDatabase, getDb } from "../server/db";
import * as s from "../drizzle/schema";

// Hébergement gratuit : désigne le propriétaire (identité artisan) à partir de
// MDS_OWNER_EMAIL, une fois son compte créé et devenu administrateur par
// invitation. Idempotent : ne change jamais un propriétaire déjà désigné.
async function main() {
  const email = process.env.MDS_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const db = await getDb();
  if (!db) throw Error("Base indisponible.");
  await db.transaction(async tx => {
    const [settings] = await tx
      .select()
      .from(s.settings)
      .where(eq(s.settings.id, 1))
      .for("update");
    if (!settings || settings.artisanUserId) return;
    const [user] = await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(and(eq(s.users.email, email), eq(s.users.role, "admin")));
    if (!user) {
      console.log(
        "Propriétaire : compte administrateur introuvable pour MDS_OWNER_EMAIL (créez le compte, reconnectez-vous, puis redémarrez)."
      );
      return;
    }
    await tx
      .update(s.settings)
      .set({
        artisanUserId: user.id,
        activationHash: null,
        activationUsedAt: new Date(),
      })
      .where(eq(s.settings.id, 1));
    await tx.insert(s.audit).values({
      actorUserId: user.id,
      action: "artisan.claim.operator",
      entityType: "user",
      entityId: user.id,
    });
    console.log("Propriétaire désigné.");
  });
}
main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Échec.");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
