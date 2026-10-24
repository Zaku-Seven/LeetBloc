import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./service";

export interface Verifier {
  // The user id for a valid session token, or null.
  verify(token: string): Promise<string | null>;
}

// Verifies Supabase session tokens. With asymmetric signing keys this checks
// the signature locally against the project's published keys.
export function supabaseVerifier(client: SupabaseClient): Verifier {
  return {
    async verify(token) {
      const { data, error } = await client.auth.getClaims(token);
      if (error || !data) return null;
      const { sub, role } = data.claims;
      return typeof sub === "string" && role === "authenticated" ? sub : null;
    },
  };
}

// No Authorization header: a visitor. A header with a bad token: 401, so a
// signed-in learner whose session expired is told instead of silently not saved.
export async function userFrom(request: Request, verifier: Verifier): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  const user = m ? await verifier.verify(m[1]!) : null;
  if (!user) throw new ApiError(401, "Your session has expired. Sign in again.");
  return user;
}

export async function requireUser(request: Request, verifier: Verifier): Promise<string> {
  const user = await userFrom(request, verifier);
  if (!user) throw new ApiError(401, "Sign in to see your progress.");
  return user;
}
