import type { BlockNode } from "@/lib/gemma/types";
import { getBlockColors } from "./block-colors";
import { Block3D } from "./Block3D";

interface ValueBlockProps {
  node: BlockNode;
  depth?: number;
}

export function ValueBlock({ node, depth = 0 }: ValueBlockProps) {
  const colors = getBlockColors(node.type);

  const hasOperands = node.values && node.values.length >= 2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${colors.bg} ${colors.text} border-b ${colors.border} text-xs font-mono font-semibold whitespace-nowrap`}
    >
      {hasOperands ? (
        <>
          <Block3D node={node.values![0]} depth={depth + 1} />
          <span>{node.label}</span>
          <Block3D node={node.values![1]} depth={depth + 1} />
        </>
      ) : node.value ? (
        <>
          <span>{node.label}</span>
          <Block3D node={node.value} depth={depth + 1} />
        </>
      ) : (
        <span>{node.label}</span>
      )}
    </span>
  );
}
