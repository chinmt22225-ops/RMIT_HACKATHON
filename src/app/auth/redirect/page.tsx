"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMarginAuth } from "@/app/providers";

export default function AuthRedirectPage() {
  const { ready, authenticated } = useMarginAuth();
  const router = useRouter();

  // The root Tide provider processes the authorization code. Wait for that single
  // exchange, then navigate without reloading the provider or dropping its session.
  useEffect(() => {
    if (!ready) return;
    if (authenticated || sessionStorage.getItem("margin-signing-out") === "yes") {
      sessionStorage.removeItem("margin-signing-out");
      router.replace("/");
    }
  }, [ready, authenticated, router]);

  return <main className="auth-screen"><section className="auth-card">
    <h1>{!ready || authenticated ? "Completing your sign-in…" : "Sign-in wasn’t completed."}</h1>
    <p>{!ready || authenticated ? "Your finding will be waiting in your workspace." : "You can try again from the workspace or continue exploring as a guest."}</p>
    <a className="button button-light" href="/">Return to Margin</a>
  </section></main>;
}
