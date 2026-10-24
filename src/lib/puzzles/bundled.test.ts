import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../blocks/literals";
import { parseStub, printProgram } from "../blocks/python";
import { formatValue } from "../blocks/values";
import { BUNDLED } from "./bundled";
import { findNodes, hasRequired, runTests } from "./tests";
import { verifyPuzzle } from "./verify";

const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe.each(Object.values(BUNDLED))("bundled $problem.slug", ({ problem, puzzle }) => {
  const verified = verifyPuzzle(problem, puzzle);

  it("passes verification", () => {
    expect(verified).toMatchObject({ ok: true });
  });

  it("keeps every extra test, since both solutions agree", () => {
    if (!verified.ok) throw new Error(verified.errors.join("\n"));
    expect(verified.content.tests).toHaveLength(problem.examples.length + puzzle.extraTests.length);
    // The hand-written expected values match what both solutions return.
    for (const t of puzzle.extraTests) {
      expect(verified.content.tests.find((x) => x.input === t.input)?.expected).toBe(t.expected);
    }
  });

  it("passes all tests with both solutions", () => {
    if (!verified.ok) throw new Error(verified.errors.join("\n"));
    const { params } = parseStub(problem.pythonStub);
    for (const approach of ["brute", "optimized"] as const) {
      const r = runTests(puzzle[approach].blocks, params, verified.content.tests);
      expect(r.firstFailure).toBeUndefined();
    }
  });

  it("requires blocks that the brute-force solution does not have", () => {
    const required = findNodes(puzzle.optimized.blocks, puzzle.optimized.requiredBlockIds);
    expect(required.length).toBeGreaterThan(0);
    expect(hasRequired(puzzle.optimized.blocks, required)).toBe(true);
    expect(hasRequired(puzzle.brute.blocks, required)).toBe(false);
  });

  // The printed Python is display-only, but real Python must agree with the
  // interpreter on every test. This is the check that the interpreter
  // behaves like Python.
  it.skipIf(!hasPython)("prints Python that real Python agrees with", () => {
    if (!verified.ok) throw new Error(verified.errors.join("\n"));
    const { name, params } = parseStub(problem.pythonStub);
    for (const approach of ["brute", "optimized"] as const) {
      const program = printProgram(puzzle[approach].blocks, problem.pythonStub);
      const calls = verified.content.tests.map((t) => {
        const args = parseArgs(t.input, params).map(formatValue).join(", ");
        return `print(json.dumps(Solution().${name}(*json.loads('[${args.replace(/'/g, "\\'")}]')), separators=(",", ":")))`;
      });
      const script = ["import json", "from typing import *", program, ...calls].join("\n");
      const out = execFileSync("python3", ["-I", "-c", script], { encoding: "utf8" }).trim().split("\n");
      expect(out).toEqual(verified.content.tests.map((t) => t.expected));
    }
  });
});
