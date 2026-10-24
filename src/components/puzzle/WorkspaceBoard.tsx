"use client";

import { useState } from "react";
import type { WorkspaceNode } from "@/lib/puzzle/types";
import type { BlockInteractiveProps } from "@/components/blocks/Block3D";
import { BlockStack } from "@/components/blocks/BlockStack";
import { getDraggedItem } from "@/lib/puzzle/drag-state";
import { isValue } from "@/components/blocks/block-helpers";

interface WorkspaceBoardProps {
  workspace: WorkspaceNode[];
  interactiveProps: BlockInteractiveProps;
  onDropOnRoot: (index: number) => void;
}

export function WorkspaceBoard({
  workspace,
  interactiveProps,
  onDropOnRoot,
}: WorkspaceBoardProps) {
  const [rootOver, setRootOver] = useState(false);

  const workspaceAsBlockNodes = workspace.map(function toBlockNode(
    w: WorkspaceNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    return {
      id: w.id,
      type: w.type,
      label: w.label,
      value: w.value ? toBlockNode(w.value) : undefined,
      values:
        w.values.length > 0
          ? w.values.map((v) => (v ? toBlockNode(v) : undefined))
          : undefined,
      children:
        w.children.length > 0
          ? w.children.map((c) => toBlockNode(c))
          : w.isContainer
            ? []
            : undefined,
    };
  });

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-sm p-4 min-h-[300px] transition-colors ${
        rootOver
          ? "border-blue-400 bg-blue-50/30"
          : "border-dashed border-zinc-300"
      }`}
      onDragOver={(e) => {
        const item = getDraggedItem();
        if (item && !isValue(item.type)) {
          e.preventDefault();
          setRootOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setRootOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setRootOver(false);
        const item = getDraggedItem();
        if (item && !isValue(item.type)) {
          onDropOnRoot(workspace.length);
        }
      }}
    >
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Workspace
      </h2>

      {workspace.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-zinc-400 text-sm pointer-events-none">
          Drag statement blocks here to build your solution
        </div>
      ) : (
        <BlockStack
          blocks={workspaceAsBlockNodes}
          depth={0}
          parentId="root"
          {...interactiveProps}
          interactive
        />
      )}
    </div>
  );
}
