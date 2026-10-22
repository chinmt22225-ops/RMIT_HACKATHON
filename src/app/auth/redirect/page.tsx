"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMarginAuth } from "@/app/providers";

export default function AuthRedirectPage() {
  const { ready, authenticated, error, login } = useMarginAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [logoutReturn, setLogoutReturn] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const hasCallback = [params, fragment].some(values => values.has("code") || values.has("error") || values.has("state"));
    setLogoutReturn(!hasCallback && sessionStorage.getItem("margin-signing-out") === "yes");
    sessionStorage.removeItem("margin-signing-out");
    const timer = setTimeout(() => setTimedOut(true), 25000);
    return () => clearTimeout(timer);
  }, []);

  // The root Tide provider processes the authorization code. Wait for that single
  // exchange, then navigate without reloading the provider or dropping its session.
  useEffect(() => {
    if (!ready) return;
    if (authenticated || logoutReturn) {
      if (authenticated) sessionStorage.setItem("margin-sign-in-confirmed", "yes");
      router.replace("/");
    }
  }, [ready, authenticated, logoutReturn, router]);

  const failed = !!error || !!retryError || timedOut || (ready && !authenticated && !logoutReturn);

  return <main className="auth-screen"><section className="auth-card">
    <h1>{failed ? "Sign-in wasn’t completed." : "Verifying your Tide session…"}</h1>
    <p role={failed ? "alert" : "status"}>{error || retryError || (failed
      ? "Tide did not complete a verified sign-in. Try again and finish any Secure Session Verification window."
      : "Please keep this page open while Margin checks your account. Your finding will be waiting.")}</p>
    {failed && <div className="detail-actions">
      <button className="button button-primary" onClick={() => {
        setRetryError(null); setTimedOut(false);
        if (error || !ready) { window.location.reload(); return; }
        login().catch(error => setRetryError(error instanceof Error ? error.message : "Could not open Tide sign-in."));
      }}>Try Tide sign-in again</button>
      <a className="button button-light" href="/">Continue as a guest</a>
    </div>}
  </section></main>;
}
