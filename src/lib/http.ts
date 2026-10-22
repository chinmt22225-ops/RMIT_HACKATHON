import { z } from "zod";
export const selectionSchema = z.object({ text: z.string().trim().min(1).max(12000), context: z.string().max(16000).default(""), title: z.string().max(500).default("Untitled"), url: z.string().max(3000).default("") });
export const sourceSchema = z.object({ title: z.string().max(1000), url: z.url().refine((s) => /^https?:\/\//.test(s)), excerpt: z.string().max(5000), kind: z.enum(["reference", "paper", "official"]), year: z.number().optional() });
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (Number(request.headers.get("content-length")) > 150_000) throw new Error("Request is too large.");
  const text = await request.text();
  if (text.length > 150_000) throw new Error("Request is too large.");
  return schema.parse(JSON.parse(text));
}
export function failure(error: unknown) {
  return Response.json({ error: error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : "Request failed." }, { status: 400 });
}
export const extensionHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" };
