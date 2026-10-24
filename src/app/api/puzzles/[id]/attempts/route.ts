import { getDeps } from "@/lib/server/deps";
import { userFrom } from "@/lib/server/auth";
import { json, readJson, respond } from "@/lib/server/http";
import { submitAttempt } from "@/lib/server/service";

// Body { "approach": "brute" | "optimized", "workspace": { "blocks": [...] } }.
// Runs the workspace against the hidden tests. Saved only for a signed-in user.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const deps = getDeps();
    const { id } = await ctx.params;
    const user = await userFrom(request, deps.verifier);
    return json(await submitAttempt(deps, id, await readJson(request), user));
  });
}
