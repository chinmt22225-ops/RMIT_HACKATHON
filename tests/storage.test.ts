import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCollection, deleteCollection, deleteInsight, editInsight, getInsights, saveInsight, getProfile, saveProfile } from "../src/lib/storage";
import { searchTerm } from "../src/lib/sources";

const directory = mkdtempSync(join(tmpdir(), "margin-unit-"));
process.env.MARGIN_DATA_DIR = directory;
after(() => rmSync(directory, { recursive: true, force: true }));

test("an AI-context acronym is expanded without overriding unrelated contexts", () => {
  assert.equal(searchTerm("MCP", "An AI assistant uses external tools"), "Model Context Protocol");
  assert.equal(searchTerm("MCP", "A medical examination of the hand"), "MCP");
  assert.equal(searchTerm("RAG", "retrieval for a language model"), "retrieval augmented generation");
  assert.equal(searchTerm("  photosynthesis  "), "photosynthesis");
});
test("a saved finding preserves its context, citations, and notes when its collection is deleted", () => {
  const collection = createCollection("alice", "A test curiosity");
  const finding = saveInsight("alice", {
    selection: { text: "MCP", context: "An AI assistant uses MCP.", title: "A reading", url: "https://example.org/article" },
    action: "explain", answer: "Model Context Protocol [1]", sources: [{ title: "Protocol docs", url: "https://modelcontextprotocol.io", excerpt: "An open standard", kind: "official" }],
    collectionId: collection.id, note: "", provider: "unit-test",
  });
  editInsight("alice", finding.id, { note: "My own connection", collectionId: collection.id });
  assert.equal(deleteCollection("alice", collection.id), true);
  const stored = getInsights("alice").find((item) => item.id === finding.id)!;
  assert.equal(stored.collectionId, null);
  assert.equal(stored.note, "My own connection");
  assert.deepEqual(stored.selection, finding.selection);
  assert.deepEqual(stored.sources, finding.sources);
  assert.equal(deleteInsight("alice", finding.id), true);
  assert.equal(deleteInsight("alice", finding.id), false);
});
test("a missing collection cannot receive a finding", () => {
  assert.throws(() => saveInsight("alice", { selection: { text: "term", context: "", title: "test", url: "" }, action: "explain", answer: "test", sources: [], collectionId: "00000000-0000-4000-8000-000000000000", note: "", provider: "test" }), /Collection not found/);
});


test("another user cannot read, edit, delete, or file someone else's findings", () => {
  const collection = createCollection("alice", "Private collection");
  const finding = saveInsight("alice", { selection: { text: "private", context: "private context", title: "private reading", url: "" }, action: "explain", answer: "private answer", sources: [], collectionId: collection.id, note: "", provider: "unit-test" });
  assert.deepEqual(getInsights("bob"), []);
  assert.equal(editInsight("bob", finding.id, { note: "changed", collectionId: null }), null);
  assert.equal(deleteInsight("bob", finding.id), false);
  assert.equal(deleteCollection("bob", collection.id), false);
  assert.equal(getInsights("alice").find(i => i.id === finding.id)?.collectionId, collection.id);
  assert.throws(() => saveInsight("bob", { ...finding, collectionId: collection.id }), /Collection not found/);
  deleteInsight("alice", finding.id); deleteCollection("alice", collection.id);
});

test("display names remain separate for different authenticated subjects", () => {
  saveProfile("alice", "Alice"); saveProfile("bob", "Bob");
  assert.equal(getProfile("alice").displayName, "Alice");
  assert.equal(getProfile("bob").displayName, "Bob");
  assert.equal(getProfile("unknown").displayName, "");
});
