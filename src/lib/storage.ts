import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Collection, Insight } from "./types";

const globalDb = globalThis as typeof globalThis & { marginDb?: DatabaseSync };
function db() {
  if (globalDb.marginDb) return globalDb.marginDb;
  const root = process.env.MARGIN_DATA_DIR || join(process.cwd(), ".data");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = join(root, "margin.sqlite");
  const database = new DatabaseSync(file);
  chmodSync(file, 0o600);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS insights(id TEXT PRIMARY KEY, data TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, createdAt TEXT NOT NULL);`);
  globalDb.marginDb = database;
  return database;
}
export function getInsights(): Insight[] {
  return (db().prepare("SELECT data FROM insights ORDER BY createdAt DESC").all() as { data: string }[]).map((row) => JSON.parse(row.data));
}
export function saveInsight(input: Omit<Insight, "id" | "createdAt">): Insight {
  if (input.collectionId && !getCollections().some((c) => c.id === input.collectionId)) throw new Error("Collection not found");
  const insight = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  db().prepare("INSERT INTO insights VALUES (?, ?, ?)").run(insight.id, JSON.stringify(insight), insight.createdAt);
  return insight;
}
export function editInsight(id: string, update: Pick<Insight, "note" | "collectionId">): Insight | null {
  const row = db().prepare("SELECT data FROM insights WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  if (update.collectionId && !getCollections().some((c) => c.id === update.collectionId)) throw new Error("Collection not found");
  const insight: Insight = { ...JSON.parse(row.data), ...update };
  db().prepare("UPDATE insights SET data=? WHERE id=?").run(JSON.stringify(insight), id);
  return insight;
}
export function deleteInsight(id: string) { return db().prepare("DELETE FROM insights WHERE id=?").run(id).changes > 0; }
export function getCollections(): Collection[] { return db().prepare("SELECT * FROM collections ORDER BY createdAt").all() as unknown as Collection[]; }
export function createCollection(name: string): Collection {
  const colors = ["#4b7165", "#9b7950", "#72658d", "#49758b", "#a8675b"];
  const collection = { id: randomUUID(), name, color: colors[getCollections().length % colors.length], createdAt: new Date().toISOString() };
  db().prepare("INSERT INTO collections VALUES (?, ?, ?, ?)").run(collection.id, name, collection.color, collection.createdAt);
  return collection;
}
export function deleteCollection(id: string) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE insights SET data=json_set(data, '$.collectionId', NULL) WHERE json_extract(data,'$.collectionId')=?").run(id);
    const deleted = database.prepare("DELETE FROM collections WHERE id=?").run(id).changes > 0;
    database.exec("COMMIT");
    return deleted;
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
