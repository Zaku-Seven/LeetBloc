import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { userFrom } from "@/lib/server/auth";
import { json, respond } from "@/lib/server/http";
import { getPuzzleView } from "@/lib/server/service";

// ?approach=brute (default) or ?approach=optimized selects the round's tray.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  // Opt out of build-time prerendering before touching env or the database.
  await connection();
  return respond(async () => {
    const deps = getDeps();
    const { id } = await ctx.params;
    const user = await userFrom(request, deps.verifier);
    const approach = new URL(request.url).searchParams.get("approach");
    const { status, body } = await getPuzzleView(deps, id, approach, user);
    return json(body, status);
  });
}
