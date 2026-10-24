// The API's behaviour, independent of Next.js. Route handlers in src/app/api
// parse the request, call one of these, and send the result.

import { z } from "zod";
import type { AttemptResult, ProgressItem, PuzzleView, ReferencePython, Solved } from "../api-types";
import { parseStub, printProgram } from "../blocks/python";
import { WorkspaceError, WorkspaceSchema, assemble } from "../blocks/workspace";
import { BUNDLED, BUNDLED_MODEL } from "../puzzles/bundled";
import { findNodes, hasRequired, runTests } from "../puzzles/tests";
import type { Approach, Problem, Puzzle, PuzzleCandidate, PuzzleContent } from "../puzzles/types";
import { verifyPuzzle } from "../puzzles/verify";
import { parseProblemUrl, type LeetCodeClient } from "./leetcode";
import type { Store } from "./store";
import { buildTray } from "./tray";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Produces a puzzle for a problem. This is where Gemma plugs in. The result
// is verified here before it is stored, whatever the generator checked.
export type Generator = (problem: Problem) => Promise<{ model: string; candidate: PuzzleCandidate }>;

export interface Deps {
  store: Store;
  leetcode: LeetCodeClient;
  trayIdSecret: string;
  generator?: Generator;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

// A pending row older than this is treated as abandoned. It must be longer
// than the function's maxDuration, so a slow generation is not mistaken for
// a crashed one.
export const STALE_PENDING_MS = 6 * 60_000;
// How long a request waits on someone else's generation before answering "pending".
export const WAIT_FOR_PENDING_MS = 20_000;
const POLL_MS = 1_000;

const FAILED_MESSAGE = "We could not build a puzzle for this problem. Try one of the starter problems.";

// --- POST /api/puzzles ------------------------------------------------------

export const OpenPuzzleSchema = z.object({ url: z.string().max(500) });

export async function openPuzzle(deps: Deps, body: unknown, userId: string | null): Promise<{ status: number; body: PuzzleView }> {
  const parsed = OpenPuzzleSchema.safeParse(body);
  const slug = parsed.success ? parseProblemUrl(parsed.data.url) : null;
  if (!slug) throw new ApiError(400, "Paste a link like https://leetcode.com/problems/two-sum/");

  const problem = await loadProblem(deps, slug);
  if (problem.isPaid) throw new ApiError(403, "That is a paid LeetCode problem. LeetBloc only opens free ones.");

  const puzzle = problem.source === "bundled" ? await ensureBundledPuzzle(deps, problem) : await ensurePuzzle(deps, problem);
  return { status: puzzle.status === "pending" ? 202 : 200, body: await viewOf(deps, puzzle, problem, "brute", userId) };
}

async function loadProblem(deps: Deps, slug: string): Promise<Problem> {
  const bundled = BUNDLED[slug];
  if (bundled) {
    return (
      (await deps.store.getProblem("bundled", slug)) ??
      (await deps.store.insertProblem({ ...bundled.problem, source: "bundled", isPaid: false }))
    );
  }
  const cached = await deps.store.getProblem("leetcode", slug);
  if (cached) return cached;

  let fetched;
  try {
    fetched = await deps.leetcode.fetchProblem(slug);
  } catch (e) {
    console.error("LeetCode fetch failed", slug, e);
    throw new ApiError(502, "LeetCode did not answer. Try one of the starter problems.");
  }
  if (!fetched) throw new ApiError(404, "LeetCode has no problem at that link.");
  return deps.store.insertProblem(fetched);
}

const verifiedBundles = new Map<string, PuzzleContent>();

function bundledContent(slug: string): PuzzleContent {
  let content = verifiedBundles.get(slug);
  if (!content) {
    const bundled = BUNDLED[slug]!;
    const result = verifyPuzzle(bundled.problem, bundled.puzzle);
    if (!result.ok) throw new Error(`Bundled puzzle ${slug} fails verification: ${result.errors.join("; ")}`);
    content = result.content;
    verifiedBundles.set(slug, content);
  }
  return content;
}

async function ensureBundledPuzzle(deps: Deps, problem: Problem): Promise<Puzzle> {
  for (let i = 0; i < 3; i++) {
    const live = await deps.store.findLivePuzzle(problem.id);
    if (live) return live;
    const inserted = await deps.store.insertPuzzle({
      problemId: problem.id,
      model: BUNDLED_MODEL,
      status: "ready",
      content: bundledContent(problem.slug),
    });
    if (inserted !== "conflict") return inserted;
  }
  throw new ApiError(503, "Busy setting up this puzzle. Try again.");
}

// Returns the ready puzzle, generating it if needed. Generation is deduped
// by the partial unique index on puzzles: only one request can insert the
// pending row, and everyone else waits on it.
export async function ensurePuzzle(deps: Deps, problem: Problem): Promise<Puzzle> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  for (let i = 0; i < 3; i++) {
    const live = await deps.store.findLivePuzzle(problem.id);
    if (live?.status === "ready") return live;

    if (live?.status === "pending") {
      if (now() - Date.parse(live.createdAt) > STALE_PENDING_MS) {
        await deps.store.failPuzzle(live.id);
        continue;
      }
      return waitFor(deps, live, now, sleep);
    }

    if (!deps.generator) {
      throw new ApiError(501, "Puzzles for new problems are not available yet. Try one of the starter problems.");
    }

    const pending = await deps.store.insertPuzzle({ problemId: problem.id, model: "pending", status: "pending" });
    if (pending === "conflict") continue;
    return generate(deps, problem, pending);
  }
  throw new ApiError(503, "Busy setting up this puzzle. Try again.");
}

