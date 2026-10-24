import type { BlockNode } from "@/lib/gemma/types";
import { getBlockColors } from "./block-colors";
import { BlockSlot } from "./BlockSlot";

const DEPTH_PX = 4;
const NOTCH_W = 20;
const NOTCH_H = 4;

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
    <div className="relative" style={{ transformStyle: "preserve-3d" }}>
      {/* Top notch indent */}
      {!isFirst && (
        <div className="flex justify-center">
          <div
            className="bg-zinc-100"
            style={{ width: NOTCH_W, height: NOTCH_H }}
          />
        </div>
      )}

      {/* Front face */}
      <div
        className={`relative rounded-lg px-3 py-2 ${colors.front} ${colors.text}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="font-mono text-sm font-semibold inline-flex items-center gap-1 flex-wrap">
          <span>{node.label}</span>
          {node.value && (
            <BlockSlot label="value" child={node.value} depth={depth + 1} />
          )}
          {node.values?.map((v) => (
            <BlockSlot key={v.id} label="value" child={v} depth={depth + 1} />
          ))}
        </span>

        {/* Right edge */}
        <div
          className={`absolute top-0 right-0 h-full rounded-r-lg ${colors.right}`}
          style={{
            width: `${DEPTH_PX}px`,
            transform: `rotateY(90deg)`,
            transformOrigin: "right center",
          }}
        />

        {/* Bottom edge */}
        <div
          className={`absolute bottom-0 left-0 w-full rounded-b-lg ${colors.bottom}`}
          style={{
            height: `${DEPTH_PX}px`,
            transform: `rotateX(-90deg)`,
            transformOrigin: "center bottom",
          }}
        />
      </div>

      {/* Bottom bump */}
      {!isLast && (
        <div className="flex justify-center">
          <div
            className={`${colors.front}`}
            style={{ width: NOTCH_W, height: NOTCH_H }}
          />
        </div>
      )}
    </div>
  );
}
