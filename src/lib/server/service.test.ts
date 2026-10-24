import { describe, expect, it, vi } from "vitest";
import type { PuzzleView } from "../api-types";
import { signature, type BlockNode } from "../blocks/catalog";
import type { PlacedBlock, Workspace } from "../blocks/workspace";
import { BUNDLED } from "../puzzles/bundled";
import {
  append, bool, cmp, create, finalize, forEach, forIndex, has, hint, idx, ifBlock, len, num, required, ret, setAdd, v, bin,
} from "../puzzles/build";
import type { PuzzleCandidate } from "../puzzles/types";
import type { ServerDeps } from "./deps";
import { setDepsForTesting } from "./deps";
import { parseProblemUrl, readExamples, toProblem } from "./leetcode";
import { ApiError, STALE_PENDING_MS, getPuzzleView, openPuzzle, submitAttempt, type Generator } from "./service";
import { MemoryStore } from "./store-memory";
import type { NewProblem } from "./store";

// connection() needs a real Next.js request scope. It only matters at build time.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const USER = "11111111-1111-4111-8111-111111111111";

function makeDeps(overrides: Partial<ServerDeps> = {}): ServerDeps & { store: MemoryStore } {
  return {
    store: new MemoryStore(),
    leetcode: { fetchProblem: async () => null },
    trayIdSecret: "test-secret-test-secret-test-secret",
    verifier: { verify: async (t) => (t === "good" ? USER : null) },
    sleep: () => new Promise((r) => setTimeout(r, 2)),
    ...overrides,
  } as ServerDeps & { store: MemoryStore };
}

type Ready = Extract<PuzzleView, { status: "ready" }>;

const ready = (view: PuzzleView): Ready => {
  if (view.status !== "ready") throw new Error(`expected ready, got ${view.status}`);
  return view;
};

// Places tray blocks to match a canonical solution, matching blocks by what they do.
function solve(tray: BlockNode[], solution: BlockNode[]): Workspace {
  const free = [...tray];
  const place = (nodes: BlockNode[]): PlacedBlock[] =>
    nodes.map((n) => {
      const i = free.findIndex((t) => signature(t) === signature(n));
      if (i === -1) throw new Error(`no tray block for ${n.label}`);
      const [match] = free.splice(i, 1);
      return { id: match!.id, ...(n.children?.length ? { children: place(n.children) } : {}) };
    });
  return { blocks: place(solution) };
}

const open = async (deps: ServerDeps, slug: string, user: string | null = null) =>
  openPuzzle(deps, { url: `https://leetcode.com/problems/${slug}/` }, user);

