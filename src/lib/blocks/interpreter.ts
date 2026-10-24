// Runs a block tree directly. There is no code generation and no eval: the
// only things a program can do are the cases below. A step budget stands in
// for a timeout and a size cap stands in for a memory limit, so a loop that
// never ends just fails the test.

import { CALL_FNS, type BlockNode, type CompareOp } from "./catalog";
import {
  PyDict, PyError, PyList, PySet, asNumber, cloneValue, hashKey, pyEq, truthy, typeName, type Value,
} from "./values";

export interface RunLimits {
  maxSteps: number;
  maxSize: number;
}

export const DEFAULT_LIMITS: RunLimits = { maxSteps: 1_000_000, maxSize: 100_000 };

export type RunResult =
  | { ok: true; value: Value; steps: number }
  | { ok: false; error: string; kind: "error" | "timeout"; steps: number };

class StepLimit extends Error {}

class Return {
  constructor(readonly value: Value) {}
}

export function run(body: BlockNode[], params: string[], args: Value[], limits: RunLimits = DEFAULT_LIMITS): RunResult {
  const env = new Map<string, Value>();
  params.forEach((p, i) => env.set(p, cloneValue(args[i] ?? null)));
  let steps = 0;

  const tick = () => {
    if (++steps > limits.maxSteps) throw new StepLimit();
  };

  const checkSize = (n: number) => {
    if (n > limits.maxSize) throw new PyError("MemoryError", `a collection grew past ${limits.maxSize} items`);
  };

  const checkInt = (n: number) => {
    if (!Number.isSafeInteger(n)) throw new PyError("OverflowError", "number too large for this puzzle");
    return n;
  };

  const lookup = (name: string): Value => {
    if (!env.has(name)) throw new PyError("NameError", `name '${name}' is not defined`);
    return env.get(name)!;
  };

  const num = (v: Value, what: string): number => {
    const n = asNumber(v);
    if (n === undefined) throw new PyError("TypeError", `${what} needs a number, not '${typeName(v)}'`);
    return n;
  };

  const child = (node: BlockNode, i: number): BlockNode => {
    const c = i < 0 ? node.value : node.values?.[i];
    if (!c) throw new PyError("SyntaxError", `${node.type} block is missing a value`);
    return c;
  };

  function evaluate(node: BlockNode): Value {
    tick();
    const f = node.fields ?? {};
    switch (node.type) {
      case "var":
        return lookup(f.name!);
      case "number":
      case "string":
      case "bool":
        return f.value as Value;
      case "list": {
        const items = (node.values ?? []).map(evaluate);
        return new PyList(items);
      }
      case "index":
        return index(evaluate(child(node, 0)), evaluate(child(node, 1)));
      case "map_get":
        return mapGet(evaluate(child(node, 0)), evaluate(child(node, 1)));
      case "length":
        return length(evaluate(child(node, -1)));
      case "binop":
        return binop(f.op!, node);
      case "compare":
        return compare(f.op as CompareOp, evaluate(child(node, 0)), evaluate(child(node, 1)));
      case "in_set": {
        const found = contains(evaluate(child(node, 1)), evaluate(child(node, 0)));
        return f.negate ? !found : found;
      }
      case "not":
        return !truthy(evaluate(child(node, -1)));
      case "call":
        return call(f.fn!, (node.values ?? []).map(evaluate));
      default:
        throw new PyError("SyntaxError", `${node.type} is not a value block`);
    }
  }

  function binop(op: string, node: BlockNode): Value {
    if (op === "and") {
      const l = evaluate(child(node, 0));
      return truthy(l) ? evaluate(child(node, 1)) : l;
    }
    if (op === "or") {
      const l = evaluate(child(node, 0));
      return truthy(l) ? l : evaluate(child(node, 1));
    }
    const a = evaluate(child(node, 0));
    const b = evaluate(child(node, 1));
    if (op === "+") {
      if (typeof a === "string" && typeof b === "string") {
        checkSize(a.length + b.length);
        return a + b;
      }
      if (a instanceof PyList && b instanceof PyList) {
        checkSize(a.items.length + b.items.length);
        return new PyList([...a.items, ...b.items]);
      }
    }
    if (op === "*" && (a instanceof PyList || typeof a === "string")) {
      const times = Math.max(0, num(b, "*"));
      if (typeof a === "string") {
        checkSize(a.length * times);
        return a.repeat(times);
      }
      checkSize(a.items.length * times);
      return new PyList(Array.from({ length: times }, () => a.items).flat());
    }
    const x = asNumber(a);
    const y = asNumber(b);
    if (x === undefined || y === undefined) {
      throw new PyError("TypeError", `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
    }
    switch (op) {
      case "+":
        return checkInt(x + y);
      case "-":
        return checkInt(x - y);
      case "*":
        return checkInt(x * y);
      case "//":
        if (y === 0) throw new PyError("ZeroDivisionError", "integer division or modulo by zero");
        return Math.floor(x / y);
      case "%":
        if (y === 0) throw new PyError("ZeroDivisionError", "integer division or modulo by zero");
        // Python's % takes the sign of the divisor.
        return x - y * Math.floor(x / y);
    }
    throw new PyError("SyntaxError", `unknown operator ${op}`);
  }

  function compare(op: CompareOp, a: Value, b: Value): boolean {
    switch (op) {
      case "==":
        return pyEq(a, b);
      case "!=":
        return !pyEq(a, b);
      case "in":
        return contains(b, a);
      case "not in":
        return !contains(b, a);
    }
    return order(op, a, b);
  }

  function order(op: "<" | "<=" | ">" | ">=", a: Value, b: Value): boolean {
    let cmp: number;
    const x = asNumber(a);
    const y = asNumber(b);
    if (x !== undefined && y !== undefined) cmp = x - y;
    else if (typeof a === "string" && typeof b === "string") cmp = a < b ? -1 : a > b ? 1 : 0;
    else throw new PyError("TypeError", `'${op}' not supported between '${typeName(a)}' and '${typeName(b)}'`);
    return op === "<" ? cmp < 0 : op === "<=" ? cmp <= 0 : op === ">" ? cmp > 0 : cmp >= 0;
  }

  function index(target: Value, key: Value): Value {
    if (target instanceof PyDict) return mapGet(target, key);
    if (target instanceof PyList || typeof target === "string") {
      const len = target instanceof PyList ? target.items.length : target.length;
      const i = asNumber(key);
      if (i === undefined || typeof key === "boolean") {
        throw new PyError("TypeError", `indices must be integers, not '${typeName(key)}'`);
      }
      const at = i < 0 ? len + i : i;
      if (at < 0 || at >= len) throw new PyError("IndexError", `${typeName(target)} index out of range`);
      return target instanceof PyList ? target.items[at]! : target[at]!;
    }
    throw new PyError("TypeError", `'${typeName(target)}' object is not subscriptable`);
  }

  function mapGet(map: Value, key: Value): Value {
    if (!(map instanceof PyDict)) {
      if (map instanceof PyList || typeof map === "string") return index(map, key);
      throw new PyError("TypeError", `'${typeName(map)}' object is not subscriptable`);
    }
    const entry = map.entries.get(hashKey(key));
    if (!entry) throw new PyError("KeyError", formatKey(key));
    return entry[1];
  }

  function length(v: Value): number {
    if (typeof v === "string") return v.length;
    if (v instanceof PyList) return v.items.length;
    if (v instanceof PySet || v instanceof PyDict) return v.entries.size;
    throw new PyError("TypeError", `object of type '${typeName(v)}' has no len()`);
  }

  function contains(collection: Value, item: Value): boolean {
    if (collection instanceof PySet || collection instanceof PyDict) return collection.entries.has(hashKey(item));
    if (collection instanceof PyList) return collection.items.some((x) => pyEq(x, item));
    if (typeof collection === "string") {
      if (typeof item !== "string") throw new PyError("TypeError", "'in <string>' requires string as left operand");
      return collection.includes(item);
    }
    throw new PyError("TypeError", `argument of type '${typeName(collection)}' is not iterable`);
  }

  function iterate(v: Value): Value[] {
    if (v instanceof PyList) return v.items;
    if (typeof v === "string") return [...v];
    if (v instanceof PySet) return [...v.entries.values()];
    if (v instanceof PyDict) return [...v.entries.values()].map(([k]) => k);
    throw new PyError("TypeError", `'${typeName(v)}' object is not iterable`);
  }

  function call(fn: keyof typeof CALL_FNS, args: Value[]): Value {
    switch (fn) {
      case "min":
      case "max": {
        const items = args.length === 1 ? [...iterate(args[0]!)] : args;
        if (items.length === 0) throw new PyError("ValueError", `${fn}() arg is an empty sequence`);
        return items.reduce((best, x) => (order(fn === "min" ? "<" : ">", x, best) ? x : best));
      }
      case "abs":
        return Math.abs(num(args[0]!, "abs()"));
      case "sorted": {
        const items = [...iterate(args[0]!)];
        items.sort((a, b) => (order("<", a, b) ? -1 : order(">", a, b) ? 1 : 0));
        return new PyList(items);
      }
      case "pop": {
        const list = args[0];
        if (!(list instanceof PyList)) throw new PyError("TypeError", `'${typeName(list ?? null)}' object has no pop()`);
        if (list.items.length === 0) throw new PyError("IndexError", "pop from empty list");
        return list.items.pop()!;
      }
      case "replace": {
        const [s, old, rep] = args;
        if (typeof s !== "string" || typeof old !== "string" || typeof rep !== "string") {
          throw new PyError("TypeError", "replace() needs three strings");
        }
        const out = old === "" ? rep + [...s].join(rep) + rep : s.split(old).join(rep);
        checkSize(out.length);
        return out;
      }
    }
  }

  function exec(stack: BlockNode[]): void {
    let lastIfRan: boolean | undefined;
    for (const node of stack) {
      tick();
      const f = node.fields ?? {};
      const wasIf = lastIfRan;
      lastIfRan = undefined;
      switch (node.type) {
        case "create": {
          const kind = f.kind;
          const v = kind === "list" ? new PyList() : kind === "set" ? new PySet() : kind === "map" ? new PyDict() : node.value ? evaluate(node.value) : 0;
          env.set(f.name!, v);
          break;
        }
        case "assign":
          env.set(f.name!, evaluate(child(node, -1)));
          break;
        case "append": {
          const list = lookup(f.name!);
          if (!(list instanceof PyList)) throw new PyError("AttributeError", `'${typeName(list)}' object has no attribute 'append'`);
          const v = evaluate(child(node, -1));
          checkSize(list.items.length + 1);
          list.items.push(v);
          break;
        }
        case "map_set": {
          const map = lookup(f.name!);
          if (!(map instanceof PyDict)) throw new PyError("TypeError", `'${typeName(map)}' object does not support item assignment`);
          const key = evaluate(child(node, 0));
          const v = evaluate(child(node, 1));
          const k = hashKey(key);
          if (!map.entries.has(k)) checkSize(map.entries.size + 1);
          map.entries.set(k, [key, v]);
          break;
        }
        case "set_add": {
          const set = lookup(f.name!);
          if (!(set instanceof PySet)) throw new PyError("AttributeError", `'${typeName(set)}' object has no attribute 'add'`);
          const v = evaluate(child(node, -1));
          const k = hashKey(v);
          if (!set.entries.has(k)) checkSize(set.entries.size + 1);
          set.entries.set(k, v);
          break;
        }
        case "for_index": {
          const start = num(evaluate(child(node, 0)), "range()");
          const stop = num(evaluate(child(node, 1)), "range()");
          for (let i = start; i < stop; i++) {
            tick();
            env.set(f.name!, i);
            exec(node.children ?? []);
          }
          break;
        }
        case "for_each": {
          const iterable = evaluate(child(node, -1));
          // Lists are walked live, like Python, so appending while walking keeps going.
          if (iterable instanceof PyList) {
            for (let i = 0; i < iterable.items.length; i++) {
              tick();
              env.set(f.name!, iterable.items[i]!);
              exec(node.children ?? []);
            }
          } else {
            for (const item of iterate(iterable)) {
              tick();
              env.set(f.name!, item);
              exec(node.children ?? []);
            }
          }
          break;
        }
        case "while":
          while (truthy(evaluate(child(node, -1)))) exec(node.children ?? []);
          break;
        case "if": {
          const ran = truthy(evaluate(child(node, -1)));
          if (ran) exec(node.children ?? []);
          lastIfRan = ran;
          break;
        }
        case "else":
          if (wasIf === undefined) throw new PyError("SyntaxError", "else must come directly after an if");
          if (!wasIf) exec(node.children ?? []);
          break;
        case "return":
          throw new Return(node.value ? evaluate(node.value) : null);
        default:
          throw new PyError("SyntaxError", `${node.type} is a value block, not a statement`);
      }
    }
  }

  try {
    exec(body);
    return { ok: true, value: null, steps };
  } catch (e) {
    if (e instanceof Return) return { ok: true, value: e.value, steps };
    if (e instanceof StepLimit) return { ok: false, error: "Took too long: the program may never finish", kind: "timeout", steps };
    if (e instanceof PyError) return { ok: false, error: e.message, kind: "error", steps };
    if (e instanceof RangeError) return { ok: false, error: "RecursionError: nested too deeply", kind: "error", steps };
    throw e;
  }
}

function formatKey(key: Value): string {
  return typeof key === "string" ? `'${key}'` : String(key);
}
