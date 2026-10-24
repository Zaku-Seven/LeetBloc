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

// ---------------------------------------------------------------------------
// callGemma — thin wrapper around the SDK
// ---------------------------------------------------------------------------

export interface CallGemmaOptions {
  model?: string;
  systemInstruction: string;
  userPrompt: string;
  thinkingLevel?: ThinkingLevel;
  temperature?: number;
}

/**
 * Call a Gemma model via the Gemini Developer API.
 * Returns the raw text of the first candidate.
 */
export async function callGemma(opts: CallGemmaOptions): Promise<string> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: opts.model ?? DEFAULT_MODEL,
    contents: opts.userPrompt,
    config: {
      systemInstruction: opts.systemInstruction,
      temperature: opts.temperature ?? 0.4,
      thinkingConfig: {
        thinkingLevel: opts.thinkingLevel ?? ThinkingLevel.HIGH,
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemma returned an empty response.");
  }
  return text;
}
