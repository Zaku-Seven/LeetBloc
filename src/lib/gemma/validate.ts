import { z } from "zod";
import { verifyPuzzle } from "../puzzles/verify";
import type { PuzzleContent } from "../puzzles/types";
import type { GemmaGenerationResponse, ProblemInput } from "./types";

// ---------------------------------------------------------------------------
// JSON extraction — handles markdown fences and preamble text
// ---------------------------------------------------------------------------

/**
 * Extract the first top-level JSON object from a string that may contain
 * markdown fences, preamble text, or trailing explanation.
 */
export function extractJson(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const text = fenceMatch ? fenceMatch[1]!.trim() : raw.trim();

  // From the first `{` to the last `}`. Matching braces by depth would cut
  // the object short when the model closes a block one brace too early;
  // parseLenientJson repairs that instead.
  const start = text.indexOf("{");
  if (start === -1) {
    throw new JsonExtractionError("No JSON object found in response.");
  }
  const end = text.lastIndexOf("}");
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

export class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonExtractionError";
  }
}

// ---------------------------------------------------------------------------
// Lenient JSON — fixes slips models make, without touching string contents
// ---------------------------------------------------------------------------

/**
 * JSON.parse, and if that fails, one more try after fixing what models
 * commonly get wrong: trailing commas, // and /* *\/ comments, and Python's
 * True / False / None. Only text outside strings is changed.
 */
export function parseLenientJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (strictError) {
    let fixed = cleanJson(text);
    // A few rounds of bracket repair for deeply nested output.
    for (let round = 0; round < 4; round++) {
      try {
        return JSON.parse(fixed);
      } catch (e) {
        const next = repairBrackets(fixed, e);
        if (next === null) break;
        fixed = next;
      }
    }
    // Report the original error: its position matches the model's text.
    throw strictError;
  }
}

// Fixes the slip models make in deep nesting: one `}` too many, which closes
// a block early, so a later `,"key":` lands inside an array. Removing that
// brace leaves the text one `}` short at the end, which is added back.
// A wrong guess is harmless: the result must still pass verifyPuzzle.
function repairBrackets(text: string, e: unknown): string | null {
  const message = e instanceof Error ? e.message : "";
  const at = /position (\d+)/.exec(message)?.[1];
  if (at === undefined) {
    // Ran out of text with blocks still open.
    return /end of (JSON )?input/i.test(message) ? closeOpen(text) : null;
  }
  const pos = Number(at);
  // The object is complete and only extra closers follow: drop them.
  if (/after JSON/i.test(message) && /^[\s}\]]*$/.test(text.slice(pos))) return text.slice(0, pos);
  const before = text.slice(0, pos);
  const stray = /\}(\s*,\s*"[^"\\]*"\s*)$/.exec(before);
  if (text[pos] === ":" && stray) {
    return closeOpen(before.slice(0, stray.index) + stray[1] + text.slice(pos));
  }
  return null;
}

// Appends the closers for any { or [ still open at the end, outside strings.
function closeOpen(text: string): string {
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return text + stack.reverse().join("");
}

function cleanJson(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '"') {
      // Copy a string verbatim, escapes included.
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (text.startsWith("//", i)) {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (ch === ",") {
      // Drop a comma that only has whitespace or comments before ] or }.
      const rest = /^,(\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*([\]}])/.exec(text.slice(i));
      if (rest) i += 1;
      else {
        out += ch;
        i++;
      }
    } else {
      const word = /^(True|False|None)\b/.exec(text.slice(i, i + 5));
      if (word && !/[\w$]/.test(text[i - 1] ?? "")) {
        out += { True: "true", False: "false", None: "null" }[word[1] as "True" | "False" | "None"];
        i += word[1]!.length;
      } else {
        out += ch;
        i++;
      }
    }
  }
  return out;
}

// "Unexpected token ... at position 1234" → the text around position 1234,
// so the log points at the actual mistake.
function describeJsonError(text: string, e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const at = /position (\d+)/.exec(message)?.[1];
  if (at === undefined) return `Invalid JSON (${message}). Ends with: ${text.slice(-120)}`;
  const pos = Number(at);
  const line = text.slice(0, pos).split("\n").length;
  const near = `${text.slice(Math.max(0, pos - 80), pos)}⟨HERE⟩${text.slice(pos, pos + 40)}`;
  return `Invalid JSON at line ${line}, character ${pos} (${message}): …${near.replace(/\s+/g, " ")}…`;
}

// ---------------------------------------------------------------------------
// Top-level shape. Block trees are checked by verifyPuzzle (checkTree), whose
// errors name the exact block and slot.
// ---------------------------------------------------------------------------

const approachGraphSchema = z.object({
  plan: z.string().min(1),
  complexity: z.string().min(1),
  blocks: z.array(z.unknown()).min(1),
  requiredBlockIds: z.array(z.string()),
});

const testCaseSchema = z.object({
  input: z.string().min(1),
  expected: z.string().min(1),
});

export const gemmaResponseSchema = z.object({
  brute: approachGraphSchema,
  optimized: approachGraphSchema,
  distractors: z.array(z.unknown()).max(6),
  extraTests: z.array(testCaseSchema).min(1).max(10),
});

// ---------------------------------------------------------------------------
// Public validation entry point
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  data: GemmaGenerationResponse | null;
  // The verified puzzle with its agreed tests, when ok.
  content: PuzzleContent | null;
  errors: string[];
}

/**
 * Parse raw text → extract JSON → check the shape → verifyPuzzle, which checks
 * every block against the catalog and the name allowlist, runs both solutions
 * on the examples, and keeps only the extra tests both agree on.
 * Returns errors that name the block and the problem.
 */
export function validateResponse(rawText: string, problem: ProblemInput): ValidationResult {
  const fail = (errors: string[], data: GemmaGenerationResponse | null = null): ValidationResult => ({
    ok: false,
    data,
    content: null,
    errors,
  });

  // 1. Extract JSON
  let jsonStr: string;
  try {
    jsonStr = extractJson(rawText);
  } catch (e) {
    return fail([e instanceof Error ? e.message : "Failed to extract JSON."]);
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = parseLenientJson(jsonStr);
  } catch (e) {
    return fail([describeJsonError(jsonStr, e)]);
  }

  // 3. Top-level shape
  const shape = gemmaResponseSchema.safeParse(parsed);
  if (!shape.success) {
    return fail(shape.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  // 4. Catalog, names, and run-and-agree
  const data = shape.data as unknown as GemmaGenerationResponse;
  const verified = verifyPuzzle(problem, data);
  if (!verified.ok) return fail(verified.errors.slice(0, 20), data);

  return { ok: true, data, content: verified.content, errors: [] };
}
