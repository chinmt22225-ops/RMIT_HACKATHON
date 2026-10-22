import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { hydrationGuard } from "@/lib/hydrationGuard";
export const metadata: Metadata = { title: "Margin — follow your curiosity", description: "Understand what you read. Explore unfamiliar ideas, investigate sources, and keep the discoveries that matter." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><script id="margin-hydration-guard" dangerouslySetInnerHTML={{ __html: hydrationGuard }} /></head><body><Providers>{children}</Providers></body></html>; }
