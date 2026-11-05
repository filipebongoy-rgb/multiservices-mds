import { eq } from "drizzle-orm";
import { listHeartbeatJobs } from "../server/_core/heartbeat";
import { getDb, closeDatabase } from "../server/db";
import * as s from "../drizzle/schema";

// Finite operator command, intentionally never called at app startup/build.
async function main() {
  const uid = process.env.MDS_MAINTENANCE_TASK_UID;
  if (!uid || uid.length > 255)
    throw Error(
      "Indiquez MDS_MAINTENANCE_TASK_UID depuis le résultat de la création native après publication."
    );
  const collection = await listHeartbeatJobs("", { page: 1, pageSize: 200 });
  const task = collection.jobs.find(job => job.taskUid === uid);
  if (
    !task ||
    task.callbackPath !== "/api/scheduled/mds-maintenance" ||
    task.callbackMethod !== "POST" ||
    !task.isEnable
  )
    throw Error(
      "La tâche native active ne correspond pas au callback MDS. Aucun rattachement effectué."
    );
  const db = await getDb();
  if (!db) throw Error("Base indisponible.");
  await db.transaction(async tx => {
    const [settings] = await tx
      .select()
      .from(s.settings)
      .where(eq(s.settings.id, 1))
      .for("update");
    if (!settings?.artisanUserId)
      throw Error("Activez l’identité artisan avant la maintenance autonome.");
    const [old] = await tx
      .select()
      .from(s.automationTasks)
      .where(eq(s.automationTasks.id, 1))
      .for("update");
    if (old && old.taskUid && old.taskUid !== uid)
      throw Error(
        "Une autre tâche est déjà liée. Vérification opérateur requise."
      );
    if (old)
      await tx
        .update(s.automationTasks)
        .set({ taskUid: uid, enabled: true })
        .where(eq(s.automationTasks.id, 1));
    else
      await tx
        .insert(s.automationTasks)
        .values({ id: 1, taskUid: uid, enabled: true });
    await tx
      .insert(s.audit)
      .values({
        actorUserId: settings.artisanUserId,
        action: "automation.native.bind.verified",
        entityType: "automationTask",
        entityId: 1,
      });
  });
  console.log(
    "Tâche native vérifiée et liée. Contrôlez sa première exécution dans le journal."
  );
}
main()
  .catch(error => {
    console.error(
      error instanceof Error ? error.message : "Échec du rattachement."
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
