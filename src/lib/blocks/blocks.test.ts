import { describe, expect, it } from "vitest";
import {
  assign, bin, call, cmp, create, elseBlock, finalize, forEach, has, idx, ifBlock, mapSet, num, ret, str, v, whileLoop,
} from "../puzzles/build";
import { checkNames, checkTree, signature } from "./catalog";
import { run } from "./interpreter";
import { parseArgs, parseLiteral } from "./literals";
import { parseStub, printProgram } from "./python";
import { PyList, formatValue, pyEq, type Value } from "./values";
import { assemble } from "./workspace";

const evalExpr = (expr: ReturnType<typeof v>, params: string[] = [], args: Value[] = []) => {
  const r = run(finalize("t", [ret(expr)]).blocks, params, args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("interpreter follows Python", () => {
  it("floors // toward negative infinity and gives % the divisor's sign", () => {
    expect(evalExpr(bin(num(-7), "//", num(2)))).toBe(-4);
    expect(evalExpr(bin(num(7), "//", num(-2)))).toBe(-4);
    expect(evalExpr(bin(num(-7), "%", num(3)))).toBe(2);
    expect(evalExpr(bin(num(7), "%", num(-3)))).toBe(-2);
  });

  it("supports negative indexes and reports out-of-range ones", () => {
    expect(evalExpr(idx(v("xs"), num(-1)), ["xs"], [new PyList([1, 2, 3])])).toBe(3);
    const r = run(finalize("t", [ret(idx(v("xs"), num(5)))]).blocks, ["xs"], [new PyList([1])]);
    expect(r).toMatchObject({ ok: false, error: "IndexError: list index out of range" });
  });

  it("returns operands from and / or, like Python", () => {
    expect(evalExpr(bin(num(0), "or", num(5)))).toBe(5);
    expect(evalExpr(bin(num(3), "and", num(0)))).toBe(0);
  });

  it("compares lists by value", () => {
    expect(pyEq(parseLiteral("[0,1]"), parseLiteral("[0, 1]"))).toBe(true);
    expect(pyEq(parseLiteral("[0,1]"), parseLiteral("[1,0]"))).toBe(false);
    expect(pyEq(true, 1)).toBe(true);
  });

  it("raises KeyError and NameError", () => {
    const body = finalize("t", [create("m", "map"), ret(idx(v("m"), num(3)))]).blocks;
    expect(run(body, [], [])).toMatchObject({ ok: false, error: "KeyError: 3" });
    expect(run(finalize("t", [ret(v("nope"))]).blocks, [], [])).toMatchObject({ ok: false, error: "NameError: name 'nope' is not defined" });
  });

  it("stops a loop that never ends", () => {
    const body = finalize("t", [create("i", "number"), whileLoop(cmp(v("i"), "<", num(1)), [])]).blocks;
    expect(run(body, [], [], { maxSteps: 10_000, maxSize: 100 })).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("stops a collection that grows without bound", () => {
    const body = finalize("t", [create("m", "map"), create("i", "number"), whileLoop(cmp(num(1), "==", num(1)), [mapSet("m", v("i"), v("i")), assign("i", bin(v("i"), "+", num(1)))])]).blocks;
    expect(run(body, [], [], { maxSteps: 1_000_000, maxSize: 50 })).toMatchObject({ ok: false, error: expect.stringContaining("MemoryError") });
  });

  it("runs else only when the if before it did not", () => {
    const body = finalize("t", [
      create("n", "number"),
      ifBlock(cmp(v("x"), ">", num(0)), [assign("n", num(1))]),
      elseBlock([assign("n", num(2))]),
      ret(v("n")),
    ]).blocks;
    expect(run(body, ["x"], [5])).toMatchObject({ ok: true, value: 1 });
    expect(run(body, ["x"], [-5])).toMatchObject({ ok: true, value: 2 });
  });

  it("walks strings and supports replace and pop", () => {
    const body = finalize("t", [create("out", "list"), forEach("c", v("s"), [ifBlock(has(str("ab"), v("c")), [])]), ret(call("replace", v("s"), str("a"), str("")))]).blocks;
    expect(run(body, ["s"], ["banana"])).toMatchObject({ ok: true, value: "bnn" });
  });
});

describe("literals", () => {
  it("reads named and positional arguments", () => {
    const params = ["nums", "target"];
    expect(parseArgs("nums = [2,7,11,15], target = 9", params).map(formatValue)).toEqual(["[2,7,11,15]", "9"]);
    expect(parseArgs("[2,7], 9", params).map(formatValue)).toEqual(["[2,7]", "9"]);
    expect(parseArgs('s = "(,)"', ["s"])).toEqual(["(,)"]);
  });

  it("accepts Python and JSON spellings", () => {
    expect(parseLiteral("True")).toBe(true);
    expect(parseLiteral("false")).toBe(false);
    expect(parseLiteral("None")).toBe(null);
    expect(parseLiteral("'x'")).toBe("x");
  });

  it("rejects anything that is not a literal", () => {
    expect(() => parseLiteral("__import__('os')")).toThrow();
    expect(() => parseArgs("nums = len(x)", ["nums"])).toThrow();
  });
});

describe("catalog checks", () => {
  it("rejects unknown types, missing fields, and misplaced else", () => {
    const errors = checkTree([
      { id: "a", type: "eval", label: "x" },
      { id: "b", type: "assign", label: "x = 1", value: { id: "c", type: "number", label: "1", fields: { value: 1 } } },
      { id: "d", type: "else", label: "else" },
    ]);
    expect(errors).toEqual([
      'blocks[0]: unknown block type "eval"',
      "blocks[1].fields: assign needs fields.name, a plain identifier",
      "blocks[2]: else must come directly after an if",
    ]);
  });

  it("rejects names that are not parameters or defined by a block", () => {
    const blocks = finalize("t", [assign("x", v("secret")), ret(v("x"))]).blocks;
    expect(checkNames(blocks, ["nums"])).toEqual(['block t2: unknown name "secret"']);
  });

  it("matches signatures by content, not id or label", () => {
    const [a] = finalize("a", [assign("x", num(1))]).blocks;
    const [b] = finalize("b", [{ ...assign("x", num(1)), label: "something else" }]).blocks;
    expect(signature(a!)).toBe(signature(b!));
  });
});

describe("workspace assembly", () => {
  const tray = new Map(finalize("t", [ifBlock(cmp(v("x"), ">", num(0)), []), ret(num(1))]).blocks.map((b) => [b.id, b]));

  it("nests placed blocks", () => {
    const body = assemble(tray, { blocks: [{ id: "t1", children: [{ id: "t5" }] }] });
    expect(body[0]!.children![0]!.type).toBe("return");
  });

  it("rejects unknown and reused blocks", () => {
    expect(() => assemble(tray, { blocks: [{ id: "zzz" }] })).toThrow("not in this tray");
    expect(() => assemble(tray, { blocks: [{ id: "t5" }, { id: "t5" }] })).toThrow("placed twice");
    expect(() => assemble(tray, { blocks: [{ id: "t5", children: [{ id: "t1" }] }] })).toThrow("Nothing can be nested");
  });
});

describe("python printer", () => {
  it("reads the stub", () => {
    expect(parseStub("class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        ")).toMatchObject({
      name: "twoSum",
      params: ["nums", "target"],
      bodyIndent: "        ",
    });
    expect(parseStub("def f(self, grid: Dict[str, int], k: int = 3) -> int:").params).toEqual(["grid", "k"]);
  });

  it("prints nesting, elif-free else, and parentheses where needed", () => {
    const body = finalize("t", [
      ifBlock(cmp(bin(v("a"), "-", bin(v("b"), "-", v("c"))), "==", num(0)), [ret(str("x"))]),
      elseBlock([]),
    ]).blocks;
    expect(printProgram(body, "def f(self, a, b, c):")).toBe(
      ["def f(self, a, b, c):", "    if a - (b - c) == 0:", '        return "x"', "    else:", "        pass"].join("\n"),
    );
  });
});
