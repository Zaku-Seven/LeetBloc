import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { json, respond } from "@/lib/server/http";

export async function GET() {
  await connection();
  return respond(async () => {
    await getDeps().store.ping();
    return json({ ok: true });
  });
}
