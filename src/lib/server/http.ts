import { ApiError } from "./service";

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be JSON.");
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// Runs a handler and turns errors into JSON responses.
export async function respond(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on our side." }, 500);
  }
}
