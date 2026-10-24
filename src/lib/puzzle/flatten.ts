import type { BlockNode } from "@/lib/gemma/types";
import type { TrayItem } from "./types";
import { isContainer as checkContainer } from "@/components/blocks/block-helpers";
import { isValue } from "@/components/blocks/block-helpers";

/**
 * Walk a BlockNode tree and extract every node as a standalone TrayItem.
 * Value blocks nested inside statements are extracted separately;
 * the tray item records slot metadata so WorkspaceNodes can be
 * reconstructed with the right number of empty holes.
 */
export function flattenTree(blocks: BlockNode[]): TrayItem[] {
  const items: TrayItem[] = [];

  function walk(node: BlockNode) {
    // For value blocks, we only extract leaf-level values
    // (the plan flattens every node into a tray piece)
    const isVal = isValue(node.type);
    const isCont = checkContainer(node.type);

    items.push({
      id: node.id,
      type: node.type,
      label: node.label,
      hasValueSlot: !!node.value,
      valuesSlotCount: node.values?.length ?? 0,
      isContainer: isCont,
      original: stripChildren(node),
    });

    // Recurse into nested value
    if (node.value) {
      walk(node.value);
    }

    // Recurse into multi-values
    if (node.values) {
      for (const v of node.values) {
        walk(v);
      }
    }

    // Recurse into children (statements inside containers)
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const block of blocks) {
    walk(block);
  }

  return items;
}

/**
 * Create a shallow copy of a BlockNode with children/value/values removed.
 * This is the "standalone" version shown in the tray — just label + type.
 */
function stripChildren(node: BlockNode): BlockNode {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
  };
}
