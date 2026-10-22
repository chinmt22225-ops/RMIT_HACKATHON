import { withRole } from "@/lib/auth/protect";
import { z } from "zod";
import { body, failure, extensionHeaders } from "@/lib/http";
import { getCollections, createCollection, deleteCollection } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withRole("library:read", async (_request, identity) => Response.json({ collections: getCollections(identity.sub) }, { headers: extensionHeaders }));
export const POST = withRole("library:write", async (request, identity) => {
  try { const { name } = await body(request, z.object({ name: z.string().trim().min(1).max(80) })); return Response.json({ collection: createCollection(identity.sub, name) }, { status: 201 }); }
  catch (error) { return failure(error); }
});
export const DELETE = withRole("library:write", async (request, identity) => {
  try { const { id } = await body(request, z.object({ id: z.uuid() })); return Response.json({ deleted: deleteCollection(identity.sub, id) }); }
  catch (error) { return failure(error); }
});
