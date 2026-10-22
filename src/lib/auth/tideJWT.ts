import { jwtVerify, createLocalJWKSet, type JWTPayload } from "jose";
import { loadTideConfig } from "./tidecloakConfig";
let cached: { raw: string; keys: ReturnType<typeof createLocalJWKSet> } | undefined;
export async function verifyTideJWT(token: string): Promise<JWTPayload> {
  const config = loadTideConfig(); const raw = JSON.stringify(config.jwk);
  if (cached?.raw !== raw) cached = { raw, keys: createLocalJWKSet(config.jwk) };
  const { payload } = await jwtVerify(token, cached.keys, {
    issuer: `${config["auth-server-url"].replace(/\/+$/, "")}/realms/${config.realm}`,
    audience: config.resource, algorithms: ["EdDSA"], requiredClaims: ["sub", "exp", "iat", "azp", "aud"],
  });
  if (payload.azp !== config.resource) throw new Error("Wrong authorized party");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255) throw new Error("Invalid subject");
  if (typeof payload.iat !== "number" || payload.iat > Date.now() / 1000 + 60) throw new Error("Invalid issued-at time");
  return payload;
}
export function hasRole(payload: JWTPayload, role: string): boolean {
  const realm = payload.realm_access as { roles?: unknown } | undefined;
  if (Array.isArray(realm?.roles) && realm.roles.includes(role)) return true;
  const access = payload.resource_access as Record<string, { roles?: unknown }> | undefined;
  if (!access) return false;
  const roles = access?.[loadTideConfig().resource]?.roles;
  return Array.isArray(roles) && roles.includes(role);
}
export function extractToken(header: string | null): string {
  const match = header?.match(/^DPoP ([A-Za-z0-9_.-]+)$/i);
  if (!match || match[1].length > 16384) throw new Error("A DPoP access token is required");
  return match[1];
}
