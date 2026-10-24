import { describe, expect, it } from "vitest";
import { BUNDLED } from "../puzzles/bundled";
import { gemmaGenerator } from "../server/gemma-generator";
import { openPuzzle } from "../server/service";
import { MemoryStore } from "../server/store-memory";
import type { CallGemmaOptions } from "./client";
import { DEFAULT_MODEL, withRetry } from "./client";
import { CALL_BUDGET_MS, generatePuzzle } from "./generate";
import { buildSystemInstruction, buildUserPrompt } from "./prompt";
import { ALL_BLOCK_TYPES, type ProblemInput } from "./types";
import { parseLenientJson, validateResponse } from "./validate";

const twoSum = BUNDLED["two-sum"]!;
const problem: ProblemInput = { ...twoSum.problem };
const goodJson = JSON.stringify(twoSum.puzzle);

// What the original label-only prompt asked for: no fields, so nothing can run.
const labelOnly = JSON.stringify({
  brute: { plan: "p", complexity: "O(n²)", requiredBlockIds: [], blocks: [{ id: "b1", type: "return", label: "return [0, 1]" }] },
  optimized: { plan: "p", complexity: "O(n)", requiredBlockIds: ["o1"], blocks: [{ id: "o1", type: "create", label: "seen = {}" }] },
  distractors: [],
  extraTests: [{ input: "nums = [1,2], target = 3", expected: "[0,1]" }],
});

function fakeCall(...responses: string[]) {
  const calls: CallGemmaOptions[] = [];
  const call = async (opts: CallGemmaOptions) => {
    calls.push(opts);
    const next = responses.shift();
    if (next === undefined) throw new Error("unexpected Gemma call");
    return next;
  };
  return { call, calls };
}

describe("prompt", () => {
  it("documents every block type and teaches with an example that validates", () => {
    const system = buildSystemInstruction();
    for (const type of ALL_BLOCK_TYPES) expect(system).toMatch(new RegExp(`\\n- ${type}\\s`));
    const example = system.slice(system.indexOf("## Example (Two Sum)") + 21, system.indexOf("## Output format")).trim();
    expect(validateResponse(example, problem)).toMatchObject({ ok: true, errors: [] });
  });

  it("lists the parameters the solution may read", () => {
    expect(buildUserPrompt(problem)).toContain("**Parameters you can read:** nums, target");
  });
});

describe("validateResponse", () => {
  it("accepts a fenced response and returns the agreed tests", () => {
    const result = validateResponse("Here you go:\n```json\n" + goodJson + "\n```", problem);
    expect(result.ok).toBe(true);
    expect(result.content!.tests).toHaveLength(6);
  });

  it("names the block and slot that is wrong", () => {
    const result = validateResponse(labelOnly, problem);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "optimized.blocks[0].fields: create needs fields.name, a plain identifier",
      "optimized.blocks[0].fields: create needs fields.kind: list, set, map, number",
    ]);
  });

  it("reports a solution that returns the wrong answer", () => {
    const wrong = structuredClone(twoSum.puzzle);
    // Optimized returns [i, i] instead of [seen[complement], i].
    const ret = wrong.optimized.blocks[1]!.children![1]!.children![0]!;
    ret.value!.values![0] = { id: "zz", type: "var", label: "i", fields: { name: "i" } };
    const result = validateResponse(JSON.stringify(wrong), problem);
    expect(result.errors).toEqual([
      "example 1: optimized returned [1,1], expected [0,1]",
      "example 2: optimized returned [2,2], expected [1,2]",
      "example 3: optimized returned [1,1], expected [0,1]",
    ]);
  });
});

describe("parseLenientJson", () => {
  it("fixes trailing commas, comments, and Python literals outside strings", () => {
    const text = `{
      // a comment
      "a": [1, 2,],
      "b": {"value": True, "none": None, /* note */ "c": False,},
      "s": "True, False, None, // stays, ],"
    }`;
    expect(parseLenientJson(text)).toEqual({ a: [1, 2], b: { value: true, none: null, c: false }, s: "True, False, None, // stays, ]," });
  });

  it("leaves names that only start with True alone, and still rejects broken JSON", () => {
    expect(() => parseLenientJson('{"a": Truest}')).toThrow();
    expect(() => parseLenientJson('{"a": [1, 2}')).toThrow();
  });

  it("repairs a block closed one brace too early", () => {
    // What Gemma wrote: the for_each closes before its "children".
    const slip = '{"blocks":[{"id":"a","type":"for_each","value":{"id":"b","fields":{"name":"nums"}}},"children":[{"id":"c"}]}]}';
    expect(parseLenientJson(slip)).toEqual({ blocks: [{ id: "a", type: "for_each", value: { id: "b", fields: { name: "nums" } }, children: [{ id: "c" }] }] });
  });

  it("repairs the same slip inside a full puzzle, and the puzzle still verifies", () => {
    const pretty = JSON.stringify(twoSum.puzzle);
    // Add a stray } before the optimized loop's children, then drop the final } as the
    // depth-matching extractor would.
    const at = pretty.indexOf(',"children"', pretty.indexOf('"id":"ts_o2"'));
    const slip = pretty.slice(0, at) + "}" + pretty.slice(at);
    expect(() => JSON.parse(slip)).toThrow();
    // The model's ending may be balanced by its own count (one } too many) or by the
    // real structure (one short after the repair). Both must come out right.
    expect(validateResponse(slip, problem)).toMatchObject({ ok: true });
    expect(validateResponse(slip.slice(0, -1), problem)).toMatchObject({ ok: true });
  });

  it("points at the mistake", () => {
    const broken = goodJson.replace('"plan":', '"plan" ');
    const result = validateResponse(broken, problem);
    expect(result.errors[0]).toMatch(/^Invalid JSON at line 1, character \d+ .*⟨HERE⟩/);
  });
});

