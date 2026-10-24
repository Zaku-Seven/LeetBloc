"use client";

import type { BlockNode } from "@/lib/gemma/types";
import type { BlockInteractiveProps } from "./Block3D";
import { Block3D } from "./Block3D";
import { StackDropZone } from "./StackDropZone";

interface BlockStackProps extends BlockInteractiveProps {
  blocks: BlockNode[];
  depth?: number;
  /** Parent id for drop targets (only used when interactive) */
  parentId?: string;
}

export function BlockStack({
  blocks,
  depth = 0,
  parentId,
  ...interactiveProps
}: BlockStackProps) {
  const { interactive, onDropChildren } = interactiveProps;

  return (
    <div className="flex flex-col">
      {interactive && parentId && onDropChildren && (
        <StackDropZone
          parentId={parentId}
          index={0}
          onDrop={onDropChildren}
        />
      )}
      {blocks.map((block, i) => {
        const isFirst = i === 0;
        const isLast = i === blocks.length - 1;

        // Suppress bump/notch between if -> else pairs
        const nextIsElse =
          block.type === "if" && blocks[i + 1]?.type === "else";
        const prevIsIf =
          block.type === "else" && blocks[i - 1]?.type === "if";

        return (
          <div key={block.id}>
            <Block3D
              node={block}
              depth={depth}
              isFirst={isFirst || prevIsIf}
              isLast={isLast || nextIsElse}
              {...interactiveProps}
            />
            {interactive && parentId && onDropChildren && (
              <StackDropZone
                parentId={parentId}
                index={i + 1}
                onDrop={onDropChildren}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
