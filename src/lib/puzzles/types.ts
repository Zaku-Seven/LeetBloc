import type { ApproachGraph, BlockNode, TestCase } from "../blocks/catalog";

export type Approach = "brute" | "optimized";
export const APPROACHES: readonly Approach[] = ["brute", "optimized"];

export interface Example {
  input: string;
  output: string;
}

// A problem as stored in `problems`.
export interface Problem {
  id: string;
  source: "leetcode" | "bundled";
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  contentText: string;
  examples: Example[];
  pythonStub: string;
  isPaid: boolean;
}

// Everything a generator (Gemma, or a hand-written bundled puzzle) has to
// provide. `verifyPuzzle` decides whether it is safe to store.
export interface PuzzleCandidate {
  brute: ApproachGraph;
  optimized: ApproachGraph;
  distractors: BlockNode[];
  extraTests: TestCase[];
}

// What is stored once a candidate passes: the agreed tests replace the
// candidate's own expected values.
export interface PuzzleContent {
  brute: ApproachGraph;
  optimized: ApproachGraph;
  distractors: BlockNode[];
  tests: TestCase[];
}

export interface Puzzle {
  id: string;
  problemId: string;
  model: string;
  status: "pending" | "ready" | "failed";
  content: PuzzleContent | null;
  createdAt: string;
}
