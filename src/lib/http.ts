import { z } from "zod";
export const selectionSchema = z.object({ text: z.string().trim().min(1).max(12000), context: z.string().max(16000).default(""), title: z.string().max(500).default("Untitled"), url: z.string().max(3000).default("") });
export const sourceSchema = z.object({ title: z.string().max(1000), url: z.url().refine((s) => /^https?:\/\//.test(s)), excerpt: z.string().max(5000), kind: z.enum(["reference", "paper", "preprint", "official", "academic", "government"]), year: z.number().optional(), publisher: z.string().max(500).optional(), evidence: z.enum(["excerpt", "abstract", "metadata"]).optional() });
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (Number(request.headers.get("content-length")) > 150_000) throw new Error("Request is too large.");
  if (!request.body) throw new Error("A JSON request body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  const timer = setTimeout(() => reader.cancel().catch(() => {}), 15_000);
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 150_000) throw new Error("Request is too large.");
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return schema.parse(JSON.parse(text));
}
export function failure(error: unknown) {
  return Response.json({ error: error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : "Request failed." }, { status: 400 });
}
export const extensionHeaders = { "Cache-Control": "no-store" };
