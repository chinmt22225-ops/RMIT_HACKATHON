import { withPublicTool } from "@/lib/auth/publicTools";
import { readPublicArticle } from "@/lib/publicArticle";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { body, failure } from "@/lib/http";
export const runtime = "nodejs";

export const POST = withPublicTool(async (request) => {
  try {
    const input = await body(request, z.object({ url: z.url().max(3000) }));
    const { url, html } = await readPublicArticle(input.url);
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const extracted = article?.content ? parseHTML(`<html><body>${article.content}</body></html>`).document : null;
    const paragraphs = extracted ? Array.from(extracted.querySelectorAll("p, h1, h2, h3, li, pre")).map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean) : [];
    const text = (paragraphs.length ? paragraphs.join("\n\n") : article?.textContent)?.trim();
    if (!text || text.length < 50) throw new Error("This page needs a browser to display its text. Use the extension or paste the passage.");
    return Response.json({ reading: { title: article?.title || document.title || url.hostname, subtitle: url.hostname, text: text.slice(0, 180_000), url: url.toString(), kind: "Web article" } });
  } catch (error) { return failure(error); }
});
