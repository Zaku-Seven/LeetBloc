// The executable block catalog. A puzzle's blocks are a tree in the same
// shape the Gemma layer produces (`id`, `type`, `label`, `value`, `values`,
// `children`), plus `fields`: the structured settings (a name, an operator,
// a literal) that make a block runnable. `label` is display text only. The
// interpreter and the Python printer never read it.
//
// This module has no server dependencies, so the frontend can import it.

export const BIN_OPS = ["+", "-", "*", "//", "%", "and", "or"] as const;
export const COMPARE_OPS = ["<", "<=", ">", ">=", "==", "!=", "in", "not in"] as const;
export const CREATE_KINDS = ["list", "set", "map", "number"] as const;
// Functions a `call` block may name, with [min, max] argument counts.
export const CALL_FNS = {
  min: [1, 4],
  max: [1, 4],
  abs: [1, 1],
  sorted: [1, 1],
  pop: [1, 1],
  replace: [3, 3],
} as const;

export type BinOp = (typeof BIN_OPS)[number];
export type CompareOp = (typeof COMPARE_OPS)[number];
export type CreateKind = (typeof CREATE_KINDS)[number];
export type CallFn = keyof typeof CALL_FNS;

export const STATEMENT_TYPES = [
  "create", "assign", "append", "map_set", "set_add",
  "for_index", "for_each", "while", "if", "else", "return",
] as const;
export const VALUE_TYPES = [
  "var", "number", "string", "bool", "list", "index", "map_get",
  "length", "binop", "compare", "in_set", "not", "call",
] as const;

export type StatementType = (typeof STATEMENT_TYPES)[number];
export type ValueType = (typeof VALUE_TYPES)[number];
export type BlockType = StatementType | ValueType;

export interface Fields {
  name?: string;
  kind?: CreateKind;
  op?: BinOp | CompareOp;
  fn?: CallFn;
  value?: number | string | boolean;
  negate?: boolean;
}

export interface BlockNode {
  id: string;
  type: BlockType;
  label: string;
  // One-line nudge shown when the block is focused in the tray.
  hint?: string;
  fields?: Fields;
  value?: BlockNode;
  values?: BlockNode[];
  children?: BlockNode[];
}

// The canonical solution for one round, as stored in `puzzles.brute` / `puzzles.optimized`.
export interface ApproachGraph {
  plan: string;
  complexity: string;
  blocks: BlockNode[];
  requiredBlockIds: string[];
}

export interface TestCase {
  input: string;
  expected: string;
}

// What each block type takes. `value` is one child value, `values` a fixed
// (or bounded) list of child values, `children` a nested statement stack.
interface Spec {
  statement: boolean;
  name?: boolean;
  value?: "required" | "optional";
  values?: [number, number];
  children?: boolean;
}

export const SPECS: Record<BlockType, Spec> = {
  create: { statement: true, name: true, value: "optional" },
  assign: { statement: true, name: true, value: "required" },
  append: { statement: true, name: true, value: "required" },
  map_set: { statement: true, name: true, values: [2, 2] }, // key, value
  set_add: { statement: true, name: true, value: "required" },
  for_index: { statement: true, name: true, values: [2, 2], children: true }, // start, stop (exclusive)
  for_each: { statement: true, name: true, value: "required", children: true },
  while: { statement: true, value: "required", children: true },
  if: { statement: true, value: "required", children: true },
  else: { statement: true, children: true },
  return: { statement: true, value: "optional" },

  var: { statement: false, name: true },
  number: { statement: false },
  string: { statement: false },
  bool: { statement: false },
  list: { statement: false, values: [0, 10] },
  index: { statement: false, values: [2, 2] }, // target, index
  map_get: { statement: false, values: [2, 2] }, // map, key
  length: { statement: false, value: "required" },
  binop: { statement: false, values: [2, 2] },
  compare: { statement: false, values: [2, 2] },
  in_set: { statement: false, values: [2, 2] }, // item, collection
  not: { statement: false, value: "required" },
  call: { statement: false, values: [1, 4] },
};

