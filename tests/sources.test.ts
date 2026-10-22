import { test } from "node:test";
import assert from "node:assert/strict";
import { preferredKind, relevance, searchTerm } from "../src/lib/sources";
import { citedSourceNumbers } from "../src/lib/sourcePresentation";
import type { Source } from "../src/lib/types";

test("source preferences use actual domains and identify preprints", () => {
  assert.equal(preferredKind("https://science.nasa.gov/learning"), "government");
  assert.equal(preferredKind("https://www.ox.ac.uk/research"), "academic");
  assert.equal(preferredKind("https://cs.stanford.edu/paper"), "academic");
  assert.equal(preferredKind("https://arxiv.org/abs/2005.11401"), "preprint");
  for (const url of ["https://nasa.gov.evil.com/x", "https://notstanfordedu.com/x", "https://stanford.edu@evil.com/x", "javascript:alert(1)"]) assert.equal(preferredKind(url), null);
});
test("a bibliographic record cannot be presented as evidence for a claim", () => {
  const sources: Source[] = [
    { title: "Excerpt", url: "https://www.nasa.gov", excerpt: "Text", kind: "government", evidence: "excerpt" },
    { title: "Record", url: "https://doi.org/10.1/example", excerpt: "Metadata", kind: "paper", evidence: "metadata" },
  ];
  assert.deepEqual([...citedSourceNumbers("A claim [1], another [2], invented [8].", sources)], [1]);
});
test("source queries preserve contextual acronym meaning and filter unrelated results", () => {
  assert.equal(searchTerm("What is MCP?", "AI assistants"), "Model Context Protocol");
  assert.equal(searchTerm("MCP", "The metacarpophalangeal joint"), "MCP");
  assert.equal(searchTerm("Explain opportunity cost"), "opportunity cost");
  assert.equal(relevance("Model Context Protocol", "Agent to Agent communication"), 0);
});
