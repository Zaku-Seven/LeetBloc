import type { BlockNode } from "@/lib/gemma/types";
import { Block3D } from "./Block3D";

interface BlockStackProps {
  blocks: BlockNode[];
  depth?: number;
}

export function BlockStack({ blocks, depth = 0 }: BlockStackProps) {
  return (
    <div className="flex flex-col">
      {blocks.map((block, i) => {
        const isFirst = i === 0;
        const isLast = i === blocks.length - 1;

        // Suppress bump/notch between if → else pairs
        const nextIsElse =
          block.type === "if" && blocks[i + 1]?.type === "else";
        const prevIsIf =
          block.type === "else" && blocks[i - 1]?.type === "if";

        return (
          <Block3D
            key={block.id}
            node={block}
            depth={depth}
            isFirst={isFirst || prevIsIf}
            isLast={isLast || nextIsElse}
          />
        );
      })}
    </div>
  );
}
