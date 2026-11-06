import { and, eq } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { InsertUser, adminInvites, users } from "../drizzle/schema";
import { createPool, type Pool } from "mysql2/promise";

let _db: MySql2Database<Record<string, unknown>> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool(process.env.DATABASE_URL);
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function closeDatabase() {
  if (_pool) await _pool.end();
  _pool = null;
  _db = null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    // OAuth synchronization never grants a business role. Only claimArtisan does.

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
    if (user.email) {
      const email = user.email.trim().toLocaleLowerCase("fr-FR");
      const [invite] = await db
        .select({ id: adminInvites.id })
        .from(adminInvites)
        .where(
          and(eq(adminInvites.email, email), eq(adminInvites.status, "active"))
        )
        .limit(1);
      if (invite) {
        const [account] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.openId, user.openId))
          .limit(1);
        if (account) {
          await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, account.id));
          await db
            .update(adminInvites)
            .set({ acceptedBy: account.id, acceptedAt: new Date() })
            .where(eq(adminInvites.id, invite.id));
        }
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByLocalLoginKey(localLoginKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.localLoginKey, localLoginKey))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
