// ---------------------------------------------------------------------------
// Block catalog constants
// ---------------------------------------------------------------------------

/** Statement blocks — vertical stack, execute in order */
export const STATEMENT_BLOCK_TYPES = [
  "create",    // Make a list, set, map, or number
  "assign",    // Store a value
  "append",    // Push onto a list
  "map_set",   // Remember a key→value
  "set_add",   // Remember a membership
  "for_index", // Walk indexes (including nested loops)
  "for_each",  // Walk values
  "while",     // Walk a condition (used for pointers)
  "if",        // Branch
  "else",      // Else branch
  "return",    // Answer
] as const;

/** Value blocks — dropped into statement holes */
export const VALUE_BLOCK_TYPES = [
  "var",       // Variables like nums, target, i, seen
  "number",    // Constants like 0, 1, -1
  "index",     // Array access like nums[i]
  "map_get",   // Dictionary lookup like seen[complement]
  "length",    // len(nums)
  "binop",     // Binary operations like target - nums[i]
  "compare",   // Comparisons like i < j, seen has key
  "in_set",    // Check membership
] as const;

export const ALL_BLOCK_TYPES = [
  ...STATEMENT_BLOCK_TYPES,
  ...VALUE_BLOCK_TYPES,
] as const;

export type StatementBlockType = (typeof STATEMENT_BLOCK_TYPES)[number];
export type ValueBlockType = (typeof VALUE_BLOCK_TYPES)[number];
export type BlockType = (typeof ALL_BLOCK_TYPES)[number];

// ---------------------------------------------------------------------------
// Block tree
// ---------------------------------------------------------------------------

/** A single block in the puzzle tree (recursive) */
export interface BlockNode {
  id: string;
  type: BlockType;
  /** Human-readable label shown on the block */
  label: string;
  /** Single child value (e.g. the condition of an if) */
  value?: BlockNode;
  /** Multiple child values (e.g. operands of binop) */
  values?: BlockNode[];
  /** Ordered statement children (e.g. body of a for loop) */
  children?: BlockNode[];
}

// ---------------------------------------------------------------------------
// Approach graph (one per solution strategy)
// ---------------------------------------------------------------------------

export interface ApproachGraph {
  /** Short natural-language plan shown to the learner */
  plan: string;
  /** Big-O complexity string, e.g. "O(n)" */
  complexity: string;
  /** Root-level blocks forming the solution */
  blocks: BlockNode[];
  /** IDs of blocks the learner *must* place for the optimized round */
  requiredBlockIds: string[];
}

// ---------------------------------------------------------------------------
// Full Gemma response shape
// ---------------------------------------------------------------------------

export interface GemmaGenerationResponse {
  brute: ApproachGraph;
  optimized: ApproachGraph;
  /** Extra blocks not used in either solution (red herrings) */
  distractors: BlockNode[];
  /** Additional test cases beyond the examples */
  extraTests: TestCase[];
}

// ---------------------------------------------------------------------------
// Problem input & test cases
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

export interface TestCase {
  input: string;
  expected: string;
}

// ---------------------------------------------------------------------------
// Generation pipeline result
// ---------------------------------------------------------------------------

export type GenerationStatus = "ready" | "failed";

export interface GenerationResult {
  status: GenerationStatus;
  problem: ProblemInput;
  response: GemmaGenerationResponse | null;
  model: string;
  /** Errors from the latest validation pass (empty when status is ready) */
  errors: string[];
  /** Internal debug data (timings, raw text, etc.) */
  debug: {
    rawText: string;
    repairRawText?: string;
    attempts: number;
  };
}
