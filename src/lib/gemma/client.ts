import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// ---------------------------------------------------------------------------
// Lazy singleton client
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      );
    }
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
export const FALLBACK_MODEL = "gemma-4-31b-it";


// Default per-call limit. generatePuzzle passes its own. The SDK sends it to Google as the request deadline, so a
// call that runs past it comes back as 504 DEADLINE_EXCEEDED.
export const CALL_TIMEOUT_MS = 150_000;

// ---------------------------------------------------------------------------
// callGemma — thin wrapper around the SDK
// ---------------------------------------------------------------------------

export interface CallGemmaOptions {
  model?: string;
  systemInstruction: string;
  userPrompt: string;
  // null sends no thinking config, so the model uses its default.
  // gemma-4-31b-it rejects MINIMAL with a 500 INTERNAL.
  thinkingLevel?: ThinkingLevel | null;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Call a Gemma model via the Gemini Developer API.
 * Returns the raw text of the first candidate.
 */
export async function callGemma(opts: CallGemmaOptions): Promise<string> {
  return withRetry(() => callOnce(opts));
}

// One retry for Google-side hiccups (500 INTERNAL, 503). Errors come out
// with readable messages for network failures and rate limits.
export async function withRetry<T>(fn: () => Promise<T>, delayMs = RETRY_DELAY_MS): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTransient(e)) throw describeQuotaError(describeNetworkError(e));
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      return await fn();
    } catch (again) {
      throw describeQuotaError(describeNetworkError(again));
    }
  }
}

const RETRY_DELAY_MS = 2_000;

// 429 is not retried: Google asks for a ~1 minute wait, and retrying sooner
// only spends more of the per-minute quota.
function isTransient(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return status === 500 || status === 503;
}

async function callOnce(opts: CallGemmaOptions): Promise<string> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: opts.model ?? DEFAULT_MODEL,
    contents: opts.userPrompt,
    config: {
      systemInstruction: opts.systemInstruction,
      httpOptions: { timeout: opts.timeoutMs ?? CALL_TIMEOUT_MS },
      temperature: opts.temperature ?? 0.4,
      ...(opts.thinkingLevel === null
        ? {}
        : { thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? ThinkingLevel.HIGH } }),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemma returned an empty response.");
  }
  return text;
}

// Node's fetch reports every network failure as "fetch failed" and hides the
// reason in `cause`. Surface it, so DNS, firewall, proxy, and TLS problems
// can be told apart from API errors.
function describeNetworkError(e: unknown): unknown {
  if (!(e instanceof Error) || e.message !== "fetch failed") return e;
  const cause = e.cause as { code?: string; message?: string } | undefined;
  const detail = [cause?.code, cause?.message].filter(Boolean).join(": ") || "no further detail";
  return new Error(`Could not reach the Gemini API at generativelanguage.googleapis.com (${detail}).`, { cause: e });
}

// The raw 429 body is a page of JSON. Keep the part a person needs.
function describeQuotaError(e: unknown): unknown {
  if ((e as { status?: unknown } | null)?.status !== 429) return e;
  const retry = /retry in ([\d.]+)s/i.exec(e instanceof Error ? e.message : "")?.[1];
  const wait = retry ? `about ${Math.ceil(Number(retry))} seconds` : "about a minute";
  return Object.assign(new Error(`Gemma's free-tier rate limit was reached. Try again in ${wait}.`, { cause: e }), { status: 429 });
}
