import { eq } from "drizzle-orm";
import { closeDatabase, getDb } from "../server/db";
import { EXTERNAL_CRON_TASK } from "../server/mds/automation";
import * as s from "../drizzle/schema";

// Hébergement gratuit : lie la tâche « external-cron » (planificateur externe
// + MDS_CRON_SECRET). Idempotent. Sans identité artisan activée, rien n’est lié.
async function main() {
  if (!process.env.MDS_CRON_SECRET) {
    console.log("MDS_CRON_SECRET absent : planificateur externe non lié.");
    return;
  }
  const db = await getDb();
  if (!db) throw Error("Base indisponible.");
  await db.transaction(async tx => {
    const [settings] = await tx
      .select()
      .from(s.settings)
      .where(eq(s.settings.id, 1))
      .for("update");
    if (!settings?.artisanUserId) {
      console.log(
        "Identité artisan pas encore activée : planificateur externe non lié (redémarrez après activation)."
      );
      return;
    }
    const [old] = await tx
      .select()
      .from(s.automationTasks)
      .where(eq(s.automationTasks.id, 1))
      .for("update");
    if (old?.taskUid && old.taskUid !== EXTERNAL_CRON_TASK) {
      console.log("Une autre tâche est déjà liée : aucun changement.");
      return;
    }
    if (old?.taskUid === EXTERNAL_CRON_TASK && old.enabled) return;
    if (old)
      await tx
        .update(s.automationTasks)
        .set({ taskUid: EXTERNAL_CRON_TASK, enabled: true })
        .where(eq(s.automationTasks.id, 1));
    else
      await tx
        .insert(s.automationTasks)
        .values({ id: 1, taskUid: EXTERNAL_CRON_TASK, enabled: true });
    await tx.insert(s.audit).values({
      actorUserId: settings.artisanUserId,
      action: "automation.external.bind",
      entityType: "automationTask",
      entityId: 1,
    });
    console.log("Planificateur externe lié.");
  });
}
main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Échec du lien.");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