export const IDENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
export const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Names that would collide with Python syntax or with what the printer emits.
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
  "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
  "self", "len", "range", "set", "list", "dict", "min", "max", "abs", "sorted", "print", "int", "str", "bool",
  "Solution", "List", "Optional", "Dict", "json",
]);

export const LIMITS = {
  maxNodes: 400,
  maxDepth: 16,
  maxLabel: 200,
  maxString: 100,
};

export function isStatement(type: string): type is StatementType {
  return (STATEMENT_TYPES as readonly string[]).includes(type);
}

export function isValue(type: string): type is ValueType {
  return (VALUE_TYPES as readonly string[]).includes(type);
}

// Checks one tree against the catalog: known types, statements and values
// in the right slots, the right fields, the right number of children, and
// `else` only directly after an `if`. Returns a list of errors with paths.
export function checkTree(blocks: unknown, path = "blocks"): string[] {
  const errors: string[] = [];
  let nodes = 0;

  const fail = (p: string, msg: string) => {
    if (errors.length < 50) errors.push(`${p}: ${msg}`);
  };

  function checkNode(raw: unknown, p: string, slot: "statement" | "value", depth: number) {
    nodes++;
    if (nodes > LIMITS.maxNodes) return fail(p, `too many blocks (max ${LIMITS.maxNodes})`);
    if (depth > LIMITS.maxDepth) return fail(p, `nested too deeply (max ${LIMITS.maxDepth})`);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(p, "must be a block object");
    const node = raw as Record<string, unknown>;
    const type = node.type;

    if (typeof node.id !== "string" || !BLOCK_ID_PATTERN.test(node.id)) fail(p, "id must be 1-64 letters, digits, _ or -");
    if (typeof node.label !== "string" || node.label.length < 1 || node.label.length > LIMITS.maxLabel) {
      fail(p, `label must be 1-${LIMITS.maxLabel} characters`);
    }
    if (node.hint !== undefined && (typeof node.hint !== "string" || node.hint.length > LIMITS.maxLabel)) {
      fail(p, `hint must be at most ${LIMITS.maxLabel} characters`);
    }
    if (typeof type !== "string" || !(type in SPECS)) return fail(p, `unknown block type ${JSON.stringify(type)}`);
    const spec = SPECS[type as BlockType];
    if (spec.statement !== (slot === "statement")) {
      return fail(p, `${type} is a ${spec.statement ? "statement" : "value"} block and cannot go in a ${slot} slot`);
    }

    checkFields(type as BlockType, node.fields, `${p}.fields`, fail);

    if (spec.value) {
      if (node.value === undefined) {
        if (spec.value === "required") fail(p, `${type} needs a value`);
      } else checkNode(node.value, `${p}.value`, "value", depth + 1);
    } else if (node.value !== undefined) fail(p, `${type} takes no value`);

    if (spec.values) {
      const [min, max] = type === "call" ? callArity(node.fields) : spec.values;
      if (!Array.isArray(node.values) || node.values.length < min || node.values.length > max) {
        fail(p, `${type} needs ${min === max ? min : `${min}-${max}`} values`);
      } else node.values.forEach((v, i) => checkNode(v, `${p}.values[${i}]`, "value", depth + 1));
    } else if (node.values !== undefined) fail(p, `${type} takes no values`);

    if (spec.children) {
      if (node.children !== undefined) checkStack(node.children, `${p}.children`, depth + 1);
    } else if (node.children !== undefined) fail(p, `${type} takes no children`);
  }

  function checkStack(raw: unknown, p: string, depth: number) {
    if (!Array.isArray(raw)) return fail(p, "must be an array of blocks");
    raw.forEach((child, i) => {
      checkNode(child, `${p}[${i}]`, "statement", depth);
      const type = (child as BlockNode | null)?.type;
      if (type === "else" && (raw[i - 1] as BlockNode | undefined)?.type !== "if") {
        fail(`${p}[${i}]`, "else must come directly after an if");
      }
    });
  }

  checkStack(blocks, path, 0);
  return errors;
}

