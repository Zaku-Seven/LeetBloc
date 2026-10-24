import { z } from "zod";
import {
  ALL_BLOCK_TYPES,
  type GemmaGenerationResponse,
} from "./types";

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
  const text = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  // Find the first `{` and its matching `}`
  const start = text.indexOf("{");
  if (start === -1) {
    throw new JsonExtractionError("No JSON object found in response.");
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new JsonExtractionError("Unterminated JSON object in response.");
}

export class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonExtractionError";
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

// Mutable copy for z.enum which requires [string, ...string[]]
const blockTypes: [string, ...string[]] = [
  ALL_BLOCK_TYPES[0],
  ...ALL_BLOCK_TYPES.slice(1),
];
const blockTypeEnum = z.enum(blockTypes);

// Recursive schema for BlockNode — use z.lazy without an explicit ZodType
// annotation to avoid inference conflicts with the enum's narrowed type.
const blockNodeSchema: z.ZodType<{
  id: string;
  type: string;
  label: string;
  value?: unknown;
  values?: unknown[];
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: blockTypeEnum,
    label: z.string().min(1),
    value: blockNodeSchema.optional(),
    values: z.array(blockNodeSchema).optional(),
    children: z.array(blockNodeSchema).optional(),
  }),
);

const testCaseSchema = z.object({
  input: z.string().min(1),
  expected: z.string().min(1),
});

const approachGraphSchema = z.object({
  plan: z.string().min(1),
  complexity: z.string().min(1),
  blocks: z.array(blockNodeSchema).min(1),
  requiredBlockIds: z.array(z.string()),
});

export const gemmaResponseSchema = z.object({
  brute: approachGraphSchema,
  optimized: approachGraphSchema,
  distractors: z.array(blockNodeSchema),
  extraTests: z.array(testCaseSchema).min(1),
});

// ---------------------------------------------------------------------------
// Semantic validation
// ---------------------------------------------------------------------------

interface BlockLike {
  id: string;
  value?: BlockLike;
  values?: BlockLike[];
  children?: BlockLike[];
}

/** Collect all block IDs from a tree of BlockNodes */
function collectIds(nodes: BlockLike[]): string[] {
  const ids: string[] = [];
  function walk(node: BlockLike) {
    ids.push(node.id);
    if (node.value) walk(node.value);
    if (node.values) node.values.forEach(walk);
    if (node.children) node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

/**
 * Run semantic checks that Zod can't express:
 * - All IDs globally unique
 * - requiredBlockIds reference real IDs in their approach
 */
function semanticChecks(data: GemmaGenerationResponse): string[] {
  const errors: string[] = [];

  // Collect all IDs
  const bruteIds = collectIds(data.brute.blocks);
  const optimizedIds = collectIds(data.optimized.blocks);
  const distractorIds = collectIds(data.distractors);
  const allIds = [...bruteIds, ...optimizedIds, ...distractorIds];

  // Check uniqueness
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      errors.push(`Duplicate block ID: "${id}"`);
    }
    seen.add(id);
  }

  // Check requiredBlockIds reference existing IDs in their own approach
  const bruteIdSet = new Set(bruteIds);
  for (const reqId of data.brute.requiredBlockIds) {
    if (!bruteIdSet.has(reqId)) {
      errors.push(
        `brute.requiredBlockIds references unknown ID: "${reqId}"`,
      );
    }
  }

  const optimizedIdSet = new Set(optimizedIds);
  for (const reqId of data.optimized.requiredBlockIds) {
    if (!optimizedIdSet.has(reqId)) {
      errors.push(
        `optimized.requiredBlockIds references unknown ID: "${reqId}"`,
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public validation entry point
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  data: GemmaGenerationResponse | null;
  errors: string[];
}

/**
 * Parse raw text → extract JSON → validate schema → semantic checks.
 * Returns structured errors suitable for a repair prompt.
 */
export function validateResponse(rawText: string): ValidationResult {
  // 1. Extract JSON
  let jsonStr: string;
  try {
    jsonStr = extractJson(rawText);
  } catch (e) {
    return {
      ok: false,
      data: null,
      errors: [e instanceof Error ? e.message : "Failed to extract JSON."],
    };
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      ok: false,
      data: null,
      errors: ["Invalid JSON: " + jsonStr.slice(0, 200)],
    };
  }

  // 3. Zod schema validation
  const zodResult = gemmaResponseSchema.safeParse(parsed);
  if (!zodResult.success) {
    const zodErrors = zodResult.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { ok: false, data: null, errors: zodErrors };
  }

  // 4. Semantic checks
  const data = zodResult.data as unknown as GemmaGenerationResponse;
  const semanticErrors = semanticChecks(data);
  if (semanticErrors.length > 0) {
    return { ok: false, data, errors: semanticErrors };
  }

  return { ok: true, data, errors: [] };
}
