import { describe, expect, it } from "vitest";
import { MockDatabase } from "./test-db";
import * as s from "../../drizzle/schema";
import { findOrCreateClient } from "./clients";

describe("fiches clients sans doublon", () => {
  it("réutilise une fiche sur identité ou coordonnées exactes", async () => {
    const db = new MockDatabase();
    db.put(s.clients, []);
    const first = await findOrCreateClient(db, {
      userId: null,
      organizationId: 7,
      name: "Mme Test",
      email: "client@example.test",
      phone: "01 02 03 04 05",
    });
    const same = await findOrCreateClient(db, {
      userId: null,
      organizationId: 7,
      name: "Nom légèrement différent",
      email: " CLIENT@example.test ",
      phone: "0102030405",
    });
    const other = await findOrCreateClient(db, {
      userId: null,
      organizationId: 7,
      name: "Autre personne",
      email: "client@example.test",
      phone: "0607080910",
    });
    expect(same.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(db.rows(s.clients)).toHaveLength(2);
  });

  it("privilégie une identité authentifiée même si les coordonnées ont changé", async () => {
    const db = new MockDatabase();
    db.put(s.clients, []);
    const first = await findOrCreateClient(db, {
      userId: 12,
      organizationId: null,
      name: "Client connecté",
      email: "old@example.test",
      phone: "0102030405",
    });
    const same = await findOrCreateClient(db, {
      userId: 12,
      organizationId: null,
      name: "Client connecté",
      email: "new@example.test",
      phone: "0607080910",
    });
    expect(same.id).toBe(first.id);
    expect(db.rows(s.clients)).toHaveLength(1);
  });
});