async function waitFor(deps: Deps, pending: Puzzle, now: () => number, sleep: (ms: number) => Promise<void>): Promise<Puzzle> {
  const until = now() + WAIT_FOR_PENDING_MS;
  while (now() < until) {
    await sleep(POLL_MS);
    const current = await deps.store.getPuzzle(pending.id);
    if (current && current.puzzle.status !== "pending") return current.puzzle;
  }
  return pending;
}

async function generate(deps: Deps, problem: Problem, pending: Puzzle): Promise<Puzzle> {
  try {
    const { model, candidate } = await deps.generator!(problem);
    const verified = verifyPuzzle(problem, candidate);
    if (!verified.ok) {
      console.error("Generated puzzle failed verification", problem.slug, verified.errors);
      await deps.store.failPuzzle(pending.id);
      return { ...pending, status: "failed" };
    }
    const stored = await deps.store.completePuzzle(pending.id, model, verified.content);
    // Not stored means another request gave up on this row as stale.
    if (!stored) return (await deps.store.findLivePuzzle(problem.id)) ?? { ...pending, status: "failed" };
    return { ...pending, status: "ready", model, content: verified.content };
  } catch (e) {
    console.error("Generation failed", problem.slug, e);
    await deps.store.failPuzzle(pending.id);
    return { ...pending, status: "failed" };
  }
}

// --- GET /api/puzzles/:id ---------------------------------------------------

const ApproachSchema = z.enum(["brute", "optimized"]);
const UuidSchema = z.string().uuid();

export async function getPuzzleView(deps: Deps, id: string, approachParam: string | null, userId: string | null) {
  const approach = ApproachSchema.safeParse(approachParam ?? "brute");
  if (!approach.success) throw new ApiError(400, "approach must be brute or optimized");
  const found = await loadPuzzle(deps, id);
  const view = await viewOf(deps, found.puzzle, found.problem, approach.data, userId);
  return { status: view.status === "pending" ? 202 : 200, body: view };
}

async function loadPuzzle(deps: Deps, id: string) {
  if (!UuidSchema.safeParse(id).success) throw new ApiError(404, "No such puzzle.");
  const found = await deps.store.getPuzzle(id);
  if (!found) throw new ApiError(404, "No such puzzle.");
  return found;
}

