import type { BlockNode } from "@/lib/gemma/types";
import { getBlockColors } from "./block-colors";
import { BlockSlot } from "./BlockSlot";

interface StatementBlockProps {
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
}: StatementBlockProps) {
  const colors = getBlockColors(node.type);

  return (
    <div className="relative w-fit">
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
          {node.value && (
            <BlockSlot child={node.value} depth={depth + 1} />
          )}
          {node.values?.map((v) => (
            <BlockSlot key={v.id} child={v} depth={depth + 1} />
          ))}
        </span>
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
