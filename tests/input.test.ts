import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { body } from "../src/lib/http";
import { isPublicAddress, readPublicArticle } from "../src/lib/publicArticle";

test("chunked input is limited by bytes, including multibyte text", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify({ text: "世".repeat(60_000) }))); },
    cancel() { canceled = true; },
  });
  const request = new Request("http://localhost/api/assist", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(body(request, z.object({ text: z.string() })), /too large/);
  assert.equal(canceled, true);
});

test("article imports cannot reach local, mapped, or reserved IP addresses", async () => {
  for (const address of ["127.0.0.1", "169.254.169.254", "10.0.0.1", "100.64.1.1", "192.168.1.1", "198.19.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "64:ff9b::7f00:1", "2002:7f00:1::"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("93.184.215.14"), true);
  for (const url of ["http://127.0.0.1", "http://2130706433", "http://[::1]", "http://[::ffff:127.0.0.1]", "file:///etc/passwd"]) await assert.rejects(readPublicArticle(url), /public/);
});
