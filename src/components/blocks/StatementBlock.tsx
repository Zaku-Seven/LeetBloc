"use client";

import type { BlockNode } from "@/lib/gemma/types";
import type { BlockInteractiveProps } from "./Block3D";
import { getBlockColors } from "./block-colors";
import { typeHasValueSlot } from "./block-helpers";
import { BlockSlot } from "./BlockSlot";

interface StatementBlockProps extends BlockInteractiveProps {
  node: BlockNode;
  depth?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

export function StatementBlock({
  node,
  depth = 0,
  isFirst = false,
  isLast = false,
  interactive,
  onRemove,
  ...interactiveProps
}: StatementBlockProps) {
  const colors = getBlockColors(node.type);

  return (
    <div className="relative w-fit group/stmt">
      {/* Top notch tab */}
      {!isFirst && (
        <div className="ml-4">
          <div className={`w-3 h-1 rounded-t ${colors.bg}`} />
        </div>
      )}

      {/* Block body */}
      <div
        className={`relative rounded px-3 py-1.5 ${colors.bg} ${colors.text} border-b-2 ${colors.border}`}
      >
        <span className="font-mono text-sm font-semibold inline-flex items-center gap-1 flex-wrap">
          <span>{node.label}</span>
          {(node.value || (interactive && typeHasValueSlot(node.type))) && (
            <BlockSlot
              child={node.value}
              depth={depth + 1}
              interactive={interactive}
              parentId={node.id}
              slotKind="value"
              onDropValueSlot={interactiveProps.onDropValueSlot}
              {...interactiveProps}
            />
          )}
          {node.values?.map((v, i) => (
            <BlockSlot
              key={v?.id ?? `slot-${i}`}
              child={v}
              depth={depth + 1}
              interactive={interactive}
              parentId={node.id}
              slotKind="values"
              slotIndex={i}
              onDropValuesSlot={interactiveProps.onDropValuesSlot}
              {...interactiveProps}
            />
          ))}
        </span>
        {/* Remove button */}
        {interactive && onRemove && (
          <button
            onClick={() => onRemove(node.id)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/stmt:opacity-100 transition-opacity hover:bg-red-600 z-10"
            title="Remove block"
          >
            x
          </button>
        )}
      </div>

      {/* Bottom bump tab */}
      {!isLast && (
        <div className="ml-4">
          <div className={`w-3 h-1 rounded-b ${colors.bg} border-b ${colors.border}`} />
        </div>
      )}
    </div>
  );
}