async function viewOf(deps: Deps, puzzle: Puzzle, problem: Problem, approach: Approach, userId: string | null): Promise<PuzzleView> {
  if (puzzle.status === "pending") return { id: puzzle.id, status: "pending" };
  if (puzzle.status === "failed" || !puzzle.content) return { id: puzzle.id, status: "failed", message: FAILED_MESSAGE };

  const content = puzzle.content;
  const progress = userId ? await deps.store.getProgress(userId, puzzle.id) : null;
  const solved = { brute: !!progress?.bruteSolvedAt, optimized: !!progress?.optimizedSolvedAt };
  const stub = parseStub(problem.pythonStub);
  return {
    id: puzzle.id,
    status: "ready",
    problem: {
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      tags: problem.tags,
      prompt: problem.contentText,
      examples: problem.examples,
      pythonStub: problem.pythonStub,
      functionName: stub.name,
      params: stub.params,
    },
    approach,
    plan: content[approach].plan,
    tray: buildTray(deps.trayIdSecret, puzzle.id, content, approach).blocks,
    solved,
    referencePython: referencePython(content, problem, solved),
  };
}

function referencePython(content: PuzzleContent, problem: Problem, solved: Solved): ReferencePython {
  const out: ReferencePython = {};
  for (const approach of ["brute", "optimized"] as const) {
    if (solved[approach]) out[approach] = printProgram(content[approach].blocks, problem.pythonStub);
  }
  return out;
}

// --- POST /api/puzzles/:id/attempts ----------------------------------------

export const AttemptSchema = z.object({ approach: ApproachSchema, workspace: WorkspaceSchema });

export async function submitAttempt(deps: Deps, id: string, body: unknown, userId: string | null): Promise<AttemptResult> {
  const parsed = AttemptSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, `Invalid attempt: ${parsed.error.issues[0]?.message ?? "bad body"}`);
  const { approach, workspace } = parsed.data;

  const { puzzle, problem } = await loadPuzzle(deps, id);
  if (puzzle.status !== "ready" || !puzzle.content) throw new ApiError(409, "This puzzle is not ready yet.");
  const content = puzzle.content;

  let program;
  try {
    program = assemble(buildTray(deps.trayIdSecret, puzzle.id, content, approach).byId, workspace);
  } catch (e) {
    if (e instanceof WorkspaceError) throw new ApiError(400, e.message);
    throw e;
  }

  const { params } = parseStub(problem.pythonStub);
  const result = runTests(program, params, content.tests);
  const allPass = result.passed === result.total;

  // Optimized-round required blocks, matched by what they do.
  const required = findNodes(content.optimized.blocks, content.optimized.requiredBlockIds);
  const fastShape = required.length > 0 && hasRequired(program, required);

  let passed: boolean;
  let solvesBrute = false;
  let solvesOptimized = false;
  let slowVersion = false;
  if (approach === "brute") {
    passed = allPass;
    solvesBrute = allPass;
    // Building the optimized solution in the brute-force round skips them ahead.
    solvesOptimized = allPass && fastShape;
  } else {
    passed = allPass && (required.length === 0 || fastShape);
    solvesOptimized = passed;
    slowVersion = allPass && !passed;
  }

  let solved: Solved = { brute: solvesBrute, optimized: solvesOptimized };
  if (userId) {
    const progress = await deps.store.recordAttempt({
      userId,
      puzzleId: puzzle.id,
      approach,
      workspace,
      passed,
      testsPassed: result.passed,
      testsTotal: result.total,
      solvesBrute,
      solvesOptimized,
    });
    solved = { brute: !!progress.bruteSolvedAt, optimized: !!progress.optimizedSolvedAt };
  }

  return {
    passed,
    testsPassed: result.passed,
    testsTotal: result.total,
    ...(result.firstFailure ? { firstFailure: result.firstFailure } : {}),
    slowVersion,
    solved,
    saved: !!userId,
    referencePython: referencePython(content, problem, solved),
    ...(solvesOptimized ? { complexity: { brute: content.brute.complexity, optimized: content.optimized.complexity } } : {}),
  };
}

// --- GET /api/me/progress ---------------------------------------------------

export async function listProgress(deps: Deps, userId: string): Promise<ProgressItem[]> {
  return deps.store.listProgress(userId);
}
