// Decides whether a generated (or hand-written) puzzle is safe to store:
// every block is in the catalog, names are on the allowlist, both solutions
// pass the statement examples, and extra tests survive only when both
// solutions agree on them. DESIGN.md, "How a puzzle gets its tests".

import { checkNames, checkTree, type BlockNode, type TestCase } from "../blocks/catalog";
import { run } from "../blocks/interpreter";
import { LiteralError, parseArgs, parseLiteral } from "../blocks/literals";
import { parseStub } from "../blocks/python";
import { formatValue, pyEq } from "../blocks/values";
import { nodesIn } from "../blocks/workspace";
import { findNodes, hasRequired } from "./tests";
import type { Example, PuzzleCandidate, PuzzleContent } from "./types";

export const MIN_TESTS = 3;

export type VerifyResult = { ok: true; content: PuzzleContent } | { ok: false; errors: string[] };

export function verifyPuzzle(problem: { pythonStub: string; examples: Example[] }, c: PuzzleCandidate): VerifyResult {
  let params: string[];
  try {
    params = parseStub(problem.pythonStub).params;
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }

  const errors = [
    ...checkTree(c.brute.blocks, "brute.blocks"),
    ...checkTree(c.optimized.blocks, "optimized.blocks"),
    ...c.distractors.flatMap((d, i) =>
      (d as Partial<BlockNode> | null)?.type === "else"
        ? [`distractors[${i}]: an else cannot be a distractor`]
        : checkTree([d], `distractors[${i}]`),
    ),
  ];
  if (errors.length > 0) return { ok: false, errors };

  const everything = [...c.brute.blocks, ...c.optimized.blocks, ...c.distractors];
  const all = nodesIn(everything);
  const seen = new Set<string>();
  for (const n of all) {
    if (seen.has(n.id)) errors.push(`duplicate block id "${n.id}"`);
    seen.add(n.id);
  }

  errors.push(...checkNames(c.brute.blocks, params).map((e) => `brute: ${e}`));
  errors.push(...checkNames(c.optimized.blocks, params).map((e) => `optimized: ${e}`));
  // A distractor may use names from either solution.
  const distractorIds = new Set(nodesIn(c.distractors).map((n) => n.id));
  errors.push(
    ...checkNames(everything, params).filter((e) => distractorIds.has(/^block (\S+):/.exec(e)?.[1] ?? "")),
  );

  for (const approach of ["brute", "optimized"] as const) {
    const graph = c[approach];
    if (graph.blocks.length === 0) errors.push(`${approach} has no blocks`);
    const ids = new Set(nodesIn(graph.blocks).map((n) => n.id));
    for (const id of graph.requiredBlockIds) {
      if (!ids.has(id)) errors.push(`${approach}.requiredBlockIds: "${id}" is not in ${approach}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const required = findNodes(c.optimized.blocks, c.optimized.requiredBlockIds);
  if (required.length > 0 && hasRequired(c.brute.blocks, required)) {
    errors.push("the brute-force solution already contains every optimized required block, so the optimized round cannot tell them apart");
  }

  // Statement examples are the anchor: both solutions must match them exactly.
  const tests: TestCase[] = [];
  if (problem.examples.length === 0) errors.push("the problem has no examples to check against");
  problem.examples.forEach((ex, i) => {
    const outcome = check(c, params, ex.input, ex.output);
    if (typeof outcome === "string") errors.push(`example ${i + 1}: ${outcome}`);
    else tests.push({ input: ex.input, expected: formatValue(parseLiteral(ex.output)) });
  });
  if (errors.length > 0) return { ok: false, errors };

  // Extra cases: kept only when both solutions run and agree. The agreed
  // output becomes the expected value, never the generator's claim.
  const inputs = new Set(tests.map((t) => t.input));
  for (const t of c.extraTests) {
    if (inputs.has(t.input)) continue;
    let args;
    try {
      args = parseArgs(t.input, params);
    } catch {
      continue;
    }
    const a = run(c.brute.blocks, params, args);
    const b = run(c.optimized.blocks, params, args);
    if (a.ok && b.ok && pyEq(a.value, b.value)) {
      tests.push({ input: t.input, expected: formatValue(a.value) });
      inputs.add(t.input);
    }
  }

  if (tests.length < MIN_TESTS) {
    return { ok: false, errors: [`only ${tests.length} tests survived; at least ${MIN_TESTS} are needed`] };
  }
  return { ok: true, content: { brute: c.brute, optimized: c.optimized, distractors: c.distractors, tests } };
}

// Runs both solutions on one example. Returns an error message, or true.
function check(c: PuzzleCandidate, params: string[], input: string, output: string): string | true {
  let args;
  let expected;
  try {
    args = parseArgs(input, params);
    expected = parseLiteral(output);
  } catch (e) {
    if (e instanceof LiteralError) return `could not read the example: ${e.message}`;
    throw e;
  }
  for (const approach of ["brute", "optimized"] as const) {
    const r = run(c[approach].blocks as BlockNode[], params, args);
    if (!r.ok) return `${approach} failed: ${r.error}`;
    if (!pyEq(r.value, expected)) return `${approach} returned ${formatValue(r.value)}, expected ${formatValue(expected)}`;
  }
  return true;
}
