import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCollection, deleteCollection, deleteInsight, editInsight, getInsights, saveInsight } from "../src/lib/storage";
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
  const collection = createCollection("A test curiosity");
  const finding = saveInsight({
    selection: { text: "MCP", context: "An AI assistant uses MCP.", title: "A reading", url: "https://example.org/article" },
    action: "explain", answer: "Model Context Protocol [1]", sources: [{ title: "Protocol docs", url: "https://modelcontextprotocol.io", excerpt: "An open standard", kind: "official" }],
    collectionId: collection.id, note: "", provider: "unit-test",
  });
  editInsight(finding.id, { note: "My own connection", collectionId: collection.id });
  assert.equal(deleteCollection(collection.id), true);
  const stored = getInsights().find((item) => item.id === finding.id)!;
  assert.equal(stored.collectionId, null);
  assert.equal(stored.note, "My own connection");
  assert.deepEqual(stored.selection, finding.selection);
  assert.deepEqual(stored.sources, finding.sources);
  assert.equal(deleteInsight(finding.id), true);
  assert.equal(deleteInsight(finding.id), false);
});
test("a missing collection cannot receive a finding", () => {
  assert.throws(() => saveInsight({ selection: { text: "term", context: "", title: "test", url: "" }, action: "explain", answer: "test", sources: [], collectionId: "00000000-0000-4000-8000-000000000000", note: "", provider: "test" }), /Collection not found/);
});
