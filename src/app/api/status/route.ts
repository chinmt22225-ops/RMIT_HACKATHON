export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = await fetch(`${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const model = process.env.OLLAMA_MODEL || "qwen3-vl:2b-instruct";
    return Response.json({ available: data.models?.some((m: { name: string }) => m.name === model) || false, model, engine: "Ollama" });
  } catch { return Response.json({ available: false, model: process.env.OLLAMA_MODEL || "qwen3-vl:2b-instruct", engine: "Ollama" }); }
}
