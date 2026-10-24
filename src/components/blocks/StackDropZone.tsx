"use client";

import { useState } from "react";
import { getDraggedItem } from "@/lib/puzzle/drag-state";
import { isValue } from "./block-helpers";

interface StackDropZoneProps {
  parentId: string;
  index: number;
  onDrop: (parentId: string, index: number) => void;
}

export function StackDropZone({ parentId, index, onDrop }: StackDropZoneProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`h-1.5 mx-1 rounded transition-all ${
        over ? "h-6 bg-blue-300/50 border-2 border-dashed border-blue-400" : ""
      }`}
      onDragOver={(e) => {
        const item = getDraggedItem();
        if (item && !isValue(item.type)) {
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
        if (item && !isValue(item.type)) {
          onDrop(parentId, index);
        }
      }}
    />
  );
}
