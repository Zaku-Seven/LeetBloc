"use client";

import type { BlockNode } from "@/lib/gemma/types";
import { isContainer, isValue } from "./block-helpers";
import { ContainerBlock } from "./ContainerBlock";
import { StatementBlock } from "./StatementBlock";
import { ValueBlock } from "./ValueBlock";

export interface BlockInteractiveProps {
  /** Enable drag-and-drop interactivity */
  interactive?: boolean;
  /** Called when a block's remove button is clicked */
  onRemove?: (id: string) => void;
  /** Called when a value block is dropped on a value slot */
  onDropValueSlot?: (parentId: string) => void;
  /** Called when a value block is dropped on a values slot */
  onDropValuesSlot?: (parentId: string, index: number) => void;
  /** Called when a statement block is dropped on a children area */
  onDropChildren?: (parentId: string, index: number) => void;
}

interface Block3DProps extends BlockInteractiveProps {
  node: BlockNode;
  depth?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

export function Block3D({
  node,
  depth = 0,
  isFirst = false,
  isLast = false,
  ...interactiveProps
}: Block3DProps) {
  if (isValue(node.type)) {
    return <ValueBlock node={node} depth={depth} {...interactiveProps} />;
  }

  if (isContainer(node.type)) {
    return (
      <ContainerBlock
        node={node}
        depth={depth}
        isFirst={isFirst}
        isLast={isLast}
        {...interactiveProps}
      />
    );
  }

  return (
    <StatementBlock
      node={node}
      depth={depth}
      isFirst={isFirst}
      isLast={isLast}
      {...interactiveProps}
    />
  );
}
