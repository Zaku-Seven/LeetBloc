import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { requireUser } from "@/lib/server/auth";
import { json, respond } from "@/lib/server/http";
import { listProgress } from "@/lib/server/service";

export async function GET(request: Request) {
  // Opt out of build-time prerendering before touching env or the database.
  await connection();
  return respond(async () => {
    const deps = getDeps();
    const user = await requireUser(request, deps.verifier);
    return json(await listProgress(deps, user));
  });
}
