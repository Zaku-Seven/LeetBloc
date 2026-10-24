import type { BlockNode, BlockType } from "@/lib/gemma/types";

// ---------------------------------------------------------------------------
// Tray items — individual blocks waiting to be placed
// ---------------------------------------------------------------------------

export interface TrayItem {
  /** Unique id matching the original BlockNode.id */
  id: string;
  type: BlockType;
  label: string;
  /** Whether this block has a single value slot */
  hasValueSlot: boolean;
  /** Number of multi-value slots (e.g. binop has 2 operands) */
  valuesSlotCount: number;
  /** Whether this is a container block (for/if/while/else) */
  isContainer: boolean;
  /** The original BlockNode for rendering in the tray */
  original: BlockNode;
}

// ---------------------------------------------------------------------------
// Workspace nodes — blocks placed on the board
// ---------------------------------------------------------------------------

export interface WorkspaceNode {
  id: string;
  type: BlockType;
  label: string;
  /** Single value slot — null means empty hole */
  value: WorkspaceNode | null;
  /** Multi-value slots — null entries are empty holes */
  values: (WorkspaceNode | null)[];
  /** Ordered statement children (for containers) */
  children: WorkspaceNode[];
  /** Is this a container block */
  isContainer: boolean;
}

// ---------------------------------------------------------------------------
// Drop targets
// ---------------------------------------------------------------------------

export type DropTargetKind =
  | "stack-gap"      // Between statement blocks in a stack
  | "value-slot"     // Empty value hole on a statement
  | "values-slot"    // One of the multi-value holes
  | "children-area"; // Inside a container's children area

export interface DropTarget {
  kind: DropTargetKind;
  /** Id of the parent workspace node (or "root" for top-level stack) */
  parentId: string;
  /** Index within the relevant array */
  index: number;
}

// ---------------------------------------------------------------------------
// Puzzle state & actions
// ---------------------------------------------------------------------------

export type CheckResult =
  | { status: "unchecked" }
  | { status: "pass" }
  | { status: "fail"; message: string };

export interface PuzzleState {
  tray: TrayItem[];
  workspace: WorkspaceNode[];
  draggingId: string | null;
  checkResult: CheckResult;
}

export type PuzzleAction =
  | { type: "DRAG_START"; id: string }
  | { type: "DRAG_END" }
  | { type: "DROP_ON_STACK"; item: TrayItem; parentId: string; index: number }
  | { type: "DROP_ON_VALUE_SLOT"; item: TrayItem; parentId: string }
  | { type: "DROP_ON_VALUES_SLOT"; item: TrayItem; parentId: string; index: number }
  | { type: "DROP_ON_CHILDREN"; item: TrayItem; parentId: string; index: number }
  | { type: "REMOVE_FROM_WORKSPACE"; id: string }
  | { type: "CHECK" }
  | { type: "SHUFFLE" }
  | { type: "RESET"; tray: TrayItem[] };
