import type { BlockType } from "@/lib/gemma/types";

export interface BlockColorSet {
  front: string;
  right: string;
  bottom: string;
  text: string;
  slotBg: string;
}

const COLORS = {
  control: {
    front: "bg-amber-400",
    right: "bg-amber-500",
    bottom: "bg-amber-600",
    text: "text-amber-950",
    slotBg: "bg-amber-600/40",
  },
  data: {
    front: "bg-blue-400",
    right: "bg-blue-500",
    bottom: "bg-blue-600",
    text: "text-blue-950",
    slotBg: "bg-blue-600/40",
  },
  output: {
    front: "bg-green-400",
    right: "bg-green-500",
    bottom: "bg-green-600",
    text: "text-green-950",
    slotBg: "bg-green-600/40",
  },
  variable: {
    front: "bg-purple-400",
    right: "bg-purple-500",
    bottom: "bg-purple-600",
    text: "text-purple-950",
    slotBg: "bg-purple-600/40",
  },
  operation: {
    front: "bg-teal-400",
    right: "bg-teal-500",
    bottom: "bg-teal-600",
    text: "text-teal-950",
    slotBg: "bg-teal-600/40",
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
  string: "variable",
  bool: "variable",
  list: "variable",
  index: "variable",
  length: "variable",
  binop: "operation",
  compare: "operation",
  in_set: "operation",
  map_get: "operation",
  not: "operation",
  call: "operation",
};

export function getBlockColors(type: BlockType): BlockColorSet {
  return COLORS[TYPE_TO_CATEGORY[type]];
}
