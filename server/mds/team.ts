import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { authenticated, dbRequired, principal, recordAudit, requireAdmin } from "./common";
import { fail } from "./workflow";

const email = z.string().trim().email().max(320).transform(value => value.toLowerCase());

export const teamRouter = router({
  me: authenticated.query(async ({ ctx }) => {
    const db = await dbRequired();
    const [member] = await db.select().from(s.artisanTeam).where(and(eq(s.artisanTeam.userId, ctx.user.id), eq(s.artisanTeam.status, "active"))).limit(1);
    return member || null;
  }),
  list: authenticated.query(async ({ ctx }) => {
    const db = await dbRequired();
    await requireAdmin(db, ctx.user);
    const rows = await db
      .select()
      .from(s.artisanTeam)
      .where(eq(s.artisanTeam.ownerUserId, ctx.user.id))
      .orderBy(s.artisanTeam.displayName);
    return rows.map(({ ...row }) => row);
  }),
  invite: authenticated
    .input(z.object({ email, displayName: z.string().trim().min(2).max(200), role: z.enum(["technician", "assistant"]).default("technician") }))
    .mutation(async ({ input, ctx }) => {
      const db = await dbRequired();
      await requireAdmin(db, ctx.user);
      return db.transaction(async tx => {
        await principal(tx, true);
        const [existing] = await tx
          .select({ id: s.artisanTeam.id })
          .from(s.artisanTeam)
          .where(and(eq(s.artisanTeam.ownerUserId, ctx.user.id), eq(s.artisanTeam.email, input.email)))
          .limit(1);
        const [user] = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, input.email)).limit(1);
        if (existing) {
          await tx.update(s.artisanTeam).set({ displayName: input.displayName, role: input.role, userId: user?.id ?? null, status: user ? "active" : "pending" }).where(eq(s.artisanTeam.id, existing.id));
          await recordAudit(tx, ctx.user.id, "team.invite.update", "artisanTeam", existing.id);
          return { id: existing.id, status: user ? "active" as const : "pending" as const };
        }
        const [created] = await tx.insert(s.artisanTeam).values({ ownerUserId: ctx.user.id, userId: user?.id ?? null, email: input.email, displayName: input.displayName, role: input.role, status: user ? "active" : "pending" }).returning({ id: s.artisanTeam.id });
        if (user) {
          await tx.insert(s.notifications).values({ userId: user.id, audience: "artisan", title: "Accès collaborateur MDS", message: "Vous pouvez maintenant consulter et réaliser les interventions qui vous sont affectées." });
        }
        await recordAudit(tx, ctx.user.id, "team.invite", "artisanTeam", created.id);
        return { id: created.id, status: user ? "active" as const : "pending" as const };
      });
    }),
  revoke: authenticated.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    await requireAdmin(db, ctx.user);
    const [row] = await db.select({ id: s.artisanTeam.id }).from(s.artisanTeam).where(and(eq(s.artisanTeam.id, input.id), eq(s.artisanTeam.ownerUserId, ctx.user.id))).limit(1);
    if (!row) fail("Ce collaborateur est introuvable.", "NOT_FOUND");
    await db.update(s.artisanTeam).set({ status: "revoked" }).where(eq(s.artisanTeam.id, input.id));
    await recordAudit(db, ctx.user.id, "team.revoke", "artisanTeam", input.id);
    return { success: true as const };
  }),
  assign: authenticated.input(z.object({ requestId: z.number().int().positive(), teamMemberId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await dbRequired();
    await requireAdmin(db, ctx.user);
    return db.transaction(async tx => {
      await principal(tx, true);
      const [member] = await tx.select().from(s.artisanTeam).where(and(eq(s.artisanTeam.id, input.teamMemberId), eq(s.artisanTeam.ownerUserId, ctx.user.id), eq(s.artisanTeam.status, "active"))).limit(1);
      if (!member) fail("Ce collaborateur n’est pas actif ou ne vous appartient pas.", "FORBIDDEN");
      const [request] = await tx.select({ id: s.requests.id, reference: s.requests.reference }).from(s.requests).where(eq(s.requests.id, input.requestId)).limit(1);
      if (!request) fail("Cette intervention est introuvable.", "NOT_FOUND");
      const [existing] = await tx.select({ id: s.artisanAssignments.id }).from(s.artisanAssignments).where(eq(s.artisanAssignments.requestId, input.requestId)).limit(1);
      if (existing) await tx.update(s.artisanAssignments).set({ teamMemberId: input.teamMemberId, status: "assigned", assignedBy: ctx.user.id }).where(eq(s.artisanAssignments.id, existing.id));
      else await tx.insert(s.artisanAssignments).values({ requestId: input.requestId, teamMemberId: input.teamMemberId, assignedBy: ctx.user.id, status: "assigned" });
      if (member.userId) await tx.insert(s.notifications).values({ userId: member.userId, requestId: input.requestId, audience: "artisan", title: "Nouvelle intervention affectée", message: `Le dossier ${request.reference} vous a été affecté. Consultez votre planning.` });
      await recordAudit(tx, ctx.user.id, "team.assign", "request", input.requestId);
      return { success: true as const, reference: request.reference };
    });
  }),
});
