import { getDeps } from "@/lib/server/deps";
import { userFrom } from "@/lib/server/auth";
import { json, readJson, respond } from "@/lib/server/http";
import { openPuzzle } from "@/lib/server/service";

// The first request for a new problem waits on Gemma, including one repair
// call. Keep this below STALE_PENDING_MS in service.ts.
export const maxDuration = 300;

// Body { "url": "https://leetcode.com/problems/two-sum/" }. 200 with the
// brute-force round's view, or 202 while the puzzle is still being generated.
export async function POST(request: Request) {
  return respond(async () => {
    const deps = getDeps();
    const user = await userFrom(request, deps.verifier);
    const { status, body } = await openPuzzle(deps, await readJson(request), user);
    return json(body, status);
  });
}
