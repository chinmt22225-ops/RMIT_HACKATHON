"use client";

import { TideCloakContextProvider, useTideCloak } from "@tidecloak/nextjs";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { TidecloakConfig } from "@/lib/auth/tidecloakConfig";

type Auth = {
  authenticated: boolean;
  ready: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  secureFetch: typeof fetch;
  getValueFromToken: (key: string) => unknown;
};
const guest: Auth = {
  authenticated: false, ready: false, error: null,
  login: async () => { throw new Error("Tide sign-in is getting ready. You can keep exploring as a guest."); },
  logout: async () => {}, secureFetch: (...args) => fetch(...args), getValueFromToken: () => null,
};
const AuthContext = createContext<Auth>(guest);
export const useMarginAuth = () => useContext(AuthContext);

function TideConnector({ update }: { update: (auth: Auth) => void }) {
  const auth = useTideCloak();
  const latest = useRef(auth); latest.current = auth;
  const [verifiedSubject, setVerifiedSubject] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const subject = auth.authenticated ? String(auth.getValueFromToken("sub") || "") : "";

  useEffect(() => {
    let active = true;
    if (!auth.authenticated || !subject) {
      setVerifiedSubject(null); setChecking(false);
      return;
    }
    setChecking(true); setVerificationError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    latest.current.secureFetch(`${window.location.origin}/api/session`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401
          ? "Tide returned a session, but Margin could not verify it. Please sign in again."
          : "Margin could not check your Tide session. Please try again.");
        const session = await response.json();
        if (session.subject !== subject) throw new Error("The Tide account could not be verified. Please sign in again.");
        if (active) setVerifiedSubject(subject);
      })
      .catch(error => {
        if (!active) return;
        setVerifiedSubject(null);
        setVerificationError(error?.name === "AbortError"
          ? "Checking your Tide session timed out. Please try signing in again."
          : error instanceof Error ? error.message : "Your Tide session could not be verified.");
      })
      .finally(() => { clearTimeout(timer); if (active) setChecking(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [auth.authenticated, auth.token, subject]);

  useEffect(() => {
    const authenticated = auth.authenticated && !!subject && verifiedSubject === subject;
    update({
      authenticated,
      ready: !auth.isInitializing && (!auth.authenticated || authenticated || !!verificationError) && !checking,
      error: auth.initError ? "Tide sign-in could not initialize. Reload Margin and try again." : verificationError,
      login: async () => {
        if (latest.current.isInitializing) return guest.login();
        // A failed logout must not make a later login callback look like logout.
        sessionStorage.removeItem("margin-signing-out");
        setVerificationError(null);
        await latest.current.login();
      },
      logout: async () => {
        sessionStorage.setItem("margin-signing-out", "yes");
        // The SDK shares one redirectUri setting for login and logout. The realm
        // already permits the app origin for logout; keep login's /auth/redirect.
        // doLogout captures this value before it flushes the browser's DPoP key.
        const config = latest.current.getConfig();
        const previousRedirect = config.redirectUri;
        try {
          config.redirectUri = window.location.origin;
          await latest.current.logout();
        } catch (error) { sessionStorage.removeItem("margin-signing-out"); throw error; }
        finally {
          if (previousRedirect === undefined) delete config.redirectUri;
          else config.redirectUri = previousRedirect;
        }
      },
      secureFetch: (...args) => latest.current.authenticated ? latest.current.secureFetch(...args) : guest.secureFetch(...args),
      getValueFromToken: key => latest.current.getValueFromToken(key),
    });
  }, [auth.authenticated, auth.isInitializing, auth.initError, auth.token, subject, verifiedSubject, checking, verificationError, update]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => { document.dispatchEvent(new Event("margin-hydrated")); }, []);
  const [config, setConfig] = useState<TidecloakConfig | null>(null);
  const [auth, setAuth] = useState<Auth>(guest);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const sdkConfig = useMemo(() => config ? { ...config, useDPoP: { mode: "strict" as const, alg: "ES256" as const } } : null, [config]);
  useEffect(() => {
    if (config) return;
    let alive = true;
    async function load() {
      try {
        const response = await fetch("/api/config", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Tide sign-in is temporarily unavailable. You can keep exploring as a guest.");
        const value = await response.json();
        if (alive) { setConfig(value); setConfigError(null); }
      } catch { if (alive) setConfigError("Tide sign-in is temporarily unavailable. You can keep exploring as a guest."); }
    }
    load(); const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [config]);

  // Keep the workspace mounted when Tide becomes ready. A guest's reading and
  // current answer must survive both adapter setup and authentication changes.
  const effectiveError = configError || loginError || auth.error;
  return <AuthContext.Provider value={{ ...auth, error: effectiveError,
    login: async () => {
      if (configError) throw new Error(configError);
      setLoginError(null);
      await auth.login();
    },
  }}>
    {children}
    {sdkConfig && <TideCloakContextProvider config={sdkConfig}
      onAuthError={() => setLoginError("Tide sign-in did not finish. Please try again and complete any verification window.")}
      onAuthSuccess={() => setLoginError(null)}>
      <TideConnector update={setAuth} />
    </TideCloakContextProvider>}
  </AuthContext.Provider>;
}
