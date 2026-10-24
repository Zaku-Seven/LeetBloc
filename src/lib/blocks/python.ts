// Prints a block tree as Python, for learners to read. Display only: this
// text is never executed in production. It is printed from `fields`, never
// from labels, so the Python always matches what the interpreter runs.

import type { BlockNode } from "./catalog";

export interface Stub {
  name: string;
  params: string[];
  // Lines up to and including the `def` line.
  header: string[];
  bodyIndent: string;
}

const DEF_LINE = /^(\s*)def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*(->.*)?:\s*$/;

// Reads the function name and parameter names from LeetCode's Python stub.
export function parseStub(stub: string): Stub {
  const lines = stub.replace(/\r\n/g, "\n").split("\n");
  const defAt = lines.findIndex((l) => DEF_LINE.test(l));
  if (defAt === -1) throw new Error("The Python stub has no def line");
  const [, indent = "", name = "", rawParams = ""] = DEF_LINE.exec(lines[defAt]!)!;
  const params = splitTopLevel(rawParams, ",")
    .map((p) => p.split(":")[0]!.split("=")[0]!.trim())
    .filter((p) => p && p !== "self" && p !== "/" && p !== "*");
  return { name, params, header: lines.slice(0, defAt + 1), bodyIndent: `${indent}    ` };
}

// Splits on a separator, ignoring separators inside brackets and quotes.
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (depth === 0 && text.startsWith(sep, i)) {
      parts.push(text.slice(start, i));
      start = i + sep.length;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

// Precedence, loosely after Python's grammar. Higher binds tighter.
const PREC: Record<string, number> = { or: 1, and: 2, not: 3, compare: 4, "+": 6, "-": 6, "*": 7, "//": 7, "%": 7, atom: 9 };

function precOf(node: BlockNode): number {
  switch (node.type) {
    case "binop":
      return PREC[node.fields?.op ?? "atom"] ?? PREC.atom!;
    case "compare":
    case "in_set":
      return PREC.compare!;
    case "not":
      return PREC.not!;
    case "number":
      return (node.fields?.value as number) < 0 ? PREC["*"]! + 0.5 : PREC.atom!;
    default:
      return PREC.atom!;
  }
}

export function printExpr(node: BlockNode | undefined, minPrec = 0): string {
  if (!node) return "None";
  const text = printExprRaw(node);
  return precOf(node) < minPrec ? `(${text})` : text;
}

function printExprRaw(node: BlockNode): string {
  const f = node.fields ?? {};
  const v = node.values ?? [];
  switch (node.type) {
    case "var":
      return f.name ?? "?";
    case "number":
      return String(f.value);
    case "string":
      return JSON.stringify(f.value ?? "");
    case "bool":
      return f.value ? "True" : "False";
    case "list":
      return `[${v.map((x) => printExpr(x)).join(", ")}]`;
    case "index":
    case "map_get":
      return `${printExpr(v[0], PREC.atom)}[${printExpr(v[1])}]`;
    case "length":
      return `len(${printExpr(node.value)})`;
    case "binop": {
      const p = PREC[f.op ?? "atom"] ?? PREC.atom!;
      // Left-associative: the right side needs parentheses at equal precedence.
      return `${printExpr(v[0], p)} ${f.op} ${printExpr(v[1], p + 1)}`;
    }
    case "compare":
      // Python chains comparisons, so both sides bind tighter than a compare.
      return `${printExpr(v[0], PREC.compare! + 1)} ${f.op} ${printExpr(v[1], PREC.compare! + 1)}`;
    case "in_set":
      return `${printExpr(v[0], PREC.compare! + 1)} ${f.negate ? "not in" : "in"} ${printExpr(v[1], PREC.compare! + 1)}`;
    case "not":
      return `not ${printExpr(node.value, PREC.not)}`;
    case "call":
      if (f.fn === "pop") return `${printExpr(v[0], PREC.atom)}.pop()`;
      if (f.fn === "replace") return `${printExpr(v[0], PREC.atom)}.replace(${printExpr(v[1])}, ${printExpr(v[2])})`;
      return `${f.fn}(${v.map((x) => printExpr(x)).join(", ")})`;
    default:
      return "?";
  }
}

// The one-line Python for a statement, without the trailing colon on
// blocks that open a nested stack. Suitable as a block label.
export function printStatementLine(node: BlockNode): string {
  const f = node.fields ?? {};
  const v = node.values ?? [];
  switch (node.type) {
    case "create":
      if (f.kind === "list") return `${f.name} = []`;
      if (f.kind === "set") return `${f.name} = set()`;
      if (f.kind === "map") return `${f.name} = {}`;
      return `${f.name} = ${node.value ? printExpr(node.value) : "0"}`;
    case "assign":
      return `${f.name} = ${printExpr(node.value)}`;
    case "append":
      return `${f.name}.append(${printExpr(node.value)})`;
    case "map_set":
      return `${f.name}[${printExpr(v[0])}] = ${printExpr(v[1])}`;
    case "set_add":
      return `${f.name}.add(${printExpr(node.value)})`;
    case "for_index": {
      const start = v[0];
      const range = start?.type === "number" && start.fields?.value === 0 ? printExpr(v[1]) : `${printExpr(start)}, ${printExpr(v[1])}`;
      return `for ${f.name} in range(${range})`;
    }
    case "for_each":
      return `for ${f.name} in ${printExpr(node.value)}`;
    case "while":
      return `while ${printExpr(node.value)}`;
    case "if":
      return `if ${printExpr(node.value)}`;
    case "else":
      return "else";
    case "return":
      return node.value ? `return ${printExpr(node.value)}` : "return";
    default:
      return printExpr(node);
  }
}

const OPENS_STACK = new Set(["for_index", "for_each", "while", "if", "else"]);

export function printStack(stack: BlockNode[], indent: string): string[] {
  if (stack.length === 0) return [`${indent}pass`];
  const lines: string[] = [];
  for (const node of stack) {
    const line = printStatementLine(node);
    if (OPENS_STACK.has(node.type)) {
      lines.push(`${indent}${line}:`);
      lines.push(...printStack(node.children ?? [], `${indent}    `));
    } else lines.push(`${indent}${line}`);
  }
  return lines;
}

// The whole function: LeetCode's header lines, then the body.
export function printProgram(body: BlockNode[], stub: string): string {
  const s = parseStub(stub);
  return [...s.header.map((l) => l.trimEnd()), ...printStack(body, s.bodyIndent)].join("\n");
}
