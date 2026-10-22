import { createHash } from "node:crypto";
import type { JWTPayload } from "jose";
import { ConfigurationError } from "./tidecloakConfig";
import { extractToken, hasRole, verifyTideJWT } from "./tideJWT";
import { verifyDpop } from "./verifyDpop";
import { database } from "../storage";
export type Identity = JWTPayload & { sub: string };
type Handler = (request: Request, identity: Identity) => Promise<Response>;
const origin = () => new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;

export function withAuth(handler: Handler) {
  return async (request: Request): Promise<Response> => {
    const expectedOrigin = origin();
    if (request.headers.get("host") !== new URL(expectedOrigin).host) return Response.json({ error: "Invalid request host." }, { status: 400 });
    if (request.headers.has("origin") && request.headers.get("origin") !== expectedOrigin) return Response.json({ error: "Origin is not allowed." }, { status: 403 });
    let identity: JWTPayload;
    try {
      const token = extractToken(request.headers.get("authorization"));
      identity = await verifyTideJWT(token);
      if ((request.headers.get("dpop")?.length || 0) > 16384) throw new Error("Proof too large");
      await verifyDpop({ method: request.method, headers: request.headers, url: expectedOrigin + new URL(request.url).pathname }, token, identity as { cnf?: { jkt?: string } }, {
        trustForwardedHeaders: false,
        jtiStore: { async claim(id, expires) {
          if (id.length > 256) return false;
          const db = database();
          const key = createHash("sha256").update(`${(identity.cnf as { jkt: string }).jkt}:${id}`).digest("hex");
          db.prepare("DELETE FROM dpop_proofs WHERE expires < ?").run(Date.now());
          return db.prepare("INSERT OR IGNORE INTO dpop_proofs VALUES (?, ?)").run(key, expires).changes === 1;
        } },
      });
    } catch (error) {
      if (error instanceof ConfigurationError) return Response.json({ error: error.message }, { status: 503 });
      return Response.json({ error: "Sign in with Tide to continue." }, { status: 401, headers: { "WWW-Authenticate": 'DPoP realm="margin"', "Cache-Control": "no-store" } });
    }
    try {
      const db = database(); const now = Date.now();
      db.prepare("DELETE FROM rate_windows WHERE expires < ?").run(now);
      const rate = db.prepare("INSERT INTO rate_windows VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count")
        .get(`${identity.sub}:${Math.floor(now / 60000)}`, now + 60000) as { count: number };
      if (rate.count > 120) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
      const response = await handler(request, identity as Identity);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch { return Response.json({ error: "The request could not be completed." }, { status: 500 }); }
  };
}
export function withRole(role: string, handler: Handler) {
  return withAuth(async (request, identity) => hasRole(identity, role) ? handler(request, identity) : Response.json({ error: "This action is not permitted for your account." }, { status: 403 }));
}
