import { database } from "../storage";
import { withRole, type Identity } from "./protect";

/** Guest reading tools are intentional; private knowledge routes always use withRole. */
export function withPublicTool(handler: (request: Request, identity: Identity | null) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    // An invalid presented credential must never fall back to an anonymous request.
    if (request.headers.has("authorization")) return withRole("assistant:use", handler)(request);
    const host = request.headers.get("host");
    const app = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
    if (![app.host, `127.0.0.1:${app.port || "3000"}`].includes(host || "")) return Response.json({ error: "Invalid host." }, { status: 400 });
    const origin = request.headers.get("origin");
    const extension = !!origin && (/^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^moz-extension:\/\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(origin));
    if (origin && origin !== app.origin && !extension && origin !== `http://127.0.0.1:${app.port || "3000"}`) return Response.json({ error: "Origin is not allowed." }, { status: 403 });
    const db = database(); const now = Date.now();
    // This local deployment listens only on loopback. A public deployment needs a trusted
    // client-address source and shared limits per visitor, rather than trusting forwarded headers.
    db.prepare("DELETE FROM rate_windows WHERE expires < ?").run(now);
    const row = db.prepare("INSERT INTO rate_windows VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count").get(`guest:${Math.floor(now / 60000)}`, now + 60000) as { count: number };
    if (row.count > 30) return Response.json({ error: "The guest workspace is busy. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
    const response = await handler(request, null);
    response.headers.set("Cache-Control", "no-store");
    if (extension && origin) { response.headers.set("Access-Control-Allow-Origin", origin); response.headers.set("Vary", "Origin"); }
    return response;
  };
}
