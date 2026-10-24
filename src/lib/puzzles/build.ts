// Small constructors for writing block trees by hand (the bundled puzzles
// and tests). `finalize` assigns ids and prints each label from the fields.

import type { BinOp, BlockNode, CallFn, CompareOp, CreateKind } from "../blocks/catalog";
import { printExpr, printStatementLine } from "../blocks/python";

type Node = BlockNode;

const node = (type: Node["type"], extra: Partial<Node> = {}): Node => ({ id: "", type, label: "", ...extra });

export const v = (name: string) => node("var", { fields: { name } });
export const num = (value: number) => node("number", { fields: { value } });
export const str = (value: string) => node("string", { fields: { value } });
export const bool = (value: boolean) => node("bool", { fields: { value } });
export const list = (...items: Node[]) => node("list", { values: items });
export const idx = (target: Node, i: Node) => node("index", { values: [target, i] });
export const get = (map: Node, key: Node) => node("map_get", { values: [map, key] });
export const len = (of: Node) => node("length", { value: of });
export const bin = (left: Node, op: BinOp, right: Node) => node("binop", { fields: { op }, values: [left, right] });
export const cmp = (left: Node, op: CompareOp, right: Node) => node("compare", { fields: { op }, values: [left, right] });
export const has = (collection: Node, item: Node, negate = false) =>
  node("in_set", { fields: negate ? { negate } : {}, values: [item, collection] });
export const not = (value: Node) => node("not", { value });
export const call = (fn: CallFn, ...args: Node[]) => node("call", { fields: { fn }, values: args });

export const create = (name: string, kind: CreateKind, value?: Node) =>
  node("create", { fields: { name, kind }, ...(value ? { value } : {}) });
export const assign = (name: string, value: Node) => node("assign", { fields: { name }, value });
export const append = (name: string, value: Node) => node("append", { fields: { name }, value });
export const mapSet = (name: string, key: Node, value: Node) => node("map_set", { fields: { name }, values: [key, value] });
export const setAdd = (name: string, value: Node) => node("set_add", { fields: { name }, value });
export const forIndex = (name: string, start: Node, stop: Node, children: Node[]) =>
  node("for_index", { fields: { name }, values: [start, stop], children });
export const forEach = (name: string, iterable: Node, children: Node[]) =>
  node("for_each", { fields: { name }, value: iterable, children });
export const whileLoop = (cond: Node, children: Node[]) => node("while", { value: cond, children });
export const ifBlock = (cond: Node, children: Node[]) => node("if", { value: cond, children });
export const elseBlock = (children: Node[]) => node("else", { children });
export const ret = (value?: Node) => node("return", value ? { value } : {});

// Attaches a hint to a statement.
export const hint = (text: string, n: Node): Node => ({ ...n, hint: text });

// Marks a node as required for the optimized round.
export const required = (n: Node): Node => ({ ...n, [REQUIRED]: true }) as Node;
const REQUIRED = Symbol("required");

// Gives every node an id (`prefix1`, `prefix2`, ...) and a label printed from
// its fields, and collects the ids of nodes marked `required`.
export function finalize(prefix: string, blocks: Node[]): { blocks: Node[]; requiredBlockIds: string[] } {
  let counter = 0;
  const requiredBlockIds: string[] = [];
  const go = (n: Node, statement: boolean): Node => {
    const id = `${prefix}${++counter}`;
    const { [REQUIRED]: isRequired, ...rest } = n as Node & { [REQUIRED]?: boolean };
    if (isRequired) requiredBlockIds.push(id);
    const out: Node = { ...rest, id, label: statement ? printStatementLine(n) : printExpr(n) };
    if (n.value) out.value = go(n.value, false);
    if (n.values) out.values = n.values.map((x) => go(x, false));
    if (n.children) out.children = n.children.map((x) => go(x, true));
    return out;
  };
  return { blocks: blocks.map((b) => go(b, true)), requiredBlockIds };
}
