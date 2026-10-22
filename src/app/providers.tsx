"use client";

import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { TidecloakConfig } from "@/lib/auth/tidecloakConfig";

type Auth = {
  authenticated: boolean;
  ready: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  secureFetch: typeof fetch;
  getValueFromToken: (key: string) => unknown;
};
const guest: Auth = {
  authenticated: false, ready: false,
  login: async () => { throw new Error("Tide sign-in is getting ready. You can keep exploring as a guest."); },
  logout: async () => {}, secureFetch: (...args) => fetch(...args), getValueFromToken: () => null,
};
const AuthContext = createContext<Auth>(guest);
export const useMarginAuth = () => useContext(AuthContext);

function TideConnector({ update }: { update: (auth: Auth) => void }) {
  const auth = useTideCloak();
  const latest = useRef(auth); latest.current = auth;
  useEffect(() => {
    update({
      authenticated: auth.authenticated, ready: !auth.isInitializing,
      login: async () => {
        if (latest.current.isInitializing) return guest.login();
        await latest.current.login();
      },
      logout: async () => {
        sessionStorage.setItem("margin-signing-out", "yes");
        try { await latest.current.logout(); }
        catch (error) { sessionStorage.removeItem("margin-signing-out"); throw error; }
      },
      secureFetch: (...args) => latest.current.authenticated ? latest.current.secureFetch(...args) : guest.secureFetch(...args),
      getValueFromToken: key => latest.current.getValueFromToken(key),
    });
  }, [auth.authenticated, auth.isInitializing, auth.token, update]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => { document.dispatchEvent(new Event("margin-hydrated")); }, []);
  const [config, setConfig] = useState<TidecloakConfig | null>(null);
  const [auth, setAuth] = useState<Auth>(guest);
  const sdkConfig = useMemo(() => config ? { ...config, useDPoP: { mode: "strict" as const, alg: "ES256" as const } } : null, [config]);
  useEffect(() => {
    if (config) return;
    let alive = true;
    async function load() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) return;
        const value = await response.json();
        if (alive) setConfig(value);
      } catch {}
    }
    load(); const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [config]);

  // Keep the workspace mounted when Tide becomes ready. A guest's reading and
  // current answer must survive both adapter setup and authentication changes.
  return <AuthContext.Provider value={auth}>
    {children}
    {sdkConfig && <TideCloakProvider config={sdkConfig}><TideConnector update={setAuth} /></TideCloakProvider>}
  </AuthContext.Provider>;
}
