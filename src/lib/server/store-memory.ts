// An in-memory Store for tests. It enforces the same rules as the
// migrations: one live puzzle per problem, unique (source, slug), and
// record_attempt's never-overwrite solved timestamps.

import { randomUUID } from "node:crypto";
import type { Problem, Puzzle } from "../puzzles/types";
import type { AttemptRecord, NewProblem, NewPuzzle, ProgressRow, Store } from "./store";

export class MemoryStore implements Store {
  problems: Problem[] = [];
  puzzles: Puzzle[] = [];
  attempts: AttemptRecord[] = [];
  progress = new Map<string, ProgressRow & { userId: string }>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async ping() {}

  async getProblem(source: Problem["source"], slug: string) {
    return this.problems.find((p) => p.source === source && p.slug === slug) ?? null;
  }

  async insertProblem(p: NewProblem) {
    const existing = this.problems.find((x) => x.source === p.source && x.slug === p.slug);
    if (existing) return existing;
    const row = { ...p, id: randomUUID() };
    this.problems.push(row);
    return row;
  }

  async getPuzzle(id: string) {
    const puzzle = this.puzzles.find((p) => p.id === id);
    const problem = puzzle && this.problems.find((p) => p.id === puzzle.problemId);
    return puzzle && problem ? { puzzle, problem } : null;
  }

  async findLivePuzzle(problemId: string) {
    return this.puzzles.find((p) => p.problemId === problemId && p.status !== "failed") ?? null;
  }

  async insertPuzzle(p: NewPuzzle) {
    // Checked and inserted with no await in between, so it is atomic like the unique index.
    if (this.puzzles.some((x) => x.problemId === p.problemId && x.status !== "failed")) return "conflict" as const;
    if (p.status === "ready" && !p.content) throw new Error("check constraint: a ready puzzle needs content");
    const row: Puzzle = {
      id: randomUUID(),
      problemId: p.problemId,
      model: p.model,
      status: p.status,
      content: p.content ?? null,
      createdAt: this.now().toISOString(),
    };
    this.puzzles.push(row);
    return row;
  }

  async completePuzzle(id: string, model: string, content: NonNullable<Puzzle["content"]>) {
    const row = this.puzzles.find((p) => p.id === id && p.status === "pending");
    if (!row) return false;
    Object.assign(row, { status: "ready", model, content });
    return true;
  }

  async failPuzzle(id: string) {
    const row = this.puzzles.find((p) => p.id === id && p.status === "pending");
    if (row) row.status = "failed";
  }

  async getProgress(userId: string, puzzleId: string) {
    const row = this.progress.get(`${userId}:${puzzleId}`);
    return row ? strip(row) : null;
  }

  async listProgress(userId: string) {
    return [...this.progress.values()]
      .filter((r) => r.userId === userId)
      .map((r) => {
        const puzzle = this.puzzles.find((p) => p.id === r.puzzleId)!;
        const problem = this.problems.find((p) => p.id === puzzle.problemId)!;
        return { ...strip(r), slug: problem.slug, title: problem.title, difficulty: problem.difficulty };
      });
  }

  async recordAttempt(a: AttemptRecord) {
    if ((a.solvesBrute || a.solvesOptimized) && !a.passed) throw new Error("a failing attempt cannot solve a round");
    this.attempts.push(a);
    const key = `${a.userId}:${a.puzzleId}`;
    const now = this.now().toISOString();
    const row = this.progress.get(key) ?? {
      userId: a.userId,
      puzzleId: a.puzzleId,
      bruteSolvedAt: null,
      optimizedSolvedAt: null,
      attemptCount: 0,
    };
    row.attemptCount++;
    if (a.solvesBrute) row.bruteSolvedAt ??= now;
    if (a.solvesOptimized) row.optimizedSolvedAt ??= now;
    this.progress.set(key, row);
    return strip(row);
  }
}

function strip(row: ProgressRow & { userId: string }): ProgressRow {
  return { puzzleId: row.puzzleId, bruteSolvedAt: row.bruteSolvedAt, optimizedSolvedAt: row.optimizedSolvedAt, attemptCount: row.attemptCount };
}
