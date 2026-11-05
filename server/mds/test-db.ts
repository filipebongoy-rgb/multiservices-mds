// In-memory Drizzle boundary used ONLY by unit tests; never imported by production.
import { getTableColumns, getTableName, type AnyColumn, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
type Row = Record<string, any>;
type Store = Record<string, Row[]>;
const dialect = new MySqlDialect();
function condition(sql: SQL | undefined, row: Row) {
  if (!sql) return true;
  const query = dialect.sqlToQuery(sql);
  const tokens = query.sql.match(/`[^`]+`(?:\.`[^`]+`)?|\(|\)|,|<=|>=|<>|!=|=|<|>|\?|\b\w+\b/g) || [];
  let pos = 0; let parameter = 0;
  function value(): any {
    const t = tokens[pos++];
    if (t === "?") return query.params[parameter++];
    if (t.startsWith("`")) return row[t.split("`").filter(Boolean).at(-1)!];
    if (t === "true") return true; if (t === "false") return false; if (t === "null") return null;
    return t;
  }
  function atom(): boolean {
    if (tokens[pos] === "(") { pos++; const r = disjunction(); pos++; return r; }
    const a = value();
    const op = tokens[pos];
    if (!op || [")", "and", "or"].includes(op)) return !!a;
    pos++;
    if (op === "is") { let negate = false; if (tokens[pos] === "not") { negate = true; pos++; } pos++; return negate ? a != null : a == null; }
    if (op === "in") { pos++; const values: any[] = []; while (tokens[pos] !== ")") { if (tokens[pos] === ",") pos++; else values.push(value()); } pos++; return values.includes(a); }
    const b = value();
    const left = a instanceof Date ? a.getTime() : a;
    const right = a instanceof Date ? new Date(b).getTime() : b;
    switch (op) { case "=": return left === right; case "<>": case "!=": return left !== right; case "<": return left < right; case ">": return left > right; case "<=": return left <= right; case ">=": return left >= right; default: throw new Error(`Unsupported test SQL ${op}: ${query.sql}`); }
  }
  function conjunction(): boolean { let result = atom(); while (tokens[pos] === "and") { pos++; const right = atom(); result = result && right; } return result; }
  function disjunction(): boolean { let result = conjunction(); while (tokens[pos] === "or") { pos++; const right = conjunction(); result = result || right; } return result; }
  return disjunction();
}
export class MockDatabase {
  tables: Store = {};
  operations: { operation: string; table: string; locked: boolean }[] = [];
  private queue: Promise<void> = Promise.resolve();
  put(table: any, rows: Row[]) { this.tables[getTableName(table)] = structuredClone(rows); return this; }
  rows(table: any) { return this.tables[getTableName(table)] ||= []; }
  clear() { this.tables = {}; this.operations = []; this.queue = Promise.resolve(); }
  private async acquire() { const previous = this.queue; let release!: () => void; this.queue = new Promise(resolve => { release = resolve; }); await previous; return release; }
  async transaction<T>(callback: (tx: any) => Promise<T>) {
    let release: (() => void) | undefined; let snapshot: Store | undefined;
    const lock = async () => { if (!release) { release = await this.acquire(); snapshot = structuredClone(this.tables); } };
    try { return await callback(this.executor(lock)); }
    catch (e) { if (snapshot) this.tables = snapshot; throw e; }
    finally { release?.(); }
  }
  private executor(lock: () => Promise<void> = async () => {}) {
    return this.builders(lock);
  }
  select(fields?: Row): any { return this.query("select", fields); }
  insert(table: any): any { return this.query("insert").from(table); }
  update(table: any): any { return this.query("update").from(table); }
  delete(table: any): any { return this.query("delete").from(table); }
  private query(operation: string, fields?: Row, acquire: () => Promise<void> = async () => {}) {
    const self = this;
    let table: any; let where: SQL | undefined; let locked = false; let data: Row = {}; let maximum: number | undefined; let duplicate: Row | undefined;
    const query: any = {
      from(t: any) { table = t; return query; }, where(c: SQL) { where = c; return query; }, for() { locked = true; return query; }, orderBy() { return query; }, limit(n: number) { maximum = n; return query; },
      values(v: Row) { data = v; return query; }, set(v: Row) { data = v; return query; }, onDuplicateKeyUpdate(o: { set: Row }) { duplicate = o.set; return query; },
      $returningId: async () => { const result = await execute(); return [{ id: result[0].insertId }]; },
      then: (yes: any, no: any) => execute().then(yes, no),
    };
    async function execute(): Promise<any> {
      const name = getTableName(table);
      if (locked && name === "mds_settings") await acquire();
      self.operations.push({ operation, table: name, locked });
      const rows = self.rows(table);
      const matches = rows.filter(r => condition(where, r)).slice(0, maximum);
      if (operation === "select") return matches.map(r => fields ? Object.fromEntries(Object.entries(fields).map(([key, col]) => [key, r[col.name]])) : structuredClone(r));
      if (operation === "insert") {
        const columns = getTableColumns(table) as Record<string, AnyColumn>;
        const defaults: Row = {};
        for (const [key, column] of Object.entries(columns)) {
          if (column.default !== undefined && ["string", "boolean", "number"].includes(typeof column.default)) defaults[key] = column.default;
          else if (!column.notNull) defaults[key] = null;
        }
        for (const key of Object.keys(data)) if (!(key in columns)) throw new Error(`Unknown SQL column ${name}.${key}`);
        const existing = name === "mds_notification_reads" ? rows.find(r => r.notificationId === data.notificationId && r.userId === data.userId) : undefined;
        if (duplicate && existing) { Object.assign(existing, duplicate); return [{ insertId: existing.id, affectedRows: 1 }]; }
        const newId = Math.max(0, ...rows.map(r => Number(r.id) || 0)) + 1;
        rows.push({ ...defaults, id: newId, createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) });
        return [{ insertId: newId, affectedRows: 1 }];
      }
      if (operation === "update") { for (const row of matches) Object.assign(row, structuredClone(data)); return [{ affectedRows: matches.length }]; }
      if (operation === "delete") { self.tables[name] = rows.filter(r => !condition(where, r)); return [{ affectedRows: matches.length }]; }
      throw new Error(`Unsupported test operation ${operation}`);
    }
    return query;
  }
  // Transaction-bound builders preserve the real .for('update') boundary.
  private builders(acquire: () => Promise<void>) {
    return {
      select: (fields?: Row) => this.query("select", fields, acquire), insert: (t: any) => this.query("insert", undefined, acquire).from(t),
      update: (t: any) => this.query("update", undefined, acquire).from(t), delete: (t: any) => this.query("delete", undefined, acquire).from(t),
    };
  }
}
