import { z } from "zod";
import { body, failure, extensionHeaders } from "@/lib/http";
import { getCollections, createCollection, deleteCollection } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return Response.json({ collections: getCollections() }, { headers: extensionHeaders }); }
export async function POST(request: Request) {
  try { const { name } = await body(request, z.object({ name: z.string().trim().min(1).max(80) })); return Response.json({ collection: createCollection(name) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try { const { id } = await body(request, z.object({ id: z.uuid() })); return Response.json({ deleted: deleteCollection(id) }); }
  catch (error) { return failure(error); }
}
