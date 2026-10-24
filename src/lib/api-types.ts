// Response shapes for the LeetBloc API, shared with the frontend.

import type { BlockNode } from "./blocks/catalog";
import type { Failure } from "./puzzles/tests";
import type { Approach, Example } from "./puzzles/types";

export type { Approach, Example, Failure };
export type { Workspace, PlacedBlock } from "./blocks/workspace";

export interface ProblemView {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  prompt: string;
  examples: Example[];
  // LeetCode's Python stub. The locked function block shows its def line.
  pythonStub: string;
  functionName: string;
  params: string[];
}

export interface Solved {
  brute: boolean;
  optimized: boolean;
}

// Reference solutions, printed as Python, only for rounds already solved.
export interface ReferencePython {
  brute?: string;
  optimized?: string;
}

export type PuzzleView =
  | { id: string; status: "pending" }
  | { id: string; status: "failed"; message: string }
  | {
      id: string;
      status: "ready";
      problem: ProblemView;
      approach: Approach;
      plan: string;
      // Shuffled statement blocks for this round, values filled in, no children.
      tray: BlockNode[];
      solved: Solved;
      referencePython: ReferencePython;
    };

export interface AttemptResult {
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  firstFailure?: Failure;
  // Passed every test in the optimized round, but without the optimized
  // pattern: "this works, and it is the slow version".
  slowVersion: boolean;
  solved: Solved;
  // False for a visitor who is not signed in.
  saved: boolean;
  referencePython: ReferencePython;
  // Shown on the explanation card after the optimized round is solved.
  complexity?: { brute: string; optimized: string };
}

export interface ProgressItem {
  puzzleId: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  bruteSolvedAt: string | null;
  optimizedSolvedAt: string | null;
  attemptCount: number;
}

export interface ApiError {
  error: string;
}
