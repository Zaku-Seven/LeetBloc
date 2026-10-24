import type { BlockNode } from "@/lib/gemma/types";
import { getBlockColors } from "./block-colors";
import { BlockSlot } from "./BlockSlot";
import { BlockStack } from "./BlockStack";

const DEPTH_PX = 4;
const NOTCH_W = 20;
const NOTCH_H = 4;
const SPINE_W = 16;

interface ContainerBlockProps {
  node: BlockNode;
  depth?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ContainerBlock({
  node,
  depth = 0,
  isFirst = false,
  isLast = false,
}: ContainerBlockProps) {
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

      {/* Header bar */}
      <div
        className={`relative rounded-t-lg px-3 py-2 ${colors.front} ${colors.text}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="font-mono text-sm font-semibold inline-flex items-center gap-1 flex-wrap">
          <span>{node.label}</span>
          {node.value && (
            <BlockSlot label="condition" child={node.value} depth={depth + 1} />
          )}
          {node.values?.map((v) => (
            <BlockSlot key={v.id} label="value" child={v} depth={depth + 1} />
          ))}
        </span>

        {/* Right edge on header */}
        <div
          className={`absolute top-0 right-0 h-full rounded-tr-lg ${colors.right}`}
          style={{
            width: `${DEPTH_PX}px`,
            transform: `rotateY(90deg)`,
            transformOrigin: "right center",
          }}
        />
      </div>

      {/* C-shape body: left spine + children area */}
      <div className="flex">
        {/* Left spine */}
        <div
          className={`${colors.front} relative`}
          style={{ width: SPINE_W, transformStyle: "preserve-3d" }}
        >
          {/* 3D edge on spine */}
          <div
            className={`absolute top-0 right-0 h-full ${colors.right}`}
            style={{
              width: `${DEPTH_PX}px`,
              transform: `rotateY(90deg)`,
              transformOrigin: "right center",
            }}
          />
        </div>

        {/* Children area */}
        <div className="flex-1 py-1 pl-1 min-h-[32px]">
          {node.children && node.children.length > 0 ? (
            <BlockStack blocks={node.children} depth={depth + 1} />
          ) : (
            <div className="h-8 rounded bg-zinc-100/60 border-2 border-dashed border-zinc-300" />
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div
        className={`relative rounded-b-lg ${colors.front}`}
        style={{ height: 12, transformStyle: "preserve-3d" }}
      >
        {/* Right edge on footer */}
        <div
          className={`absolute top-0 right-0 h-full rounded-br-lg ${colors.right}`}
          style={{
            width: `${DEPTH_PX}px`,
            transform: `rotateY(90deg)`,
            transformOrigin: "right center",
          }}
        />

        {/* Bottom edge on footer */}
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
