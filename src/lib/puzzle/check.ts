import type { BlockNode } from "@/lib/gemma/types";
import type { WorkspaceNode, CheckResult } from "./types";

/**
 * Compare the assembled workspace tree to the correct answer.
 * Returns pass/fail with a specific error message on failure.
 */
export function checkSolution(
  workspace: WorkspaceNode[],
  answer: BlockNode[],
): CheckResult {
  // 1. Check workspace isn't empty
  if (workspace.length === 0) {
    return { status: "fail", message: "Workspace is empty — drag some blocks in!" };
  }

  // 2. Check for unfilled slots
  const unfilled = findUnfilledSlots(workspace);
  if (unfilled) {
    return { status: "fail", message: unfilled };
  }

  // 3. Structural comparison
  const mismatch = compareNodes(workspace, answer, "root");
  if (mismatch) {
    return { status: "fail", message: mismatch };
  }

  return { status: "pass" };
}

function findUnfilledSlots(nodes: WorkspaceNode[]): string | null {
  for (const node of nodes) {
    if (node.value === null && needsValue(node)) {
      return `Block "${node.label}" has an empty value slot`;
    }
    for (let i = 0; i < node.values.length; i++) {
      if (node.values[i] === null) {
        return `Block "${node.label}" has an empty slot at position ${i + 1}`;
      }
    }
    if (node.value) {
      const inner = findUnfilledSlots([node.value]);
      if (inner) return inner;
    }
    for (const v of node.values) {
      if (v) {
        const inner = findUnfilledSlots([v]);
        if (inner) return inner;
      }
    }
    const childResult = findUnfilledSlots(node.children);
    if (childResult) return childResult;
  }
  return null;
}

/** Check if a workspace node type normally expects a value slot */
function needsValue(node: WorkspaceNode): boolean {
  // Container types and assign typically have a value slot
  const typesWithValue = new Set([
    "for_index", "for_each", "while", "if", "assign",
  ]);
  return typesWithValue.has(node.type);
}

function compareNodes(
  workspace: WorkspaceNode[],
  answer: BlockNode[],
  context: string,
): string | null {
  if (workspace.length !== answer.length) {
    return `Expected ${answer.length} block(s) at ${context}, but found ${workspace.length}`;
  }

  for (let i = 0; i < answer.length; i++) {
    const w = workspace[i];
    const a = answer[i];

    // Check block type and label match
    if (w.type !== a.type) {
      return `Expected "${a.label}" (${a.type}) at position ${i + 1} in ${context}, but found "${w.label}" (${w.type})`;
    }

    if (w.id !== a.id) {
      return `Block "${w.label}" is in the wrong position — expected "${a.label}" at position ${i + 1} in ${context}`;
    }

    // Check single value slot
    if (a.value) {
      if (!w.value) {
        return `Block "${a.label}" is missing its value: ${a.value.label}`;
      }
      const valErr = compareNodes([w.value], [a.value], `value of "${a.label}"`);
      if (valErr) return valErr;
    }

    // Check multi-value slots
    if (a.values && a.values.length > 0) {
      const filledValues = w.values.filter((v): v is WorkspaceNode => v !== null);
      if (filledValues.length !== a.values.length) {
        return `Block "${a.label}" expects ${a.values.length} value(s) but has ${filledValues.length}`;
      }
      const valsErr = compareNodes(filledValues, a.values, `values of "${a.label}"`);
      if (valsErr) return valsErr;
    }

    // Check children
    if (a.children && a.children.length > 0) {
      const childErr = compareNodes(w.children, a.children, `body of "${a.label}"`);
      if (childErr) return childErr;
    }
  }

  return null;
}
