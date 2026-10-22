import { withPublicTool } from "@/lib/auth/publicTools";
import { z } from "zod";
import { body, failure, selectionSchema, extensionHeaders } from "@/lib/http";
import { searchSources } from "@/lib/sources";
import { generateAnswer } from "@/lib/assistant";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const capacity = globalThis as typeof globalThis & { marginActiveAnswers?: number };
const inputSchema = z.object({
  selection: selectionSchema, action: z.enum(["explain", "research", "translate", "simplify", "examples", "ask"]),
  language: z.enum(["Vietnamese", "English", "Spanish", "Korean", "Japanese", "French", "German", "Chinese"]).default("Vietnamese"),
  question: z.string().max(2000).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) })).max(6).optional(),
});
export function OPTIONS() { return new Response(null, { status: 204, headers: extensionHeaders }); }
export const POST = withPublicTool(async (request) => {
  try {
    const input = await body(request, inputSchema);
    if ((capacity.marginActiveAnswers || 0) >= 2) return Response.json({ error: "The local assistant is working on two questions. Try again shortly." }, { status: 429, headers: { "Retry-After": "10" } });
    capacity.marginActiveAnswers = (capacity.marginActiveAnswers || 0) + 1;
    const encoder = new TextEncoder();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    if (request.signal.aborted) controller.abort();
    const stream = new ReadableStream({
      async start(output) {
        let closed = false;
        const send = (data: unknown) => { if (!closed && !controller.signal.aborted) output.enqueue(encoder.encode(JSON.stringify(data) + "\n")); };
        try {
          send({ type: "status", message: input.action === "translate" ? "Translating with your local model…" : "Finding context and sources…" });
          const result = ["explain", "research", "examples", "ask"].includes(input.action)
            ? await searchSources(input.selection.text, input.selection.context, input.action === "research")
            : { sources: [], notices: [] };
          send({ type: "sources", ...result, provider: `Ollama · ${process.env.OLLAMA_MODEL || "qwen3-vl:2b-instruct"}` });
          send({ type: "status", message: "Connecting the ideas…" });
          for await (const text of generateAnswer({ ...input, sources: result.sources, signal: controller.signal })) send({ type: "delta", text });
          send({ type: "done" });
        } catch (error) { if (!controller.signal.aborted) send({ type: "error", message: error instanceof Error ? error.message : "Could not complete this request." }); }
        finally { closed = true; capacity.marginActiveAnswers = Math.max(0, (capacity.marginActiveAnswers || 1) - 1); request.signal.removeEventListener("abort", onAbort); try { output.close(); } catch {} }
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { ...extensionHeaders, "Content-Type": "application/x-ndjson", "X-Accel-Buffering": "no" } });
  } catch (error) { return failure(error); }
});