describe("generatePuzzle", () => {
  it("makes one call, with the default model and default thinking", async () => {
    const { call, calls } = fakeCall(goodJson);
    const result = await generatePuzzle(problem, call);
    expect(result).toMatchObject({ status: "ready", model: DEFAULT_MODEL, errors: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ model: DEFAULT_MODEL, thinkingLevel: null, timeoutMs: CALL_BUDGET_MS });
  });

  it("fixes JSON slips locally instead of calling again", async () => {
    const at = goodJson.indexOf(',"children"', goodJson.indexOf('"id":"ts_o2"'));
    const slipped = goodJson.slice(0, at) + "}" + goodJson.slice(at).replace(/"value":true/g, '"value":True') + ",";
    const { call, calls } = fakeCall(slipped);
    expect(await generatePuzzle(problem, call)).toMatchObject({ status: "ready" });
    expect(calls).toHaveLength(1);
  });

  it("fails without a second call when the answer is wrong", async () => {
    const { call, calls } = fakeCall(labelOnly);
    const result = await generatePuzzle(problem, call);
    expect(result).toMatchObject({ status: "failed", content: null });
    expect(result.errors[0]).toContain("create needs fields.name");
    expect(calls).toHaveLength(1);
  });

  it("reports an API error instead of throwing", async () => {
    const call = async () => {
      throw Object.assign(new Error("Internal error encountered."), { status: 500 });
    };
    const result = await generatePuzzle(problem, call);
    expect(result).toMatchObject({ status: "failed", errors: [`${DEFAULT_MODEL}: Internal error encountered.`] });
    expect(result.debug.calls).toMatchObject([{ model: DEFAULT_MODEL, thinking: "default", ok: false }]);
  });

  it("does not retry a rate limit, and says how long to wait", async () => {
    let tries = 0;
    const quota = () => {
      tries++;
      return Promise.reject(Object.assign(new Error("Quota exceeded ... Please retry in 50.28s."), { status: 429 }));
    };
    await expect(withRetry(quota, 0)).rejects.toThrow("Gemma's free-tier rate limit was reached. Try again in about 51 seconds.");
    expect(tries).toBe(1);
  });

  it("retries a 500 once", async () => {
    let tries = 0;
    const flaky = () => (++tries === 1 ? Promise.reject(Object.assign(new Error("INTERNAL"), { status: 500 })) : Promise.resolve("ok"));
    await expect(withRetry(flaky, 0)).resolves.toBe("ok");
    expect(tries).toBe(2);
  });
});

describe("puzzles route with Gemma", () => {
  // A LeetCode problem that is not bundled, so it goes through generation.
  const fetched = { ...twoSum.problem, slug: "two-sum-again", source: "leetcode" as const, isPaid: false };
  const deps = (call: (o: CallGemmaOptions) => Promise<string>) => ({
    store: new MemoryStore(),
    leetcode: { fetchProblem: async () => fetched },
    trayIdSecret: "test-secret-test-secret-test-secret",
    generator: gemmaGenerator(call),
  });

  it("generates, verifies, and stores a puzzle for a pasted link", async () => {
    const d = deps(fakeCall(goodJson).call);
    const res = await openPuzzle(d, { url: "https://leetcode.com/problems/two-sum-again/" }, null);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ready", problem: { slug: "two-sum-again" } });
    expect(d.store.puzzles[0]).toMatchObject({ status: "ready", model: DEFAULT_MODEL });
  });

  it("marks the puzzle failed when Gemma cannot produce a valid one", async () => {
    const d = deps(fakeCall(labelOnly).call);
    const res = await openPuzzle(d, { url: "https://leetcode.com/problems/two-sum-again/" }, null);
    expect(res.body).toMatchObject({ status: "failed" });
    expect(d.store.puzzles[0]!.status).toBe("failed");
  });
});
