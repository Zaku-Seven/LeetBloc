import { BIN_OPS, CALL_FNS, COMPARE_OPS, CREATE_KINDS, type BlockNode } from "../blocks/catalog";
import { parseStub } from "../blocks/python";
import { BUNDLED } from "../puzzles/bundled";
import type { ProblemInput } from "./types";

// ---------------------------------------------------------------------------
// Worked example: the hand-written Two Sum puzzle, which passes the same
// verification Gemma's output must pass.
// ---------------------------------------------------------------------------

function exampleJson(): string {
  const { puzzle } = BUNDLED["two-sum"]!;
  const approach = (name: "brute" | "optimized") => {
    const { blocks, ...rest } = puzzle[name];
    return `  ${JSON.stringify(name)}: ${JSON.stringify(rest).slice(0, -1)},\n    "blocks": [\n${formatStack(blocks, 6)}\n    ]}`;
  };
  // Distractors sit in the tray on their own, so they carry no children.
  const distractors = puzzle.distractors.map((d) => {
    const copy = { ...d };
    delete copy.children;
    return `    ${JSON.stringify(copy)}`;
  });
  return [
    "{",
    `${approach("brute")},`,
    `${approach("optimized")},`,
    `  "distractors": [\n${distractors.join(",\n")}\n  ],`,
    `  "extraTests": ${JSON.stringify(puzzle.extraTests)}`,
    "}",
  ].join("\n");
}

// One statement per line, indented by nesting, with its values inline. Keeping
// nesting visible is what stops the model losing count of closing brackets.
function formatStack(blocks: BlockNode[], indent: number): string {
  const pad = " ".repeat(indent);
  return blocks
    .map((b) => {
      const { children, ...rest } = b;
      const head = JSON.stringify(rest);
      if (!children) return pad + head;
      return `${pad}${head.slice(0, -1)}, "children": [\n${formatStack(children, indent + 2)}\n${pad}]}`;
    })
    .join(",\n");
}

// ---------------------------------------------------------------------------
// System instruction — describes the block catalog, rules, and output format
// ---------------------------------------------------------------------------

export function buildSystemInstruction(): string {
  return `You are a code-puzzle generator for LeetBloc, a tool that turns LeetCode problems into Scratch-style block puzzles.

You write two Python solutions to a problem, a brute-force one and an optimized one, as trees of blocks. A block tree is run directly by an interpreter. Only the block types, fields, and slots below exist. Anything else is rejected.

## Block shape

{ "id": string, "type": string, "label": string, "hint"?: string, "fields"?: {...}, "value"?: Block, "values"?: Block[], "children"?: Block[] }

- \`id\`: unique across the whole response. Letters, digits, _ or -.
- \`label\`: the Python the block stands for, for display. For a block with a nested body, no trailing colon: "for i in range(len(nums))".
- \`hint\`: on every statement block, one short sentence that nudges without giving the answer.
- \`fields\`: the block's settings. The interpreter reads ONLY fields and child blocks, never the label.
- \`value\`: one child value block. \`values\`: an ordered list of child value blocks. \`children\`: the nested statement stack.

## Statement blocks (go in "blocks" and "children")

- create     fields {name, kind}, kind is one of ${CREATE_KINDS.join(", ")}. A number may have a starting "value" (default 0).   name = [] / set() / {} / 0
- assign     fields {name}, value                       name = value
- append     fields {name}, value                       name.append(value)
- map_set    fields {name}, values [key, value]         name[key] = value
- set_add    fields {name}, value                       name.add(value)
- for_index  fields {name}, values [start, stop], children   for name in range(start, stop). stop is exclusive.
- for_each   fields {name}, value (iterable), children  for name in iterable
- while      value (condition), children                while condition
- if         value (condition), children                if condition
- else       children. Must come directly after an if, as the next block in the same list.
- return     optional value                             return value

## Value blocks (go in "value" and "values")

- var       fields {name}                    a parameter, or a name made by create / assign / a loop
- number    fields {value: integer}
- string    fields {value: string}
- bool      fields {value: true|false}
- list      values [items...]                [a, b]
- index     values [target, index]           target[index]; negative indexes count from the end
- map_get   values [map, key]                map[key]
- length    value                            len(value)
- binop     fields {op}, values [left, right]; op is one of ${BIN_OPS.join(" ")}
- compare   fields {op}, values [left, right]; op is one of ${COMPARE_OPS.join(", ")}
- in_set    values [item, collection], optional fields {negate: true}   item in collection
- not       value                            not value
- call      fields {fn}, values [args...]; fn is one of ${Object.keys(CALL_FNS).join(", ")}. pop takes [list] and is list.pop(). replace takes [s, old, new] and is s.replace(old, new).

There are no other blocks: no while-else, no break, no slicing, no division with /, no floats, no dict or set literals (create then fill them), no classes, no imports.

## Names

Every name must be a function parameter or a name some block defines with create, assign, for_index, or for_each. Names cannot be Python keywords or builtins (len, range, min, max, list, set, dict, sorted, self, ...).

## What to produce

1. \`brute\`: the slow, obvious approach most people find first (nested loops, repeated scans).
2. \`optimized\`: the best known approach.
3. Each has \`plan\` (2-4 plain sentences for a beginner, no code), \`complexity\` (like "O(n) time, O(n) space"), \`blocks\` (the function body), and \`requiredBlockIds\`.
4. \`optimized.requiredBlockIds\`: 2-4 ids of optimized blocks that ARE the new idea (the map, the set, the stack, the pointer move). The brute-force solution must not contain all of them. \`brute.requiredBlockIds\` is [].
5. \`distractors\`: 2-3 statement blocks, no children, that are legal but wrong for this problem (sorting when order matters, a loop that starts in the wrong place). Use names the solutions define or the parameters.
6. \`extraTests\`: 3-5 extra cases. \`input\` names every parameter, like "nums = [1,2], target = 3". \`expected\` is the return value, like "[0,1]", "true", "5", "\\"abc\\"". Cover edge cases (smallest input, duplicates, negatives).

Both solutions are run on the problem's examples and must return exactly the example outputs. Extra tests are kept only when both solutions agree on them.

## Example (Two Sum)

${exampleJson()}

## Output format

Return ONLY one JSON object with keys brute, optimized, distractors, extraTests. No markdown fences, no explanation.

Lay it out like the example: one statement block per line, indented by nesting, with its value blocks inline. Before you finish, check that every block's closing brackets match: a block with children ends with ]} after its last child.`;
}

// ---------------------------------------------------------------------------
// Per-problem user prompt
// ---------------------------------------------------------------------------

export function buildUserPrompt(problem: ProblemInput): string {
  const examplesStr = problem.examples
    .map((ex, i) => `  Example ${i + 1}: Input: ${ex.input}  →  Output: ${ex.output}`)
    .join("\n");

  let params = "";
  try {
    params = parseStub(problem.pythonStub).params.join(", ");
  } catch {
    // The validator reports a bad stub.
  }

  return `Generate a block puzzle for this LeetCode problem.

**Title:** ${problem.title}
**Difficulty:** ${problem.difficulty}
**Slug:** ${problem.slug}

**Description:**
${problem.contentText}

**Examples:**
${examplesStr}

**Python stub:**
\`\`\`python
${problem.pythonStub}
\`\`\`

**Parameters you can read:** ${params}

Return the JSON object described in the system instructions.`;
}
