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
  adminInvites,
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

export async function changeLocalPassword(input: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}) {
  const database = await db.getDb();
  if (!database)
    throw new Error("La base de données est momentanément indisponible.");
  const [record] = await database
    .select({ credentials: localCredentials })
    .from(localCredentials)
    .where(eq(localCredentials.userId, input.userId))
    .limit(1);
  if (!record)
    throw new Error(
      "Ce compte utilise une connexion externe ; aucun mot de passe local n’est disponible."
    );
  const expected = Buffer.from(record.credentials.passwordHash, "hex");
  const actual = Buffer.from(
    hashPassword(input.currentPassword, record.credentials.passwordSalt),
    "hex"
  );
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error("Le mot de passe actuel est incorrect.");
  const salt = randomBytes(32).toString("hex");
  await database
    .update(localCredentials)
    .set({
      passwordHash: hashPassword(input.newPassword, salt),
      passwordSalt: salt,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(localCredentials.userId, input.userId));
}

function cookieOptions(req: Request) {
  return { ...getSessionCookieOptions(req), maxAge: SESSION_TTL_MS };
}

export async function registerLocalUser(input: {
  firstName: string;
  lastName: string;
  email: string;
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
  const email = input.email.trim().toLocaleLowerCase("fr-FR");
  const loginKey = normalizeLocalLoginKey(firstName, lastName);
  const salt = randomBytes(32).toString("hex");
  const openId = `local_${randomBytes(24).toString("hex")}`;
  try {
    await database.transaction(async tx => {
      await tx.insert(users).values({
        openId,
        name: `${firstName} ${lastName}`,
        email,
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
    if (/(localLoginKey|duplicate|unique)/i.test(String(error))) {
      throw new Error(
        "Un compte existe déjà avec ce prénom et ce nom. Ajoutez un deuxième prénom ou contactez MDS."
      );
    }
    throw error;
  }
  const user = await db.getUserByLocalLoginKey(loginKey);
  if (!user) throw new Error("Compte créé mais introuvable.");
  const readyUser = await promoteLocalAdminIfInvited(user);
  await createLocalSession(readyUser, input.req, input.res);
  return readyUser;
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
  const readyUser = await promoteLocalAdminIfInvited(record.user);
  await createLocalSession(readyUser, input.req, input.res);
  return readyUser;
}

async function promoteLocalAdminIfInvited(user: User) {
  if (!user.email) return user;
  const database = await db.getDb();
  if (!database) return user;
  const email = user.email.trim().toLocaleLowerCase("fr-FR");
  const [invite] = await database
    .select({ id: adminInvites.id })
    .from(adminInvites)
    .where(
      and(eq(adminInvites.email, email), eq(adminInvites.status, "active"))
    )
    .limit(1);
  if (!invite) return user;
  await database
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, user.id));
  await database
    .update(adminInvites)
    .set({ acceptedBy: user.id, acceptedAt: new Date() })
    .where(eq(adminInvites.id, invite.id));
  return { ...user, role: "admin" as const };
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
