import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JSONWebKeySet } from "jose";
export interface TidecloakConfig { realm: string; "auth-server-url": string; resource: string; jwk: JSONWebKeySet; vendorId: string; homeOrkUrl: string; "public-client": boolean; "ssl-required": string; "confidential-port": number; logoUrl?: string; backgroundUrl?: string; [key: `client-origin-auth-${string}`]: string }
export class ConfigurationError extends Error {}
export function loadTideConfig(): TidecloakConfig {
  try {
    const config = JSON.parse(process.env.CLIENT_ADAPTER || readFileSync(join(process.cwd(), "data", "tidecloak.json"), "utf8"));
    if (!config.realm || !config.resource || !config["auth-server-url"] || !config.jwk?.keys?.length || !config.vendorId || !config.homeOrkUrl) throw new Error("Incomplete adapter");
    const url = new URL(config["auth-server-url"]);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("HTTPS required");
    if (config.credentials || config.jwk.keys.some((key: Record<string, unknown>) => key.d || key.k)) throw new Error("Private credentials in public adapter");
    return config;
  } catch { throw new ConfigurationError("TideCloak enrollment is not complete."); }
}
export function publicTideConfig(config: TidecloakConfig) {
  const origin = new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;
  const originKey = `client-origin-auth-${origin}` as const;
  // The enclave needs the exported, signed authorization for this app's origin.
  // It is public verification material, like the JWK, and must stay byte-exact.
  return { realm: config.realm, resource: config.resource, "auth-server-url": config["auth-server-url"], "ssl-required": config["ssl-required"], "public-client": true, "confidential-port": 0, jwk: config.jwk, vendorId: config.vendorId, homeOrkUrl: config.homeOrkUrl,
    ...(config[originKey] ? { [originKey]: config[originKey] } : {}),
  };
}
