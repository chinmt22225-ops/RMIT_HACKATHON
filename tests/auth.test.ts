import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, generateKeyPair, exportJWK, calculateJwkThumbprint, type JWK } from "jose";
import { withRole } from "../src/lib/auth/protect";
import { withPublicTool } from "../src/lib/auth/publicTools";

// Locally generated fixture keys test the verifier. They are not Tide realm keys or a login bypass.
const directory = mkdtempSync(join(tmpdir(), "margin-auth-test-"));
process.env.MARGIN_DATA_DIR = directory;
process.env.APP_ORIGIN = "http://localhost:3000";
let realmKey: CryptoKey, proofKey: CryptoKey, proofJwk: JWK, jkt: string;
before(async () => {
  const realm = await generateKeyPair("EdDSA");
  const proof = await generateKeyPair("ES256");
  realmKey = realm.privateKey; proofKey = proof.privateKey;
  proofJwk = await exportJWK(proof.publicKey); jkt = await calculateJwkThumbprint(proofJwk);
  process.env.CLIENT_ADAPTER = JSON.stringify({ realm: "unit-test", resource: "margin-client", "auth-server-url": "http://localhost:8080", jwk: { keys: [{ ...await exportJWK(realm.publicKey), kid: "unit-test" }] }, vendorId: "test-only", homeOrkUrl: "https://invalid.example" });
});
after(() => rmSync(directory, { recursive: true, force: true }));

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ sub: "alice", iss: "http://localhost:8080/realms/unit-test", aud: "margin-client", azp: "margin-client", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, cnf: { jkt }, realm_access: { roles: ["library:read"] }, ...overrides })
    .setProtectedHeader({ alg: "EdDSA", kid: "unit-test" }).sign(realmKey);
}
async function request(accessToken: string, overrides: Record<string, unknown> = {}, extraHeaders: Record<string, string> = {}) {
  const proof = await new SignJWT({ jti: randomUUID(), htm: "GET", htu: "http://localhost:3000/api/library", iat: Math.floor(Date.now() / 1000), ath: createHash("sha256").update(accessToken).digest("base64url"), ...overrides })
    .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: proofJwk }).sign(proofKey);
  return new Request("http://localhost:3000/api/library", { headers: { host: "localhost:3000", authorization: `DPoP ${accessToken}`, dpop: proof, ...extraHeaders } });
}
const handler = withRole("library:read", async (_request, identity) => Response.json({ user: identity.sub }));

test("valid signature, client, role, and proof are all required", async () => {
  const access = await token();
  const response = await handler(await request(access));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { user: "alice" });
  assert.equal((await handler(new Request("http://localhost:3000/api/library", { headers: { host: "localhost:3000" } }))).status, 401);
  assert.equal((await handler(await request(access, {}, { authorization: `Bearer ${access}` }))).status, 401);
});
test("a DPoP proof cannot be replayed, redirected, or used with another method", async () => {
  const access = await token(); const original = await request(access);
  assert.equal((await handler(original.clone())).status, 200);
  assert.equal((await handler(original.clone())).status, 401);
  assert.equal((await handler(await request(access, { htu: "http://localhost:3000/api/collections" }))).status, 401);
  assert.equal((await handler(await request(access, { htm: "POST" }))).status, 401);
  assert.equal((await handler(await request(access, { htu: "https://attacker.example/api/library" }, { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" }))).status, 401);
});
test("expired tokens, wrong audience, and another client's roles are rejected", async () => {
  assert.equal((await handler(await request(await token({ exp: 1 })))).status, 401);
  assert.equal((await handler(await request(await token({ aud: "another-client" })))).status, 401);
  const wrongRole = await token({ realm_access: { roles: [] }, resource_access: { "another-client": { roles: ["library:read"] } } });
  assert.equal((await handler(await request(wrongRole))).status, 403);
});
test("requests from another web origin are refused", async () => {
  assert.equal((await handler(await request(await token(), {}, { origin: "https://unrelated.example" }))).status, 403);
});

test("guest tools are available, but a bad token never becomes a guest request", async () => {
  const publicTool = withPublicTool(async (_request, identity) => Response.json({ guest: !identity }));
  const anonymous = new Request("http://localhost:3000/api/assist", { headers: { host: "localhost:3000" } });
  assert.deepEqual(await (await publicTool(anonymous)).json(), { guest: true });
  assert.equal((await publicTool(new Request(anonymous, { headers: { host: "localhost:3000", authorization: "Bearer invalid" } }))).status, 401);
  assert.equal((await publicTool(new Request(anonymous, { headers: { host: "localhost:3000", origin: "https://unrelated.example" } }))).status, 403);
});