describe("bundled puzzles", () => {
  it("opens a starter problem with a safe tray", async () => {
    const deps = makeDeps();
    const res = await open(deps, "two-sum");
    expect(res.status).toBe(200);
    const view = ready(res.body);
    const { puzzle } = BUNDLED["two-sum"]!;

    expect(view.problem).toMatchObject({ title: "Two Sum", functionName: "twoSum", params: ["nums", "target"] });
    expect(view.tray).toHaveLength(4 + puzzle.distractors.length);
    const sent = JSON.stringify(view);
    expect(sent).not.toContain('"children"');
    expect(sent).not.toMatch(/ts_[bod]\d/); // no canonical ids
    expect(sent).not.toContain("requiredBlockIds");
    expect(view.referencePython).toEqual({});

    // Opening again reuses the same row, and tray ids are stable across views.
    const again = ready((await open(deps, "two-sum")).body);
    expect(again.id).toBe(view.id);
    expect(new Set(again.tray.map((b) => b.id))).toEqual(new Set(view.tray.map((b) => b.id)));
    expect(deps.store.puzzles).toHaveLength(1);
  });

  it("grades a visitor without saving", async () => {
    const deps = makeDeps();
    const view = ready((await open(deps, "two-sum")).body);
    const result = await submitAttempt(deps, view.id, { approach: "brute", workspace: solve(view.tray, BUNDLED["two-sum"]!.puzzle.brute.blocks) }, null);
    expect(result).toMatchObject({ passed: true, testsPassed: 6, testsTotal: 6, saved: false, solved: { brute: true, optimized: false } });
    expect(result.referencePython.brute).toContain("for j in range(i + 1, len(nums)):");
    expect(deps.store.attempts).toHaveLength(0);
  });

  it("reports the first failing test", async () => {
    const deps = makeDeps();
    const view = ready((await open(deps, "two-sum")).body);
    const ret = view.tray.find((b) => b.type === "return")!;
    const result = await submitAttempt(deps, view.id, { approach: "brute", workspace: { blocks: [{ id: ret.id }] } }, null);
    expect(result.passed).toBe(false);
    expect(result.firstFailure).toEqual({ input: "nums = [2,7,11,15], target = 9", expected: "[0,1]", error: "NameError: name 'i' is not defined" });
  });

  it("saves progress for a signed-in user, through both rounds", async () => {
    const deps = makeDeps();
    const { puzzle } = BUNDLED["valid-parentheses"]!;
    const brute = ready((await open(deps, "valid-parentheses", USER)).body);

    const r1 = await submitAttempt(deps, brute.id, { approach: "brute", workspace: solve(brute.tray, puzzle.brute.blocks) }, USER);
    expect(r1).toMatchObject({ passed: true, saved: true, solved: { brute: true, optimized: false } });
    expect(r1.complexity).toBeUndefined();

    const optimized = ready((await getPuzzleView(deps, brute.id, "optimized", USER)).body);
    expect(optimized.solved).toEqual({ brute: true, optimized: false });
    expect(optimized.referencePython.brute).toContain("def isValid");
    const r2 = await submitAttempt(deps, brute.id, { approach: "optimized", workspace: solve(optimized.tray, puzzle.optimized.blocks) }, USER);
    expect(r2).toMatchObject({ passed: true, solved: { brute: true, optimized: true }, complexity: { brute: "O(n²) time, O(n) space", optimized: "O(n) time, O(n) space" } });
    expect(r2.referencePython.optimized).toContain("            else:\n                stack.append(c)");

    const [progress] = await deps.store.listProgress(USER);
    expect(progress).toMatchObject({ slug: "valid-parentheses", attemptCount: 2 });
    expect(progress!.bruteSolvedAt).not.toBeNull();
  });

  it("rejects a workspace with blocks from somewhere else", async () => {
    const deps = makeDeps();
    const view = ready((await open(deps, "two-sum")).body);
    await expect(submitAttempt(deps, view.id, { approach: "brute", workspace: { blocks: [{ id: "ts_b1" }] } }, null)).rejects.toMatchObject({ status: 400 });
    // Optimized-round ids are not valid in the brute-force round.
    const opt = ready((await getPuzzleView(deps, view.id, "optimized", null)).body);
    await expect(submitAttempt(deps, view.id, { approach: "brute", workspace: { blocks: [{ id: opt.tray[0]!.id }] } }, null)).rejects.toMatchObject({ status: 400 });
  });
});

// "Contains Duplicate" with distractors that let each round build the other
// round's solution, to test skipping ahead and the slow-version verdict.
const dupBrute = finalize("cd_b", [
  forIndex("i", num(0), len(v("nums")), [
    forIndex("j", bin(v("i"), "+", num(1)), len(v("nums")), [
      ifBlock(cmp(idx(v("nums"), v("i")), "==", idx(v("nums"), v("j"))), [ret(bool(true))]),
    ]),
  ]),
  ret(bool(false)),
]);
const dupOptimized = finalize("cd_o", [
  required(create("seen", "set")),
  forEach("x", v("nums"), [required(ifBlock(has(v("seen"), v("x")), [ret(bool(true))])), required(setAdd("seen", v("x")))]),
  ret(bool(false)),
]);
const dupDistractors = finalize("cd_d", [
  // The optimized blocks the brute-force tray lacks...
  create("seen", "set"),
  forEach("x", v("nums"), []),
  ifBlock(has(v("seen"), v("x")), []),
  setAdd("seen", v("x")),
  ret(bool(true)),
  // ...and the brute-force blocks the optimized tray lacks.
  forIndex("i", num(0), len(v("nums")), []),
  forIndex("j", bin(v("i"), "+", num(1)), len(v("nums")), []),
  ifBlock(cmp(idx(v("nums"), v("i")), "==", idx(v("nums"), v("j"))), []),
  hint("Collect the numbers.", append("seen", v("x"))),
]);
const dupCandidate: PuzzleCandidate = {
  brute: { plan: "Compare every pair.", complexity: "O(n²)", ...dupBrute, requiredBlockIds: [] },
  optimized: { plan: "Remember what you have seen.", complexity: "O(n)", ...dupOptimized },
  distractors: dupDistractors.blocks,
  extraTests: [
    { input: "nums = [1]", expected: "false" },
    { input: "nums = [5,5]", expected: "WRONG, recomputed" },
    { input: "nums = this is not a literal", expected: "true" },
  ],
};
const dupProblem: NewProblem = {
  source: "leetcode",
  slug: "contains-duplicate",
  title: "Contains Duplicate",
  difficulty: "Easy",
  tags: ["Array"],
  contentText: "Return true if any value appears at least twice.",
  examples: [
    { input: "nums = [1,2,3,1]", output: "true" },
    { input: "nums = [1,2,3,4]", output: "false" },
  ],
  pythonStub: "class Solution:\n    def containsDuplicate(self, nums: List[int]) -> bool:\n        ",
  isPaid: false,
};

