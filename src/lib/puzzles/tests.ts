import { signature, type BlockNode, type TestCase } from "../blocks/catalog";
import { run } from "../blocks/interpreter";
import { parseArgs, parseLiteral } from "../blocks/literals";
import { formatValue, pyEq } from "../blocks/values";
import { nodesIn } from "../blocks/workspace";

export interface Failure {
  input: string;
  expected: string;
  actual?: string;
  error?: string;
}

export interface TestRun {
  passed: number;
  total: number;
  firstFailure?: Failure;
}

export function runTests(body: BlockNode[], params: string[], tests: TestCase[]): TestRun {
  let passed = 0;
  let firstFailure: Failure | undefined;
  for (const t of tests) {
    const result = run(body, params, parseArgs(t.input, params));
    const expected = parseLiteral(t.expected);
    if (result.ok && pyEq(result.value, expected)) {
      passed++;
      continue;
    }
    firstFailure ??= result.ok
      ? { input: t.input, expected: formatValue(expected), actual: formatValue(result.value) }
      : { input: t.input, expected: formatValue(expected), error: result.error };
  }
  return { passed, total: tests.length, ...(firstFailure ? { firstFailure } : {}) };
}

// True when every required node is present somewhere in the body. Matching is
// by what a node does (its signature), not its id, so it works across rounds.
export function hasRequired(body: BlockNode[], required: BlockNode[]): boolean {
  const present = new Set(nodesIn(body).map(signature));
  return required.every((r) => present.has(signature(r)));
}

export function findNodes(blocks: BlockNode[], ids: string[]): BlockNode[] {
  const wanted = new Set(ids);
  return nodesIn(blocks).filter((n) => wanted.has(n.id));
}
