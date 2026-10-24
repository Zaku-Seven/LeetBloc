"use client";

import { useReducer, useCallback, useEffect } from "react";
import type { BlockNode } from "@/lib/gemma/types";
import type {
  TrayItem,
  WorkspaceNode,
  PuzzleState,
  PuzzleAction,
} from "@/lib/puzzle/types";
import { isValue } from "@/components/blocks/block-helpers";
import { checkSolution } from "@/lib/puzzle/check";
import { shuffle } from "@/lib/puzzle/shuffle";
import { getDraggedItem, setDraggedItem } from "@/lib/puzzle/drag-state";
import { ProblemInfo } from "./ProblemInfo";
import { BlockTray } from "./BlockTray";
import { WorkspaceBoard } from "./WorkspaceBoard";
import { RunButton } from "./RunButton";

interface PuzzleWorkspaceProps {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  plan: string;
  complexity: string;
  initialTray: TrayItem[];
  answer: BlockNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trayItemToWorkspaceNode(item: TrayItem): WorkspaceNode {
  return {
    id: item.id,
    type: item.type,
    label: item.label,
    value: null,
    values: Array.from({ length: item.valuesSlotCount }, () => null),
    children: [],
    isContainer: item.isContainer,
  };
}

/** Find and remove a node from the workspace tree, returning it and the updated tree */
function removeNode(
  nodes: WorkspaceNode[],
  id: string,
): { removed: WorkspaceNode | null; updated: WorkspaceNode[] } {
  const updated: WorkspaceNode[] = [];
  let removed: WorkspaceNode | null = null;

  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
      continue;
    }

    let newNode = { ...node };

    // Check value slot
    if (newNode.value?.id === id) {
      removed = newNode.value;
      newNode = { ...newNode, value: null };
    } else if (newNode.value) {
      const res = removeNode([newNode.value], id);
      if (res.removed) {
        removed = res.removed;
        newNode = { ...newNode, value: res.updated[0] || null };
      }
    }

    // Check values slots
    if (!removed) {
      const newValues = [...newNode.values];
      for (let i = 0; i < newValues.length; i++) {
        const v = newValues[i];
        if (!v) continue;
        if (v.id === id) {
          removed = v;
          newValues[i] = null;
          break;
        }
        const res = removeNode([v], id);
        if (res.removed) {
          removed = res.removed;
          newValues[i] = res.updated[0] || null;
          break;
        }
      }
      if (removed) {
        newNode = { ...newNode, values: newValues };
      }
    }

    // Check children
    if (!removed) {
      const res = removeNode(newNode.children, id);
      if (res.removed) {
        removed = res.removed;
        newNode = { ...newNode, children: res.updated };
      }
    }

    updated.push(newNode);
  }

  return { removed, updated };
}

/** Collect all TrayItems from a workspace node and its descendants */
function workspaceNodeToTrayItems(
  node: WorkspaceNode,
  allOriginals: Map<string, TrayItem>,
): TrayItem[] {
  const items: TrayItem[] = [];
  function walk(n: WorkspaceNode) {
    const orig = allOriginals.get(n.id);
    if (orig) {
      items.push(orig);
    }
    if (n.value) walk(n.value);
    for (const v of n.values) if (v) walk(v);
    for (const c of n.children) walk(c);
  }
  walk(node);
  return items;
}

