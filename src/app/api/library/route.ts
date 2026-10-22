import { withRole } from "@/lib/auth/protect";
import { z } from "zod";
import { body, extensionHeaders, failure, selectionSchema, sourceSchema } from "@/lib/http";
import { getInsights, saveInsight, editInsight, deleteInsight } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() { return new Response(null, { status: 204, headers: extensionHeaders }); }
export const GET = withRole("library:read", async (_request, identity) => Response.json({ insights: getInsights(identity.sub) }, { headers: extensionHeaders }));
export const POST = withRole("library:write", async (request, identity) => {
  try {
    const input = await body(request, z.object({ selection: selectionSchema, action: z.enum(["explain", "research", "translate", "simplify", "examples", "ask"]), answer: z.string().max(50000), language: z.enum(["Vietnamese", "English", "Spanish", "Korean", "Japanese", "French", "German", "Chinese"]).optional(), sources: z.array(sourceSchema).max(20), collectionId: z.uuid().nullable().default(null), note: z.string().max(10000).default(""), provider: z.string().max(200).default("") }));
    return Response.json({ insight: saveInsight(identity.sub, input) }, { status: 201, headers: extensionHeaders });
  } catch (error) { return failure(error); }
});
export const PATCH = withRole("library:write", async (request, identity) => {
  try { const { id, ...update } = await body(request, z.object({ id: z.uuid(), note: z.string().max(10000), collectionId: z.uuid().nullable() }));
    const insight = editInsight(identity.sub, id, update);
    return Response.json(insight ? { insight } : { error: "Finding not found." }, { status: insight ? 200 : 404, headers: extensionHeaders });
  } catch (error) { return failure(error); }
});
export const DELETE = withRole("library:write", async (request, identity) => {
  try { const { id } = await body(request, z.object({ id: z.uuid() })); return Response.json({ deleted: deleteInsight(identity.sub, id) }, { headers: extensionHeaders }); }
  catch (error) { return failure(error); }
});
