import type { BlockNode } from "@/lib/gemma/types";
import { Block3D } from "./Block3D";

interface BlockSlotProps {
  label: string;
  child?: BlockNode;
  depth?: number;
}

export function BlockSlot({ label, child, depth = 0 }: BlockSlotProps) {
  if (child) {
    return (
      <span className="inline-flex items-center mx-1">
        <Block3D node={child} depth={depth} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center mx-1 rounded-full bg-black/20 px-3 py-0.5 text-xs italic opacity-60">
      {label}
    </span>
  );
}
