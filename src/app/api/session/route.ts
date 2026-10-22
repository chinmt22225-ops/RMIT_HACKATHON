import { withAuth } from "@/lib/auth/protect";

// A successful browser callback is not proof of an accepted app session. Verify
// the real Tide signature and the request's DPoP proof before confirming it.
export const GET = withAuth(async (_request, identity) => Response.json({ subject: identity.sub }));
