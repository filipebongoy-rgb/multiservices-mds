import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import * as db from "../db";
import {
  localCredentials,
  localSessions,
  users,
  type User,
} from "../../drizzle/schema";
import { getSessionCookieOptions } from "./cookies";

export const LOCAL_SESSION_COOKIE = "mds_local_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export function normalizeLocalLoginKey(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ");
}

function hashPassword(password: string, saltHex: string) {
  return scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    64,
    SCRYPT_OPTIONS
  ).toString("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(req: Request) {
  return { ...getSessionCookieOptions(req), maxAge: SESSION_TTL_MS };
}

export async function registerLocalUser(input: {
  firstName: string;
  lastName: string;
  password: string;
  accountType: "particular" | "professional";
  req: Request;
  res: Response;
}) {
  const database = await db.getDb();
  if (!database)
    throw new Error("La base de données est momentanément indisponible.");
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const loginKey = normalizeLocalLoginKey(firstName, lastName);
  const salt = randomBytes(32).toString("hex");
  const openId = `local_${randomBytes(24).toString("hex")}`;
  try {
    await database.transaction(async tx => {
      await tx.insert(users).values({
        openId,
        name: `${firstName} ${lastName}`,
        email: null,
        loginMethod: "local-password",
        localLoginKey: loginKey,
        accountType: input.accountType,
        role: "user",
        lastSignedIn: new Date(),
      });
      const created = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);
      if (!created[0]) throw new Error("Création du compte impossible.");
      await tx.insert(localCredentials).values({
        userId: created[0].id,
        passwordHash: hashPassword(input.password, salt),
        passwordSalt: salt,
      });
    });
  } catch (error) {
    if (String(error).toLowerCase().includes("localLoginKey")) {
      throw new Error(
        "Un compte existe déjà avec ce prénom et ce nom. Ajoutez un deuxième prénom ou contactez MDS."
      );
    }
    throw error;
  }
  const user = await db.getUserByLocalLoginKey(loginKey);
  if (!user) throw new Error("Compte créé mais introuvable.");
  await createLocalSession(user, input.req, input.res);
  return user;
}

export async function loginLocalUser(input: {
  firstName: string;
  lastName: string;
  password: string;
  req: Request;
  res: Response;
}) {
  const database = await db.getDb();
  if (!database)
    throw new Error("La base de données est momentanément indisponible.");
  const loginKey = normalizeLocalLoginKey(input.firstName, input.lastName);
  const found = await database
    .select({ user: users, credentials: localCredentials })
    .from(users)
    .innerJoin(localCredentials, eq(localCredentials.userId, users.id))
    .where(eq(users.localLoginKey, loginKey))
    .limit(1);
  const record = found[0];
  if (!record) throw new Error("Prénom, nom ou mot de passe incorrect.");
  if (
    record.credentials.lockedUntil &&
    record.credentials.lockedUntil > new Date()
  ) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }
  const expected = Buffer.from(record.credentials.passwordHash, "hex");
  const actual = Buffer.from(
    hashPassword(input.password, record.credentials.passwordSalt),
    "hex"
  );
  const valid =
    expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!valid) {
    const attempts = record.credentials.failedAttempts + 1;
    await database
      .update(localCredentials)
      .set({
        failedAttempts: attempts >= 5 ? 0 : attempts,
        lockedUntil:
          attempts >= 5 ? new Date(Date.now() + 10 * 60 * 1000) : null,
      })
      .where(eq(localCredentials.userId, record.user.id));
    throw new Error("Prénom, nom ou mot de passe incorrect.");
  }
  await database
    .update(localCredentials)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(localCredentials.userId, record.user.id));
  await database
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, record.user.id));
  await createLocalSession(record.user, input.req, input.res);
  return record.user;
}

export async function authenticateLocalRequest(req: Request) {
  const token = readLocalSessionToken(req);
  if (!token) return null;
  const database = await db.getDb();
  if (!database) return null;
  const rows = await database
    .select({ user: users, expiresAt: localSessions.expiresAt })
    .from(localSessions)
    .innerJoin(users, eq(users.id, localSessions.userId))
    .where(
      and(
        eq(localSessions.tokenHash, hashToken(token)),
        gt(localSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!rows[0]) return null;
  await database
    .update(localSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(localSessions.tokenHash, hashToken(token)));
  return rows[0].user;
}

export async function clearLocalSession(req: Request, res: Response) {
  const token = readLocalSessionToken(req);
  if (!token) return;
  const database = await db.getDb();
  if (database) {
    await database
      .delete(localSessions)
      .where(eq(localSessions.tokenHash, hashToken(token)));
  }
  res.clearCookie(LOCAL_SESSION_COOKIE, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}

async function createLocalSession(user: User, req: Request, res: Response) {
  const database = await db.getDb();
  if (!database)
    throw new Error("La base de données est momentanément indisponible.");
  const token = randomBytes(48).toString("base64url");
  await database.insert(localSessions).values({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(LOCAL_SESSION_COOKIE, token, cookieOptions(req));
}

function readLocalSessionToken(req: Request) {
  const header = req.headers.cookie ?? "";
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${LOCAL_SESSION_COOKIE}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
