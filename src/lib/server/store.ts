// Everything the API reads from or writes to Postgres. The Supabase
// implementation is in store-supabase.ts. Tests use store-memory.ts, which
// enforces the same constraints as the migrations.

import type { Workspace } from "../blocks/workspace";
import type { Approach, Problem, Puzzle, PuzzleContent } from "../puzzles/types";

export type NewProblem = Omit<Problem, "id">;

export interface NewPuzzle {
  problemId: string;
  model: string;
  status: "pending" | "ready";
  content?: PuzzleContent;
}

export interface ProgressRow {
  puzzleId: string;
  bruteSolvedAt: string | null;
  optimizedSolvedAt: string | null;
  attemptCount: number;
}

export interface ProgressSummary extends ProgressRow {
  slug: string;
  title: string;
  difficulty: Problem["difficulty"];
}

export interface AttemptRecord {
  userId: string;
  puzzleId: string;
  approach: Approach;
  workspace: Workspace;
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  solvesBrute: boolean;
  solvesOptimized: boolean;
}

export interface Store {
  ping(): Promise<void>;
  getProblem(source: Problem["source"], slug: string): Promise<Problem | null>;
  // Inserts, or returns the existing row for the same (source, slug).
  insertProblem(problem: NewProblem): Promise<Problem>;
  getPuzzle(id: string): Promise<{ puzzle: Puzzle; problem: Problem } | null>;
  // The pending or ready puzzle for a problem. There is at most one.
  findLivePuzzle(problemId: string): Promise<Puzzle | null>;
  // "conflict" when the problem already has a pending or ready puzzle.
  insertPuzzle(puzzle: NewPuzzle): Promise<Puzzle | "conflict">;
  // Marks a pending puzzle ready. False when it was no longer pending.
  completePuzzle(id: string, model: string, content: PuzzleContent): Promise<boolean>;
  failPuzzle(id: string): Promise<void>;
  getProgress(userId: string, puzzleId: string): Promise<ProgressRow | null>;
  listProgress(userId: string): Promise<ProgressSummary[]>;
  // Writes the attempt and updates progress in one transaction (record_attempt).
  recordAttempt(attempt: AttemptRecord): Promise<ProgressRow>;
}
