import type { BlockType } from "@/lib/gemma/types";

export interface BlockColorSet {
  bg: string;
  border: string;
  text: string;
  slotBg: string;
}

const COLORS = {
  control: {
    bg: "bg-amber-400",
    border: "border-amber-600",
    text: "text-amber-950",
    slotBg: "bg-amber-500/50",
  },
  data: {
    bg: "bg-blue-400",
    border: "border-blue-600",
    text: "text-blue-950",
    slotBg: "bg-blue-500/50",
  },
  output: {
    bg: "bg-green-400",
    border: "border-green-600",
    text: "text-green-950",
    slotBg: "bg-green-500/50",
  },
  variable: {
    bg: "bg-purple-400",
    border: "border-purple-600",
    text: "text-purple-950",
    slotBg: "bg-purple-500/50",
  },
  operation: {
    bg: "bg-teal-400",
    border: "border-teal-600",
    text: "text-teal-950",
    slotBg: "bg-teal-500/50",
  },
} as const;

type Category = keyof typeof COLORS;

const TYPE_TO_CATEGORY: Record<BlockType, Category> = {
  for_index: "control",
  for_each: "control",
  while: "control",
  if: "control",
  else: "control",
  create: "data",
  assign: "data",
  append: "data",
  map_set: "data",
  set_add: "data",
  return: "output",
  var: "variable",
  number: "variable",
  index: "variable",
  length: "variable",
  binop: "operation",
  compare: "operation",
  in_set: "operation",
  map_get: "operation",
};

export function getBlockColors(type: BlockType): BlockColorSet {
  return COLORS[TYPE_TO_CATEGORY[type]];
}
