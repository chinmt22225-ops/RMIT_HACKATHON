"use client";
import { useMarginAuth } from "@/app/providers";
import { useEffect } from "react";

type BridgeRequest = { path: string; method?: string; data?: unknown };
declare global { interface Window { marginBridge?: { authenticated: boolean; request(input: BridgeRequest): Promise<{ status: number; body: string; contentType: string }> } } }
export default function AuthBridge({ children }: { children: React.ReactNode }) {
  const { authenticated, secureFetch } = useMarginAuth();
  useEffect(() => {
    window.marginBridge = { authenticated, async request(input) {
      if (!["/api/assist", "/api/library", "/api/collections", "/api/status"].includes(input.path) || !["GET", "POST", "PATCH", "DELETE"].includes(input.method || "GET")) throw new Error("Unsupported extension action.");
      const encoded = input.data === undefined ? undefined : JSON.stringify(input.data);
      if (encoded && encoded.length > 100000) throw new Error("Request is too large.");
      const response = await secureFetch(window.location.origin + input.path, { method: input.method || "GET", ...(encoded ? { headers: { "Content-Type": "application/json" }, body: encoded } : {}) });
      return { status: response.status, body: await response.text(), contentType: response.headers.get("content-type") || "application/json" };
    } };
    return () => { delete window.marginBridge; };
  }, [authenticated, secureFetch]);
  return <>{children}</>;
}
