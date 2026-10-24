import type { BlockNode } from "@/lib/gemma/types";
import { isContainer, isValue } from "./block-helpers";
import { ContainerBlock } from "./ContainerBlock";
import { StatementBlock } from "./StatementBlock";
import { ValueBlock } from "./ValueBlock";

interface Block3DProps {
  node: BlockNode;
  depth?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

export function Block3D({
  node,
  depth = 0,
  isFirst = false,
  isLast = false,
}: Block3DProps) {
  if (isValue(node.type)) {
    return <ValueBlock node={node} depth={depth} />;
  }

  if (isContainer(node.type)) {
    return (
      <ContainerBlock
        node={node}
        depth={depth}
        isFirst={isFirst}
        isLast={isLast}
      />
    );
  }

  return (
    <StatementBlock
      node={node}
      depth={depth}
      isFirst={isFirst}
      isLast={isLast}
    />
  );
}
