// The block catalog lives in src/lib/blocks/catalog.ts, shared with the
// interpreter, the Python printer, and the frontend. This module re-exports
// it under the names the Gemma layer uses.

import type { PuzzleCandidate, PuzzleContent } from "../puzzles/types";
import type { CallRecord } from "./generate";

export {
  STATEMENT_TYPES as STATEMENT_BLOCK_TYPES,
  VALUE_TYPES as VALUE_BLOCK_TYPES,
  type BlockNode,
  type BlockType,
  type Fields,
  type StatementType as StatementBlockType,
  type ValueType as ValueBlockType,
  type ApproachGraph,
  type TestCase,
} from "../blocks/catalog";

import { STATEMENT_TYPES, VALUE_TYPES } from "../blocks/catalog";

export const ALL_BLOCK_TYPES = [...STATEMENT_TYPES, ...VALUE_TYPES] as const;

// ---------------------------------------------------------------------------
// Full Gemma response shape: exactly what the backend verifies and stores.
// ---------------------------------------------------------------------------

export type GemmaGenerationResponse = PuzzleCandidate;

// ---------------------------------------------------------------------------
// Problem input
// ---------------------------------------------------------------------------

export interface Example {
  input: string;
  output: string;
}

export interface ProblemInput {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  pythonStub: string;
  contentText: string;
  examples: Example[];
}

// ---------------------------------------------------------------------------
// Generation pipeline result
// ---------------------------------------------------------------------------

export type GenerationStatus = "ready" | "failed";

export interface GenerationResult {
  status: GenerationStatus;
  problem: ProblemInput;
  response: GemmaGenerationResponse | null;
  // The verified puzzle, with the agreed tests. Set when status is ready.
  content: PuzzleContent | null;
  model: string;
  /** Errors from the latest validation pass (empty when status is ready) */
  errors: string[];
  /** Internal debug data (timings, raw text, etc.) */
  debug: {
    rawText: string;
    attempts: number;
    // Each Gemma request: model, thinking level, duration, and any API error.
    calls: CallRecord[];
  };
}
