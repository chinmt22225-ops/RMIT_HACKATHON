import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Collection, Insight } from "./types";

const globalDb = globalThis as typeof globalThis & { marginDb?: DatabaseSync; marginSchema?: number };
export function database() {
  if (globalDb.marginDb && globalDb.marginSchema === 3) return globalDb.marginDb;
  const root = process.env.MARGIN_DATA_DIR || join(process.cwd(), ".data");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = join(root, "margin.sqlite");
  const database = globalDb.marginDb || new DatabaseSync(file);
  chmodSync(file, 0o600);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS insights(id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dpop_proofs(id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_windows(id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles(owner TEXT PRIMARY KEY, displayName TEXT NOT NULL);`);
  // Preserve old local findings, but do not assign them to an arbitrary first login.
  for (const table of ["insights", "collections"]) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((column) => column.name === "owner")) database.exec(`ALTER TABLE ${table} ADD COLUMN owner TEXT NOT NULL DEFAULT 'legacy-local'`);
    database.exec(`CREATE INDEX IF NOT EXISTS ${table}_owner ON ${table}(owner)`);
  }
  globalDb.marginDb = database;
  globalDb.marginSchema = 3;
  return database;
}
export function getProfile(owner: string): { displayName: string } {
  return database().prepare("SELECT displayName FROM profiles WHERE owner=?").get(owner) as { displayName: string } | undefined || { displayName: "" };
}
export function saveProfile(owner: string, displayName: string) {
  database().prepare("INSERT INTO profiles(owner,displayName) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET displayName=excluded.displayName").run(owner, displayName);
  return getProfile(owner);
}
export function getInsights(owner: string): Insight[] {
  return (database().prepare("SELECT data FROM insights WHERE owner=? ORDER BY createdAt DESC").all(owner) as { data: string }[]).map((row) => JSON.parse(row.data));
}
export function saveInsight(owner: string, input: Omit<Insight, "id" | "createdAt">): Insight {
  if (input.collectionId && !getCollections(owner).some((c) => c.id === input.collectionId)) throw new Error("Collection not found");
  const insight = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  database().prepare("INSERT INTO insights(id,data,createdAt,owner) VALUES (?, ?, ?, ?)").run(insight.id, JSON.stringify(insight), insight.createdAt, owner);
  return insight;
}
export function editInsight(owner: string, id: string, update: Pick<Insight, "note" | "collectionId">): Insight | null {
  const row = database().prepare("SELECT data FROM insights WHERE id = ? AND owner=?").get(id, owner) as { data: string } | undefined;
  if (!row) return null;
  if (update.collectionId && !getCollections(owner).some((c) => c.id === update.collectionId)) throw new Error("Collection not found");
  const insight: Insight = { ...JSON.parse(row.data), ...update };
  database().prepare("UPDATE insights SET data=? WHERE id=? AND owner=?").run(JSON.stringify(insight), id, owner);
  return insight;
}
export function deleteInsight(owner: string, id: string) { return database().prepare("DELETE FROM insights WHERE id=? AND owner=?").run(id, owner).changes > 0; }
export function getCollections(owner: string): Collection[] { return database().prepare("SELECT id,name,color,createdAt FROM collections WHERE owner=? ORDER BY createdAt").all(owner) as unknown as Collection[]; }
export function createCollection(owner: string, name: string): Collection {
  const colors = ["#4b7165", "#9b7950", "#72658d", "#49758b", "#a8675b"];
  const collection = { id: randomUUID(), name, color: colors[getCollections(owner).length % colors.length], createdAt: new Date().toISOString() };
  database().prepare("INSERT INTO collections(id,name,color,createdAt,owner) VALUES (?, ?, ?, ?, ?)").run(collection.id, name, collection.color, collection.createdAt, owner);
  return collection;
}
export function deleteCollection(owner: string, id: string) {
  const store = database();
  store.exec("BEGIN IMMEDIATE");
  try {
    store.prepare("UPDATE insights SET data=json_set(data, '$.collectionId', NULL) WHERE json_extract(data,'$.collectionId')=? AND owner=? AND EXISTS(SELECT 1 FROM collections WHERE id=? AND owner=?)").run(id, owner, id, owner);
    const deleted = store.prepare("DELETE FROM collections WHERE id=? AND owner=?").run(id, owner).changes > 0;
    store.exec("COMMIT");
    return deleted;
  } catch (error) { store.exec("ROLLBACK"); throw error; }
}
