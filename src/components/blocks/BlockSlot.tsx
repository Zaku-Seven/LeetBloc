import type { BlockNode } from "@/lib/gemma/types";
import { Block3D } from "./Block3D";

interface BlockSlotProps {
  child?: BlockNode;
  depth?: number;
}

export function BlockSlot({ child, depth = 0 }: BlockSlotProps) {
  if (child) {
    return (
      <span className="inline-flex items-center">
        <Block3D node={child} depth={depth} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-black/15 px-3 py-0.5 text-xs italic opacity-50">
      ...
    </span>
  );
}
