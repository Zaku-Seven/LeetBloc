import { ThinkingLevel } from "@google/genai";
import { callGemma, DEFAULT_MODEL, type CallGemmaOptions } from "./client";
import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { validateResponse } from "./validate";
import type { ProblemInput, GenerationResult } from "./types";

// ---------------------------------------------------------------------------
// generatePuzzle — main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a block puzzle from a LeetCode problem description.
 *
 * One Gemma call, then validation. validateResponse fixes JSON slips locally
 * (stray brackets, trailing commas, comments, Python literals) and runs both
 * solutions with verifyPuzzle. A puzzle that still fails is marked failed;
 * pasting the link again starts a fresh generation.
 *
 * There is no repair call: one call takes about 2.5 minutes (measured October
 * 2026, mostly thinking), so a second one does not fit in the route's time.
 */

// Inside the puzzles route's maxDuration of 300 s.
export const CALL_BUDGET_MS = 280_000;

export async function generatePuzzle(
  problem: ProblemInput,
  // Swappable for tests.
  call: (opts: CallGemmaOptions) => Promise<string> = callGemma,
): Promise<GenerationResult> {
  const opts: CallGemmaOptions = {
    model: DEFAULT_MODEL,
    systemInstruction: buildSystemInstruction(),
    userPrompt: buildUserPrompt(problem),
    // Model default. LOW is rejected by this model, HIGH is slower.
    thinkingLevel: null,
    temperature: 0.4,
    timeoutMs: CALL_BUDGET_MS,
  };
  const thinking = opts.thinkingLevel === null ? "default" : (opts.thinkingLevel ?? ThinkingLevel.HIGH);
  const started = Date.now();
  console.log(`Gemma call started: ${opts.model} (${thinking} thinking) for ${problem.slug}`);

  let rawText: string;
  try {
    rawText = await call(opts);
  } catch (e) {
    const record: CallRecord = { model: DEFAULT_MODEL, thinking, ms: Date.now() - started, ok: false, error: errorMessage(e) };
    console.error(`Gemma call failed: ${opts.model} after ${record.ms} ms: ${record.error}`);
    return {
      status: "failed",
      problem,
      response: null,
      content: null,
      model: DEFAULT_MODEL,
      errors: [`${DEFAULT_MODEL}: ${record.error}`],
      debug: { rawText: "", attempts: 1, calls: [record] },
    };
  }

  const record: CallRecord = { model: DEFAULT_MODEL, thinking, ms: Date.now() - started, ok: true, chars: rawText.length };
  console.log(`Gemma call finished: ${opts.model} in ${record.ms} ms, ${rawText.length} characters`);

  const result = validateResponse(rawText, problem);
  const debug = { rawText, attempts: 1, calls: [record] };
  if (result.ok && result.data) {
    return { status: "ready", problem, response: result.data, content: result.content, model: DEFAULT_MODEL, errors: [], debug };
  }
  console.warn(`Gemma answer failed validation (${result.errors.length} errors):\n  ${result.errors.slice(0, 8).join("\n  ")}`);
  return { status: "failed", problem, response: result.data, content: null, model: DEFAULT_MODEL, errors: result.errors, debug };
}

export interface CallRecord {
  model: string;
  thinking: string;
  ms: number;
  ok: boolean;
  chars?: number;
  error?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
