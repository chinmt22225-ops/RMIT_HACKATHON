import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Margin — follow your curiosity", description: "Understand what you read. Explore unfamiliar ideas, investigate sources, and keep the discoveries that matter." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
