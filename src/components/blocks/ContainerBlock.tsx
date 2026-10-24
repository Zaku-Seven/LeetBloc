"use client";

import type { BlockNode } from "@/lib/gemma/types";
import type { BlockInteractiveProps } from "./Block3D";
import { getBlockColors } from "./block-colors";
import { typeHasValueSlot } from "./block-helpers";
import { BlockSlot } from "./BlockSlot";
import { BlockStack } from "./BlockStack";
import { StackDropZone } from "./StackDropZone";

interface ContainerBlockProps extends BlockInteractiveProps {
  node: BlockNode;
  depth?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ContainerBlock({
  node,
  depth = 0,
  isFirst = false,
  isLast = false,
  interactive,
  onRemove,
  onDropChildren,
  ...interactiveProps
}: ContainerBlockProps) {
  const colors = getBlockColors(node.type);

  return (
    <div className="relative w-fit group/container">
      {/* Top notch tab */}
      {!isFirst && (
        <div className="ml-4">
          <div className={`w-3 h-1 rounded-t ${colors.bg}`} />
        </div>
      )}

      {/* Header bar */}
      <div
        className={`rounded-t px-3 py-1.5 ${colors.bg} ${colors.text} border-b ${colors.border}`}
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
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/container:opacity-100 transition-opacity hover:bg-red-600 z-10"
            title="Remove block"
          >
            x
          </button>
        )}
      </div>

      {/* C-shape body */}
      <div className="flex">
        {/* Left spine */}
        <div className={`w-4 ${colors.bg} border-r ${colors.border}`} />

        {/* Children area */}
        <div className="flex-1 py-1 pl-1 min-h-[28px] bg-zinc-100">
          {node.children && node.children.length > 0 ? (
            <BlockStack
              blocks={node.children}
              depth={depth + 1}
              interactive={interactive}
              parentId={node.id}
              onRemove={onRemove}
              onDropChildren={onDropChildren}
              {...interactiveProps}
            />
          ) : interactive && onDropChildren ? (
            <StackDropZone
              parentId={node.id}
              index={0}
              onDrop={onDropChildren}
            />
          ) : (
            <div className="h-7 rounded border-2 border-dashed border-zinc-300" />
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        className={`rounded-b h-2.5 ${colors.bg} border-b-2 ${colors.border}`}
      >
        {/* Inner notch on footer */}
        <div className="ml-4">
          <div className="w-3 h-1 bg-zinc-100 rounded-b" />
        </div>
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
