"use client";

import type { BlockNode } from "@/lib/gemma/types";
import type { BlockInteractiveProps } from "./Block3D";
import { getBlockColors } from "./block-colors";
import { Block3D } from "./Block3D";

interface ValueBlockProps extends BlockInteractiveProps {
  node: BlockNode;
  depth?: number;
}

export function ValueBlock({
  node,
  depth = 0,
  interactive,
  onRemove,
  ...interactiveProps
}: ValueBlockProps) {
  const colors = getBlockColors(node.type);

  const hasOperands = node.values && node.values.length >= 2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${colors.bg} ${colors.text} border-b ${colors.border} text-xs font-mono font-semibold whitespace-nowrap relative group/value`}
    >
      {hasOperands ? (
        <>
          <Block3D node={node.values![0]} depth={depth + 1} interactive={interactive} onRemove={onRemove} {...interactiveProps} />
          <span>{node.label}</span>
          <Block3D node={node.values![1]} depth={depth + 1} interactive={interactive} onRemove={onRemove} {...interactiveProps} />
        </>
      ) : node.value ? (
        <>
          <span>{node.label}</span>
          <Block3D node={node.value} depth={depth + 1} interactive={interactive} onRemove={onRemove} {...interactiveProps} />
        </>
      ) : (
        <span>{node.label}</span>
      )}
      {/* Remove button for value blocks in workspace */}
      {interactive && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(node.id);
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/value:opacity-100 transition-opacity hover:bg-red-600 z-10"
          title="Remove block"
        >
          x
        </button>
      )}
    </span>
  );
}
