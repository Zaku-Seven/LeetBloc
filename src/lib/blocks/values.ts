// Runtime values for the interpreter, with Python semantics where LeetCode's
// expected outputs depend on them.

export type Value = number | string | boolean | null | PyList | PySet | PyDict;

export class PyList {
  constructor(public items: Value[] = []) {}
}

export class PySet {
  readonly entries = new Map<string, Value>();
}

export class PyDict {
  // Python dicts keep insertion order. So does Map.
  readonly entries = new Map<string, [Value, Value]>();
}

// A Python exception, reported to the learner as "Type: message".
export class PyError extends Error {
  constructor(
    readonly pyType: string,
    message: string,
  ) {
    super(`${pyType}: ${message}`);
  }
}

export function typeName(v: Value): string {
  if (v === null) return "NoneType";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return "int";
  if (typeof v === "string") return "str";
  if (v instanceof PyList) return "list";
  if (v instanceof PySet) return "set";
  return "dict";
}

// Python hashes True as 1 and False as 0, so they collide with those ints.
export function hashKey(v: Value): string {
  if (typeof v === "number") return `n${v}`;
  if (typeof v === "boolean") return `n${v ? 1 : 0}`;
  if (typeof v === "string") return `s${v}`;
  if (v === null) return "z";
  throw new PyError("TypeError", `unhashable type: '${typeName(v)}'`);
}

export function truthy(v: Value): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (v instanceof PyList) return v.items.length > 0;
  return v.entries.size > 0;
}

// Treats bools as ints, like Python does in arithmetic and comparisons.
export function asNumber(v: Value): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return undefined;
}

export function pyEq(a: Value, b: Value): boolean {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== undefined && nb !== undefined) return na === nb;
  if (typeof a === "string" || typeof b === "string" || a === null || b === null) return a === b;
  if (a instanceof PyList && b instanceof PyList) {
    return a.items.length === b.items.length && a.items.every((x, i) => pyEq(x, b.items[i]!));
  }
  if (a instanceof PySet && b instanceof PySet) {
    return a.entries.size === b.entries.size && [...a.entries.keys()].every((k) => b.entries.has(k));
  }
  if (a instanceof PyDict && b instanceof PyDict) {
    if (a.entries.size !== b.entries.size) return false;
    for (const [k, [, v]] of a.entries) {
      const other = b.entries.get(k);
      if (!other || !pyEq(v, other[1])) return false;
    }
    return true;
  }
  return false;
}

// Formats a value the way LeetCode shows inputs and outputs: [0,1], true, "()".
export function formatValue(v: Value): string {
  if (v === null) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v instanceof PyList) return `[${v.items.map(formatValue).join(",")}]`;
  if (v instanceof PySet) return `[${[...v.entries.values()].map(formatValue).join(",")}]`;
  return `{${[...v.entries.values()].map(([k, val]) => `${formatValue(k)}:${formatValue(val)}`).join(",")}}`;
}

// Deep copy, so a test's inputs cannot leak between runs.
export function cloneValue(v: Value): Value {
  if (v instanceof PyList) return new PyList(v.items.map(cloneValue));
  if (v instanceof PySet) {
    const s = new PySet();
    for (const [k, item] of v.entries) s.entries.set(k, item);
    return s;
  }
  if (v instanceof PyDict) {
    const d = new PyDict();
    for (const [k, [key, val]] of v.entries) d.entries.set(k, [key, cloneValue(val)]);
    return d;
  }
  return v;
}
