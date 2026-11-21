import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { router } from "../_core/trpc";
import * as s from "../../drizzle/schema";
import { artisan, dbRequired, principal } from "./common";
import { fail } from "./workflow";

const searchSchema = z
  .object({ search: z.string().trim().max(120).optional() })
  .optional();

export function normalizeContact(value: string) {
  return value.trim().toLocaleLowerCase("fr").replace(/\s+/g, "");
}

export async function findOrCreateClient(
  tx: any,
  input: {
    userId: number | null;
    organizationId?: number | null;
    name: string;
    email: string;
    phone: string;
  }
) {
  if (input.userId) {
    const [byUser] = await tx
      .select()
      .from(s.clients)
      .where(eq(s.clients.userId, input.userId));
    if (byUser) return byUser;
  }
  const email = normalizeContact(input.email);
  const phone = normalizeContact(input.phone);
  const candidates = await tx.select().from(s.clients);
  const existing = candidates.find(
    (client: typeof s.clients.$inferSelect) =>
      (!input.organizationId ||
        client.organizationId === input.organizationId) &&
      normalizeContact(client.email) === email &&
      normalizeContact(client.phone) === phone
  );
  if (existing) return existing;
  const [created] = await tx
    .insert(s.clients)
    .values({
      userId: input.userId,
      organizationId: input.organizationId || null,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
    })
    .returning({ id: s.clients.id });
  const [row] = await tx
    .select()
    .from(s.clients)
    .where(eq(s.clients.id, created.id));
  return row;
}

export const clientsRouter = router({
  list: artisan.input(searchSchema).query(async ({ input, ctx }) => {
    const db = await dbRequired();
    const p = await principal(db);
    const search = input?.search?.trim();
    const rows = await db
      .select()
      .from(s.clients)
      .where(
        search
          ? or(
              ilike(s.clients.name, `%${search}%`),
              ilike(s.clients.email, `%${search}%`),
              ilike(s.clients.phone, `%${search}%`)
            )
          : undefined
      );
    return rows.map(client => ({
      ...client,
      organizationId: client.organizationId || null,
      artisanUserId: p.artisanUserId,
    }));
  }),
  detail: artisan
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await dbRequired();
      const [client] = await db
        .select()
        .from(s.clients)
        .where(eq(s.clients.id, input.id));
      if (!client) fail("Cette fiche client est introuvable.", "NOT_FOUND");
      const requests = await db
        .select({
          id: s.requests.id,
          reference: s.requests.reference,
          status: s.requests.status,
          serviceName: s.requests.serviceName,
          createdAt: s.requests.createdAt,
        })
        .from(s.requests)
        .where(eq(s.requests.clientId, client.id));
      return { client, requests };
    }),
});
