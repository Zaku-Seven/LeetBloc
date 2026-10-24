import type { ProblemInput } from "./types";
import { ALL_BLOCK_TYPES } from "./types";

// ---------------------------------------------------------------------------
// System instruction — describes the block catalog, rules, and output format
// ---------------------------------------------------------------------------

export function buildSystemInstruction(): string {
  return `You are a code-puzzle generator for LeetBloc, a tool that turns LeetCode problems into Scratch-style block puzzles.

## Block catalog

Every block has an \`id\` (unique string), a \`type\`, and a human-readable \`label\`.

### Statement blocks (vertical stack — execute in order)
- \`create\`    — Make a list, set, map, or number.  Example: "result = []"
- \`assign\`    — Store a value.  Example: "complement = target - nums[i]"
- \`append\`    — Push onto a list.  Example: "result.append(i)"
- \`map_set\`   — Remember a key→value.  Example: "seen[nums[i]] = i"
- \`set_add\`   — Remember a membership.  Example: "visited.add(node)"
- \`for_index\` — Walk indexes (including nested loops).  Example: "for i in range(len(nums))"
- \`for_each\`  — Walk values.  Example: "for num in nums"
- \`while\`     — Walk a condition (used for pointers).  Example: "while left < right"
- \`if\`        — Branch.  Example: "if complement in seen"
- \`else\`      — Else branch.  Example: "else"
- \`return\`    — Answer.  Example: "return [seen[complement], i]"

### Value blocks (dropped into statement holes)
- \`var\`       — Variables.  Example: "nums", "target", "i", "seen"
- \`number\`    — Constants.  Example: "0", "1", "-1"
- \`index\`     — Array access.  Example: "nums[i]"
- \`map_get\`   — Dictionary lookup.  Example: "seen[complement]"
- \`length\`    — Length.  Example: "len(nums)"
- \`binop\`     — Binary operation (+, -, *, //, %).  Example: "target - nums[i]"
- \`compare\`   — Comparison (<, >, <=, >=, ==, !=, \`in\`).  Example: "i < j"
- \`in_set\`    — Check membership.  Example: "complement in seen"

Allowed block types: ${ALL_BLOCK_TYPES.join(", ")}

## Rules

1. Generate TWO approaches: \`brute\` (brute-force, usually O(n²) or worse) and \`optimized\` (best known, usually O(n) or O(n log n)).
2. Each approach has:
   - \`plan\`: 1-2 sentence natural-language explanation for the learner.
   - \`complexity\`: Big-O string like "O(n)" or "O(n²)".
   - \`blocks\`: Array of root-level BlockNode objects forming the complete solution.
   - \`requiredBlockIds\`: Array of block IDs the learner must correctly place in the optimized round.
3. A \`BlockNode\` is: \`{ id, type, label, value?, values?, children? }\`
   - \`value\`: a single child BlockNode (e.g. condition of an \`if\`).
   - \`values\`: array of child BlockNodes (e.g. operands of a \`binop\`).
   - \`children\`: ordered statement children (e.g. body of a \`for_index\`).
4. Every block \`id\` must be globally unique across the entire response (brute, optimized, and distractors).
5. \`requiredBlockIds\` must reference IDs that actually exist in that approach's \`blocks\` tree.
6. Generate 3-5 \`distractors\`: plausible-looking blocks that belong to neither solution. They must also have unique IDs.
7. Generate 2-4 \`extraTests\` beyond the problem's examples. Each has \`input\` (Python expression) and \`expected\` (Python expression for the expected return value).
8. Every block must map to real Python logic. The \`label\` should look like the Python line it represents.

## Output format

Return ONLY valid JSON (no markdown fences, no explanation). The JSON must match this shape exactly:

{
  "brute": { "plan": "...", "complexity": "...", "blocks": [...], "requiredBlockIds": [...] },
  "optimized": { "plan": "...", "complexity": "...", "blocks": [...], "requiredBlockIds": [...] },
  "distractors": [...],
  "extraTests": [{ "input": "...", "expected": "..." }, ...]
}`;
}

// ---------------------------------------------------------------------------
// Per-problem user prompt
// ---------------------------------------------------------------------------

export function buildUserPrompt(problem: ProblemInput): string {
  const examplesStr = problem.examples
    .map((ex, i) => `  Example ${i + 1}: Input: ${ex.input}  →  Output: ${ex.output}`)
    .join("\n");

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

Return the JSON object described in the system instructions.`;
}

// ---------------------------------------------------------------------------
// Repair prompt — sent when validation fails
// ---------------------------------------------------------------------------

export function buildRepairPrompt(
  originalPrompt: string,
  rawResponse: string,
  errors: string[],
): string {
  return `The previous response had validation errors. Please fix them and return corrected JSON.

**Original prompt (for context):**
${originalPrompt}

**Your previous response:**
${rawResponse}

**Validation errors:**
${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Return ONLY the corrected JSON object — no explanation, no markdown fences.`;
}
