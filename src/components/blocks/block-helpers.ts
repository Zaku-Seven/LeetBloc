import type { BlockType } from "@/lib/gemma/types";
import { STATEMENT_BLOCK_TYPES, VALUE_BLOCK_TYPES } from "@/lib/gemma/types";

const CONTAINER_TYPES = new Set<BlockType>([
  "for_index",
  "for_each",
  "while",
  "if",
  "else",
]);

const STATEMENT_SET = new Set<string>(STATEMENT_BLOCK_TYPES);
const VALUE_SET = new Set<string>(VALUE_BLOCK_TYPES);

export function isContainer(type: BlockType): boolean {
  return CONTAINER_TYPES.has(type);
}

export function isStatement(type: BlockType): boolean {
  return STATEMENT_SET.has(type);
}

export function isValue(type: BlockType): boolean {
  return VALUE_SET.has(type);
}

/** Block types that have a single value slot (condition, range, rhs of assign) */
const VALUE_SLOT_TYPES = new Set<string>([
  "for_index",
  "for_each",
  "while",
  "if",
  "assign",
]);

export function typeHasValueSlot(type: BlockType): boolean {
  return VALUE_SLOT_TYPES.has(type);
}