describe("generated puzzles", () => {
  const leetcode = { fetchProblem: async (slug: string) => (slug === "contains-duplicate" ? dupProblem : null) };

  it("fetches, generates once, and keeps only agreed tests", async () => {
    let calls = 0;
    const generator: Generator = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { model: "fake-gemma", candidate: dupCandidate };
    };
    const deps = makeDeps({ leetcode, generator });
    // Two people paste the same link at once.
    const [a, b] = await Promise.all([open(deps, "contains-duplicate"), open(deps, "contains-duplicate")]);
    expect(calls).toBe(1);
    expect(ready(a.body).id).toBe(ready(b.body).id);
    const stored = deps.store.puzzles[0]!;
    expect(stored.model).toBe("fake-gemma");
    expect(stored.content!.tests).toEqual([
      { input: "nums = [1,2,3,1]", expected: "true" },
      { input: "nums = [1,2,3,4]", expected: "false" },
      { input: "nums = [1]", expected: "false" },
      { input: "nums = [5,5]", expected: "true" },
    ]);
  });

  it("skips ahead when the optimized solution is built in the brute-force round", async () => {
    const deps = makeDeps({ leetcode, generator: async () => ({ model: "m", candidate: dupCandidate }) });
    const view = ready((await open(deps, "contains-duplicate", USER)).body);
    const result = await submitAttempt(deps, view.id, { approach: "brute", workspace: solve(view.tray, dupOptimized.blocks) }, USER);
    expect(result).toMatchObject({ passed: true, slowVersion: false, solved: { brute: true, optimized: true } });
  });

  it("calls a passing nested loop in the optimized round the slow version", async () => {
    const deps = makeDeps({ leetcode, generator: async () => ({ model: "m", candidate: dupCandidate }) });
    const id = ready((await open(deps, "contains-duplicate", USER)).body).id;
    const view = ready((await getPuzzleView(deps, id, "optimized", USER)).body);
    const result = await submitAttempt(deps, id, { approach: "optimized", workspace: solve(view.tray, dupBrute.blocks) }, USER);
    expect(result).toMatchObject({ passed: false, slowVersion: true, testsPassed: 4, testsTotal: 4, solved: { optimized: false } });
    expect(deps.store.attempts.at(-1)).toMatchObject({ passed: false, solvesOptimized: false });
  });

  it("marks a candidate that fails an example as failed", async () => {
    const broken = { ...dupCandidate, optimized: { ...dupCandidate.optimized, blocks: finalize("x", [ret(bool(false))]).blocks, requiredBlockIds: ["x1"] } };
    const deps = makeDeps({ leetcode, generator: async () => ({ model: "m", candidate: broken }) });
    const res = await open(deps, "contains-duplicate");
    expect(res.body).toMatchObject({ status: "failed" });
    expect(deps.store.puzzles[0]!.status).toBe("failed");
  });

  it("replaces a pending row abandoned by a crashed request", async () => {
    let now = Date.parse("2026-10-24T12:00:00Z");
    const store = new MemoryStore(() => new Date(now));
    const deps = makeDeps({ store, leetcode, now: () => now, generator: async () => ({ model: "m", candidate: dupCandidate }) });
    const problem = await store.insertProblem(dupProblem);
    await store.insertPuzzle({ problemId: problem.id, model: "pending", status: "pending" });
    now += STALE_PENDING_MS + 1;
    const res = await open(deps, "contains-duplicate");
    expect(res.status).toBe(200);
    expect(store.puzzles.map((p) => p.status)).toEqual(["failed", "ready"]);
  });

  it("caches the problem but answers 501 while no generator is connected", async () => {
    const deps = makeDeps({ leetcode });
    await expect(open(deps, "contains-duplicate")).rejects.toMatchObject({ status: 501 });
    expect(deps.store.problems).toHaveLength(1);
  });

  it("rejects paid problems, bad links, and LeetCode outages", async () => {
    const paid = makeDeps({ leetcode: { fetchProblem: async () => ({ ...dupProblem, isPaid: true }) } });
    await expect(open(paid, "contains-duplicate")).rejects.toMatchObject({ status: 403 });
    await expect(openPuzzle(makeDeps(), { url: "https://example.com/problems/two-sum" }, null)).rejects.toBeInstanceOf(ApiError);
    const down = makeDeps({ leetcode: { fetchProblem: async () => { throw new Error("timeout"); } } });
    await expect(open(down, "some-problem")).rejects.toMatchObject({ status: 502 });
    await expect(open(makeDeps(), "no-such-problem")).rejects.toMatchObject({ status: 404 });
  });
});

