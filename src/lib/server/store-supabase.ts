import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApproachGraph, BlockNode, TestCase } from "../blocks/catalog";
import type { Example, Problem, Puzzle } from "../puzzles/types";
import type { Database, Json } from "./database.types";
import type { NewProblem, NewPuzzle, ProgressRow, ProgressSummary, Store } from "./store";

type Client = SupabaseClient<Database>;
type ProblemRow = Database["public"]["Tables"]["problems"]["Row"];
type PuzzleRow = Database["public"]["Tables"]["puzzles"]["Row"];
type ProgressDbRow = Database["public"]["Tables"]["progress"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class SupabaseStore implements Store {
  constructor(private readonly db: Client) {}

  async ping() {
    const { error } = await this.db.from("problems").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(`Database unreachable: ${error.message}`);
  }

  async getProblem(source: Problem["source"], slug: string) {
    const { data, error } = await this.db.from("problems").select("*").eq("source", source).eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? toProblem(data) : null;
  }

  async insertProblem(p: NewProblem) {
    const { data, error } = await this.db
      .from("problems")
      .insert({
        source: p.source,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        content_text: p.contentText,
        examples: p.examples as unknown as Json,
        python_stub: p.pythonStub,
        is_paid: p.isPaid,
      })
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) {
      const existing = await this.getProblem(p.source, p.slug);
      if (existing) return existing;
    }
    if (error) throw error;
    return toProblem(data);
  }

  async getPuzzle(id: string) {
    const { data, error } = await this.db.from("puzzles").select("*, problem:problems(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { problem, ...row } = data as PuzzleRow & { problem: ProblemRow };
    return { puzzle: toPuzzle(row), problem: toProblem(problem) };
  }

  async findLivePuzzle(problemId: string) {
    const { data, error } = await this.db
      .from("puzzles")
      .select("*")
      .eq("problem_id", problemId)
      .in("status", ["pending", "ready"])
      .maybeSingle();
    if (error) throw error;
    return data ? toPuzzle(data) : null;
  }

  async insertPuzzle(p: NewPuzzle) {
    const { data, error } = await this.db
      .from("puzzles")
      .insert({ problem_id: p.problemId, model: p.model, status: p.status, ...(p.content ? contentColumns(p.content) : {}) })
      .select()
      .single();
    if (error?.code === UNIQUE_VIOLATION) return "conflict" as const;
    if (error) throw error;
    return toPuzzle(data);
  }

  async completePuzzle(id: string, model: string, content: Puzzle["content"] & object) {
    const { data, error } = await this.db
      .from("puzzles")
      .update({ status: "ready", model, ...contentColumns(content) })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    return data.length > 0;
  }

  async failPuzzle(id: string) {
    const { error } = await this.db.from("puzzles").update({ status: "failed" }).eq("id", id).eq("status", "pending");
    if (error) throw error;
  }

  async getProgress(userId: string, puzzleId: string) {
    const { data, error } = await this.db.from("progress").select("*").eq("user_id", userId).eq("puzzle_id", puzzleId).maybeSingle();
    if (error) throw error;
    return data ? toProgress(data) : null;
  }

  async listProgress(userId: string): Promise<ProgressSummary[]> {
    const { data, error } = await this.db
      .from("progress")
      .select("*, puzzle:puzzles(problem:problems(slug, title, difficulty))")
      .eq("user_id", userId);
    if (error) throw error;
    type Row = ProgressDbRow & { puzzle: { problem: Pick<ProblemRow, "slug" | "title" | "difficulty"> } | null };
    return (data as unknown as Row[])
      .filter((r) => r.puzzle?.problem)
      .map((r) => ({
        ...toProgress(r),
        slug: r.puzzle!.problem.slug,
        title: r.puzzle!.problem.title,
        difficulty: r.puzzle!.problem.difficulty as Problem["difficulty"],
      }));
  }

  async recordAttempt(a: Parameters<Store["recordAttempt"]>[0]) {
    const { data, error } = await this.db
      .rpc("record_attempt", {
        p_user_id: a.userId,
        p_puzzle_id: a.puzzleId,
        p_approach: a.approach,
        p_workspace: a.workspace as unknown as Json,
        p_passed: a.passed,
        p_tests_passed: a.testsPassed,
        p_tests_total: a.testsTotal,
        p_solves_brute: a.solvesBrute,
        p_solves_optimized: a.solvesOptimized,
      })
      .single();
    if (error) throw error;
    return toProgress(data as ProgressDbRow);
  }
}

function contentColumns(content: NonNullable<Puzzle["content"]>) {
  return {
    brute: content.brute as unknown as Json,
    optimized: content.optimized as unknown as Json,
    distractors: content.distractors as unknown as Json,
    tests: content.tests as unknown as Json,
  };
}

function toProblem(r: ProblemRow): Problem {
  return {
    id: r.id,
    source: r.source as Problem["source"],
    slug: r.slug,
    title: r.title,
    difficulty: r.difficulty as Problem["difficulty"],
    tags: r.tags,
    contentText: r.content_text,
    examples: r.examples as unknown as Example[],
    pythonStub: r.python_stub,
    isPaid: r.is_paid,
  };
}

function toPuzzle(r: PuzzleRow): Puzzle {
  const ready = r.status === "ready" && r.brute && r.optimized && r.tests;
  return {
    id: r.id,
    problemId: r.problem_id,
    model: r.model,
    status: r.status as Puzzle["status"],
    createdAt: r.created_at,
    content: ready
      ? {
          brute: r.brute as unknown as ApproachGraph,
          optimized: r.optimized as unknown as ApproachGraph,
          distractors: r.distractors as unknown as BlockNode[],
          tests: r.tests as unknown as TestCase[],
        }
      : null,
  };
}

function toProgress(r: ProgressDbRow): ProgressRow {
  return {
    puzzleId: r.puzzle_id,
    bruteSolvedAt: r.brute_solved_at,
    optimizedSolvedAt: r.optimized_solved_at,
    attemptCount: r.attempt_count,
  };
}
