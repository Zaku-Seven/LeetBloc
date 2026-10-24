import { ThinkingLevel } from "@google/genai";
import { callGemma, DEFAULT_MODEL, FALLBACK_MODEL } from "./client";
import { buildSystemInstruction, buildUserPrompt, buildRepairPrompt } from "./prompt";
import { validateResponse } from "./validate";
import type { ProblemInput, GenerationResult } from "./types";

// ---------------------------------------------------------------------------
// generatePuzzle — main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a block puzzle from a LeetCode problem description.
 *
 * Flow (matches DESIGN.md generation steps 4-7):
 *   1. Call default model with high thinking
 *   2. Validate response
 *   3. On failure → repair call with fallback model + minimal thinking
 *   4. Validate again → return ready or failed
 */
export async function generatePuzzle(
  problem: ProblemInput,
): Promise<GenerationResult> {
  const systemInstruction = buildSystemInstruction();
  const userPrompt = buildUserPrompt(problem);

  // --- Attempt 1: default model ---
  const rawText = await callGemma({
    model: DEFAULT_MODEL,
    systemInstruction,
    userPrompt,
    thinkingLevel: ThinkingLevel.HIGH,
    temperature: 0.4,
  });

  const firstResult = validateResponse(rawText);
  if (firstResult.ok && firstResult.data) {
    return {
      status: "ready",
      problem,
      response: firstResult.data,
      model: DEFAULT_MODEL,
      errors: [],
      debug: { rawText, attempts: 1 },
    };
  }

  // --- Attempt 2: repair with fallback model ---
  const repairPrompt = buildRepairPrompt(userPrompt, rawText, firstResult.errors);

  const repairRawText = await callGemma({
    model: FALLBACK_MODEL,
    systemInstruction,
    userPrompt: repairPrompt,
    thinkingLevel: ThinkingLevel.MINIMAL,
    temperature: 0.2,
  });

  const repairResult = validateResponse(repairRawText);
  if (repairResult.ok && repairResult.data) {
    return {
      status: "ready",
      problem,
      response: repairResult.data,
      model: FALLBACK_MODEL,
      errors: [],
      debug: { rawText, repairRawText, attempts: 2 },
    };
  }

  // --- Both attempts failed ---
  return {
    status: "failed",
    problem,
    response: repairResult.data,
    model: FALLBACK_MODEL,
    errors: repairResult.errors,
    debug: { rawText, repairRawText, attempts: 2 },
  };
}
