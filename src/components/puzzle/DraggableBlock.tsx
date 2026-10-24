"use client";

import type { TrayItem } from "@/lib/puzzle/types";
import { setDraggedItem } from "@/lib/puzzle/drag-state";
import { Block3D } from "@/components/blocks/Block3D";

interface DraggableBlockProps {
  item: TrayItem;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export function DraggableBlock({
  item,
  onDragStart,
  onDragEnd,
  isDragging,
}: DraggableBlockProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
        // Set text/plain so the browser shows a drag ghost
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart(item.id);
      }}
      onDragEnd={() => {
        setDraggedItem(null);
        onDragEnd();
      }}
      className={`cursor-grab active:cursor-grabbing transition-opacity shrink-0 ${
        isDragging ? "opacity-30" : "opacity-100"
      }`}
    >
      <Block3D node={item.original} depth={0} isFirst isLast />
    </div>
  );
}
