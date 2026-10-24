import type { BlockNode } from "@/lib/gemma/types";
import { getBlockColors } from "./block-colors";
import { Block3D } from "./Block3D";

const DEPTH_PX = 2;

interface ValueBlockProps {
  node: BlockNode;
  depth?: number;
}

export function ValueBlock({ node, depth = 0 }: ValueBlockProps) {
  const colors = getBlockColors(node.type);

  const hasOperands = node.values && node.values.length >= 2;

  return (
    <span className="inline-flex items-center relative" style={{ transformStyle: "preserve-3d" }}>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 ${colors.front} ${colors.text} text-xs font-mono font-semibold whitespace-nowrap`}
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

      {/* Right edge */}
      <span
        className={`absolute top-0 right-0 h-full rounded-r-full ${colors.right}`}
        style={{
          width: `${DEPTH_PX}px`,
          transform: `rotateY(90deg)`,
          transformOrigin: "right center",
        }}
      />

      {/* Bottom edge */}
      <span
        className={`absolute bottom-0 left-0 w-full rounded-b-full ${colors.bottom}`}
        style={{
          height: `${DEPTH_PX}px`,
          transform: `rotateX(-90deg)`,
          transformOrigin: "center bottom",
        }}
      />
    </span>
  );
}