/** Find a node in workspace by id and apply an updater */
function updateNodeInTree(
  nodes: WorkspaceNode[],
  targetId: string,
  updater: (node: WorkspaceNode) => WorkspaceNode,
): WorkspaceNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return updater(node);
    }

    let updated = node;

    if (node.value) {
      const [result] = updateNodeInTree([node.value], targetId, updater);
      if (result !== node.value) {
        updated = { ...updated, value: result };
      }
    }

    const newValues = node.values.map((v) => {
      if (!v) return v;
      const [result] = updateNodeInTree([v], targetId, updater);
      return result;
    });
    if (newValues.some((v, i) => v !== node.values[i])) {
      updated = { ...updated, values: newValues };
    }

    const newChildren = updateNodeInTree(node.children, targetId, updater);
    if (newChildren.some((c, i) => c !== node.children[i]) || newChildren.length !== node.children.length) {
      updated = { ...updated, children: newChildren };
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function createReducer(allOriginals: Map<string, TrayItem>, answer: BlockNode[]) {
  return function puzzleReducer(
    state: PuzzleState,
    action: PuzzleAction,
  ): PuzzleState {
    switch (action.type) {
      case "DRAG_START":
        return { ...state, draggingId: action.id };

      case "DRAG_END":
        return { ...state, draggingId: null };

      case "DROP_ON_STACK": {
        const item = action.item;
        if (isValue(item.type)) return state;
        const newTray = state.tray.filter((t) => t.id !== item.id);
        const wsNode = trayItemToWorkspaceNode(item);
        let newWorkspace: WorkspaceNode[];
        if (action.parentId === "root") {
          newWorkspace = [...state.workspace];
          newWorkspace.splice(action.index, 0, wsNode);
        } else {
          newWorkspace = updateNodeInTree(
            state.workspace,
            action.parentId,
            (parent) => {
              const children = [...parent.children];
              children.splice(action.index, 0, wsNode);
              return { ...parent, children };
            },
          );
        }
        return {
          ...state,
          tray: newTray,
          workspace: newWorkspace,
          draggingId: null,
          checkResult: { status: "unchecked" },
        };
      }

      case "DROP_ON_VALUE_SLOT": {
        const item = action.item;
        if (!isValue(item.type)) return state;
        const newTray = state.tray.filter((t) => t.id !== item.id);
        const wsNode = trayItemToWorkspaceNode(item);
        const newWorkspace = updateNodeInTree(
          state.workspace,
          action.parentId,
          (parent) => ({ ...parent, value: wsNode }),
        );
        return {
          ...state,
          tray: newTray,
          workspace: newWorkspace,
          draggingId: null,
          checkResult: { status: "unchecked" },
        };
      }

      case "DROP_ON_VALUES_SLOT": {
        const item = action.item;
        if (!isValue(item.type)) return state;
        const newTray = state.tray.filter((t) => t.id !== item.id);
        const wsNode = trayItemToWorkspaceNode(item);
        const newWorkspace = updateNodeInTree(
          state.workspace,
          action.parentId,
          (parent) => {
            const values = [...parent.values];
            values[action.index] = wsNode;
            return { ...parent, values };
          },
        );
        return {
          ...state,
          tray: newTray,
          workspace: newWorkspace,
          draggingId: null,
          checkResult: { status: "unchecked" },
        };
      }

      case "DROP_ON_CHILDREN": {
        const item = action.item;
        if (isValue(item.type)) return state;
        const newTray = state.tray.filter((t) => t.id !== item.id);
        const wsNode = trayItemToWorkspaceNode(item);
        const newWorkspace = updateNodeInTree(
          state.workspace,
          action.parentId,
          (parent) => {
            const children = [...parent.children];
            children.splice(action.index, 0, wsNode);
            return { ...parent, children };
          },
        );
        return {
          ...state,
          tray: newTray,
          workspace: newWorkspace,
          draggingId: null,
          checkResult: { status: "unchecked" },
        };
      }

      case "REMOVE_FROM_WORKSPACE": {
        const { removed, updated } = removeNode(state.workspace, action.id);
        if (!removed) return state;
        const returnedItems = workspaceNodeToTrayItems(removed, allOriginals);
        return {
          ...state,
          workspace: updated,
          tray: [...state.tray, ...returnedItems],
          draggingId: null,
          checkResult: { status: "unchecked" },
        };
      }

      case "CHECK": {
        const result = checkSolution(state.workspace, answer);
        return { ...state, checkResult: result };
      }

      case "SHUFFLE":
        return { ...state, tray: shuffle(state.tray) };

      case "RESET":
        return {
          tray: shuffle(action.tray),
          workspace: [],
          draggingId: null,
          checkResult: { status: "unchecked" },
        };

      default:
        return state;
    }
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PuzzleWorkspace({
  title,
  difficulty,
  plan,
  complexity,
  initialTray,
  answer,
}: PuzzleWorkspaceProps) {
  // Build a lookup map for restoring tray items on remove
  const allOriginals = new Map<string, TrayItem>();
  for (const item of initialTray) {
    allOriginals.set(item.id, item);
  }

  const reducer = createReducer(allOriginals, answer);

  const [state, dispatch] = useReducer(reducer, {
    tray: initialTray,
    workspace: [],
    draggingId: null,
    checkResult: { status: "unchecked" },
  });

  // Shuffle tray on mount (avoids Math.random during SSR/prerender)
  useEffect(() => {
    dispatch({ type: "SHUFFLE" });
  }, []);

  const handleDragStart = useCallback(
    (id: string) => dispatch({ type: "DRAG_START", id }),
    [],
  );
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    dispatch({ type: "DRAG_END" });
  }, []);
  const handleRemove = useCallback(
    (id: string) => dispatch({ type: "REMOVE_FROM_WORKSPACE", id }),
    [],
  );

  const handleDropOnRoot = useCallback(
    (index: number) => {
      const item = getDraggedItem();
      if (!item) return;
      setDraggedItem(null);
      dispatch({ type: "DROP_ON_STACK", item, parentId: "root", index });
    },
    [],
  );

  const handleDropChildren = useCallback(
    (parentId: string, index: number) => {
      const item = getDraggedItem();
      if (!item) return;
      setDraggedItem(null);
      if (parentId === "root") {
        dispatch({ type: "DROP_ON_STACK", item, parentId: "root", index });
      } else {
        dispatch({ type: "DROP_ON_CHILDREN", item, parentId, index });
      }
    },
    [],
  );

  const handleDropValueSlot = useCallback(
    (parentId: string) => {
      const item = getDraggedItem();
      if (!item) return;
      setDraggedItem(null);
      dispatch({ type: "DROP_ON_VALUE_SLOT", item, parentId });
    },
    [],
  );

  const handleDropValuesSlot = useCallback(
    (parentId: string, index: number) => {
      const item = getDraggedItem();
      if (!item) return;
      setDraggedItem(null);
      dispatch({ type: "DROP_ON_VALUES_SLOT", item, parentId, index });
    },
    [],
  );

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      {/* Header */}
      <div className="p-4 pb-0">
        <ProblemInfo
          title={title}
          difficulty={difficulty}
          plan={plan}
          complexity={complexity}
        />
      </div>

      {/* Workspace area */}
      <div className="flex-1 p-4">
        <WorkspaceBoard
          workspace={state.workspace}
          interactiveProps={{
            interactive: true,
            onRemove: handleRemove,
            onDropValueSlot: handleDropValueSlot,
            onDropValuesSlot: handleDropValuesSlot,
            onDropChildren: handleDropChildren,
          }}
          onDropOnRoot={handleDropOnRoot}
        />
      </div>

      {/* Controls */}
      <div className="px-4 pb-2">
        <RunButton
          checkResult={state.checkResult}
          onCheck={() => dispatch({ type: "CHECK" })}
          onReset={() => dispatch({ type: "RESET", tray: initialTray })}
        />
      </div>

      {/* Tray */}
      <div className="p-4 pt-2">
        <BlockTray
          items={state.tray}
          draggingId={state.draggingId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </div>
    </div>
  );
}
