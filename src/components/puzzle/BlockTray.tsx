"use client";

import type { TrayItem } from "@/lib/puzzle/types";
import { DraggableBlock } from "./DraggableBlock";
import { isValue } from "@/components/blocks/block-helpers";

interface BlockTrayProps {
  items: TrayItem[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export function BlockTray({
  items,
  draggingId,
  onDragStart,
  onDragEnd,
}: BlockTrayProps) {
  const statements = items.filter((i) => !isValue(i.type));
  const values = items.filter((i) => isValue(i.type));

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Available Blocks ({items.length})
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400 italic">
          All blocks placed! Click Run to check your solution.
        </p>
      ) : (
        <div className="space-y-3">
          {statements.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Statements</p>
              <div className="flex flex-wrap gap-2">
                {statements.map((item) => (
                  <DraggableBlock
                    key={item.id}
                    item={item}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    isDragging={draggingId === item.id}
                  />
                ))}
              </div>
            </div>
          )}

          {values.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Values</p>
              <div className="flex flex-wrap gap-2">
                {values.map((item) => (
                  <DraggableBlock
                    key={item.id}
                    item={item}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    isDragging={draggingId === item.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
