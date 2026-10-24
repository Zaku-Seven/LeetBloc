"use client";

import { useState } from "react";
import type { BlockNode } from "@/lib/gemma/types";
import type { BlockInteractiveProps } from "./Block3D";
import { Block3D } from "./Block3D";
import { getDraggedItem } from "@/lib/puzzle/drag-state";
import { isValue } from "./block-helpers";

interface BlockSlotProps extends BlockInteractiveProps {
  child?: BlockNode;
  depth?: number;
  /** Parent block id for drop targeting */
  parentId?: string;
  /** Whether this is a "value" or "values" slot */
  slotKind?: "value" | "values";
  /** Index within values array (only for slotKind="values") */
  slotIndex?: number;
}

export function BlockSlot({
  child,
  depth = 0,
  interactive,
  parentId,
  slotKind,
  slotIndex,
  onDropValueSlot,
  onDropValuesSlot,
  ...interactiveProps
}: BlockSlotProps) {
  const [over, setOver] = useState(false);

  if (child) {
    return (
      <span className="inline-flex items-center">
        <Block3D node={child} depth={depth} interactive={interactive} {...interactiveProps} />
      </span>
    );
  }

  // Interactive empty slot — acts as a drop zone for value blocks
  if (interactive && parentId && slotKind) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs italic transition-all cursor-default ${
          over
            ? "bg-blue-300/60 border-2 border-dashed border-blue-500 opacity-100"
            : "bg-black/15 opacity-50"
        }`}
        onDragOver={(e) => {
          const item = getDraggedItem();
          if (item && isValue(item.type)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          const item = getDraggedItem();
          if (!item || !isValue(item.type)) return;
          if (slotKind === "value" && onDropValueSlot) {
            onDropValueSlot(parentId);
          } else if (slotKind === "values" && onDropValuesSlot && slotIndex !== undefined) {
            onDropValuesSlot(parentId, slotIndex);
          }
        }}
      >
        ...
      </span>
    );
  }

  // Static empty slot
  return (
    <span className="inline-flex items-center rounded-full bg-black/15 px-3 py-0.5 text-xs italic opacity-50">
      ...
    </span>
  );
}
