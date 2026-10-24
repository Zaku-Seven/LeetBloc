// Reads test inputs and outputs written the way LeetCode (or Gemma) writes
// them: `nums = [2,7,11,15], target = 9`, `[0,1]`, `true`, `"()"`.
// Only literals are accepted. Nothing is evaluated.

import { splitTopLevel } from "./python";
import { PyDict, PyList, hashKey, type Value } from "./values";

export class LiteralError extends Error {}

export function parseLiteral(text: string): Value {
  const p = new Parser(text);
  const v = p.value();
  p.skipSpace();
  if (!p.done()) throw new LiteralError(`Unexpected text after a value: ${JSON.stringify(text.slice(p.pos, p.pos + 20))}`);
  return v;
}

// Reads an input line into arguments in parameter order. Accepts named
// (`nums = [1], target = 2`) or positional (`[1], 2`) arguments.
export function parseArgs(input: string, params: string[]): Value[] {
  const parts = splitTopLevel(input.trim(), ",").map((s) => s.trim()).filter(Boolean);
  const named = new Map<string, Value>();
  const positional: Value[] = [];
  for (const part of parts) {
    const m = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]+)$/.exec(part);
    if (m) named.set(m[1]!, parseLiteral(m[2]!));
    else positional.push(parseLiteral(part));
  }
  if (named.size > 0 && positional.length > 0) throw new LiteralError("Mixes named and positional arguments");
  if (named.size > 0) {
    return params.map((name) => {
      if (!named.has(name)) throw new LiteralError(`Missing argument ${name}`);
      return named.get(name)!;
    });
  }
  if (positional.length !== params.length) {
    throw new LiteralError(`Expected ${params.length} arguments, got ${positional.length}`);
  }
  return positional;
}

class Parser {
  pos = 0;
  constructor(private readonly s: string) {}

  done() {
    return this.pos >= this.s.length;
  }

  skipSpace() {
    while (!this.done() && /\s/.test(this.s[this.pos]!)) this.pos++;
  }

  value(depth = 0): Value {
    if (depth > 20) throw new LiteralError("Nested too deeply");
    this.skipSpace();
    const ch = this.s[this.pos];
    if (ch === "[") return this.list(depth);
    if (ch === "{") return this.dict(depth);
    if (ch === '"' || ch === "'") return this.string();
    const word = /^(-?\d+(?:\.\d+)?|true|false|True|False|null|None)/.exec(this.s.slice(this.pos));
    if (!word) throw new LiteralError(`Not a literal: ${JSON.stringify(this.s.slice(this.pos, this.pos + 20))}`);
    this.pos += word[0].length;
    switch (word[0]) {
      case "true":
      case "True":
        return true;
      case "false":
      case "False":
        return false;
      case "null":
      case "None":
        return null;
    }
    const n = Number(word[0]);
    if (!Number.isSafeInteger(n)) throw new LiteralError(`Only whole numbers are supported: ${word[0]}`);
    return n;
  }

  list(depth: number): PyList {
    this.pos++; // [
    const items: Value[] = [];
    this.skipSpace();
    if (this.s[this.pos] === "]") {
      this.pos++;
      return new PyList(items);
    }
    for (;;) {
      items.push(this.value(depth + 1));
      this.skipSpace();
      const ch = this.s[this.pos++];
      if (ch === "]") return new PyList(items);
      if (ch !== ",") throw new LiteralError("Expected , or ] in a list");
      this.skipSpace();
      if (this.s[this.pos] === "]") {
        this.pos++;
        return new PyList(items);
      }
    }
  }

  dict(depth: number): PyDict {
    this.pos++; // {
    const d = new PyDict();
    this.skipSpace();
    if (this.s[this.pos] === "}") {
      this.pos++;
      return d;
    }
    for (;;) {
      const key = this.value(depth + 1);
      this.skipSpace();
      if (this.s[this.pos++] !== ":") throw new LiteralError("Expected : in a map");
      const v = this.value(depth + 1);
      d.entries.set(hashKey(key), [key, v]);
      this.skipSpace();
      const ch = this.s[this.pos++];
      if (ch === "}") return d;
      if (ch !== ",") throw new LiteralError("Expected , or } in a map");
    }
  }

  string(): string {
    const quote = this.s[this.pos++]!;
    let out = "";
    while (!this.done()) {
      const ch = this.s[this.pos++]!;
      if (ch === quote) return out;
      if (ch === "\\") {
        const esc = this.s[this.pos++];
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
        if (esc === undefined || !(esc in map)) throw new LiteralError("Unsupported escape in a string");
        out += map[esc];
      } else out += ch;
    }
    throw new LiteralError("Unterminated string");
  }
}
