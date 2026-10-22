import { z } from "zod";
import { withRole } from "@/lib/auth/protect";
import { body, failure } from "@/lib/http";
import { getProfile, saveProfile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withRole("appUser", async (_request, identity) => Response.json(getProfile(identity.sub)));
export const POST = withRole("appUser", async (request, identity) => {
  try {
    const { displayName } = await body(request, z.object({ displayName: z.string().trim().max(60) }).strict());
    return Response.json(saveProfile(identity.sub, displayName));
  } catch (error) { return failure(error); }
});
