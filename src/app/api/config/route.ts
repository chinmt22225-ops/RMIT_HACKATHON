import { loadTideConfig, publicTideConfig } from "@/lib/auth/tidecloakConfig";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(publicTideConfig(loadTideConfig()), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "TideCloak enrollment is in progress." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