function callArity(fields: unknown): [number, number] {
  const fn = (fields as Fields | undefined)?.fn;
  return fn && fn in CALL_FNS ? [...CALL_FNS[fn]] : [1, 4];
}

function checkFields(type: BlockType, raw: unknown, p: string, fail: (p: string, msg: string) => void) {
  const fields = (raw ?? {}) as Record<string, unknown>;
  if (typeof fields !== "object" || Array.isArray(fields)) return fail(p, "must be an object");
  const spec = SPECS[type];

  if (spec.name) {
    const name = fields.name;
    if (typeof name !== "string" || !IDENT_PATTERN.test(name)) fail(p, `${type} needs fields.name, a plain identifier`);
    else if (RESERVED_NAMES.has(name)) fail(p, `"${name}" is reserved and cannot be a name`);
  }

  switch (type) {
    case "create":
      if (!CREATE_KINDS.includes(fields.kind as CreateKind)) fail(p, `create needs fields.kind: ${CREATE_KINDS.join(", ")}`);
      break;
    case "number":
      if (typeof fields.value !== "number" || !Number.isSafeInteger(fields.value)) fail(p, "number needs an integer fields.value");
      break;
    case "string":
      if (typeof fields.value !== "string" || fields.value.length > LIMITS.maxString) {
        fail(p, `string needs fields.value, at most ${LIMITS.maxString} characters`);
      }
      break;
    case "bool":
      if (typeof fields.value !== "boolean") fail(p, "bool needs a true or false fields.value");
      break;
    case "binop":
      if (!BIN_OPS.includes(fields.op as BinOp)) fail(p, `binop needs fields.op: ${BIN_OPS.join(" ")}`);
      break;
    case "compare":
      if (!COMPARE_OPS.includes(fields.op as CompareOp)) fail(p, `compare needs fields.op: ${COMPARE_OPS.join(", ")}`);
      break;
    case "in_set":
      if (fields.negate !== undefined && typeof fields.negate !== "boolean") fail(p, "in_set fields.negate must be a boolean");
      break;
    case "call":
      if (typeof fields.fn !== "string" || !(fields.fn in CALL_FNS)) fail(p, `call needs fields.fn: ${Object.keys(CALL_FNS).join(", ")}`);
      break;
  }
}

// Visits every node in a tree, values included.
export function walk(blocks: BlockNode[], visit: (node: BlockNode) => void) {
  const go = (node: BlockNode) => {
    visit(node);
    if (node.value) go(node.value);
    node.values?.forEach(go);
    node.children?.forEach(go);
  };
  blocks.forEach(go);
}

// Two nodes with the same signature do the same thing: same type, fields,
// and value subtree. Ids, labels, and children are ignored. The required-block
// check uses this so it works across rounds whose trays have different ids.
export function signature(node: BlockNode): string {
  const strip = (n: BlockNode): unknown => ({
    type: n.type,
    fields: n.fields ?? {},
    value: n.value ? strip(n.value) : null,
    values: n.values ? n.values.map(strip) : null,
  });
  return stableStringify(strip(node));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Name allowlist: every name read must be a function parameter or a name some
// block defines (`create`, `assign`, or a loop variable).
export function checkNames(blocks: BlockNode[], params: string[]): string[] {
  const defined = new Set(params);
  walk(blocks, (n) => {
    if (n.fields?.name && (n.type === "create" || n.type === "assign" || n.type === "for_index" || n.type === "for_each")) {
      defined.add(n.fields.name);
    }
  });
  const errors: string[] = [];
  walk(blocks, (n) => {
    const name = n.fields?.name;
    if (name && SPECS[n.type].name && !defined.has(name)) errors.push(`block ${n.id}: unknown name "${name}"`);
  });
  return errors;
}