describe("route handlers", () => {
  it("serves puzzles and requires a session for progress", async () => {
    const deps = makeDeps();
    setDepsForTesting(deps);
    try {
      const { POST } = await import("@/app/api/puzzles/route");
      const { GET: getPuzzle } = await import("@/app/api/puzzles/[id]/route");
      const { POST: postAttempt } = await import("@/app/api/puzzles/[id]/attempts/route");
      const { GET: getProgress } = await import("@/app/api/me/progress/route");

      const opened = await POST(new Request("http://x/api/puzzles", { method: "POST", body: JSON.stringify({ url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/" }) }));
      expect(opened.status).toBe(200);
      const view = ready(await opened.json());

      const fetched = await getPuzzle(new Request(`http://x/api/puzzles/${view.id}?approach=optimized`), { params: Promise.resolve({ id: view.id }) });
      const optimized = ready(await fetched.json());
      expect(optimized.approach).toBe("optimized");

      const auth = { authorization: "Bearer good" };
      const workspace = solve(optimized.tray, BUNDLED["best-time-to-buy-and-sell-stock"]!.puzzle.optimized.blocks);
      const attempt = await postAttempt(
        new Request(`http://x/api/puzzles/${view.id}/attempts`, { method: "POST", headers: auth, body: JSON.stringify({ approach: "optimized", workspace }) }),
        { params: Promise.resolve({ id: view.id }) },
      );
      expect(await attempt.json()).toMatchObject({ passed: true, saved: true });

      expect((await getProgress(new Request("http://x/api/me/progress"))).status).toBe(401);
      expect((await getProgress(new Request("http://x/api/me/progress", { headers: { authorization: "Bearer bad" } }))).status).toBe(401);
      const progress = await getProgress(new Request("http://x/api/me/progress", { headers: auth }));
      expect(await progress.json()).toMatchObject([{ slug: "best-time-to-buy-and-sell-stock", attemptCount: 1 }]);

      const notJson = await POST(new Request("http://x/api/puzzles", { method: "POST", body: "{" }));
      expect(notJson.status).toBe(400);
      const missing = await getPuzzle(new Request("http://x/api/puzzles/nope"), { params: Promise.resolve({ id: "nope" }) });
      expect(missing.status).toBe(404);
    } finally {
      setDepsForTesting(undefined);
    }
  });
});

describe("leetcode", () => {
  it("parses problem links", () => {
    expect(parseProblemUrl("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
    expect(parseProblemUrl("https://www.leetcode.com/problems/two-sum/description/?envType=x")).toBe("two-sum");
    expect(parseProblemUrl("leetcode.com/problems/two-sum")).toBeNull();
    expect(parseProblemUrl("https://leetcode.com.evil.io/problems/two-sum")).toBeNull();
    expect(parseProblemUrl("https://leetcode.com/problems/../admin")).toBeNull();
  });

  it("turns a GraphQL answer into a problem with examples", () => {
    const content =
      "<p>Given <code>nums</code>, up to 10<sup>4</sup>.</p>" +
      '<p><strong>Example 1:</strong></p><pre><strong>Input:</strong> nums = [2,7,11,15], target = 9\n<strong>Output:</strong> [0,1]</pre>' +
      '<div class="example-block"><p><strong>Output:</strong> <span class="example-io">[1,2]</span></p></div>';
    const p = toProblem("two-sum", {
      title: "Two Sum",
      content,
      difficulty: "Easy",
      isPaidOnly: false,
      exampleTestcases: "[2,7,11,15]\n9\n[3,2,4]\n6",
      topicTags: [{ name: "Array" }],
      codeSnippets: [{ langSlug: "python3", code: "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        " }],
    });
    expect(p.contentText).toContain("10^4");
    expect(p.examples).toEqual([
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ]);
  });

  it("keeps no examples when inputs and outputs do not line up", () => {
    expect(readExamples("Output: 1", "1\n2", "def f(self, a):")).toEqual([]);
  });

  it("stores paid problems without their text", () => {
    const p = toProblem("x", { title: "X", content: null, difficulty: "Hard", isPaidOnly: true, exampleTestcases: null, topicTags: null, codeSnippets: null });
    expect(p).toMatchObject({ isPaid: true, contentText: "" });
  });
});
