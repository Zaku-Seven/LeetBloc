import type { BlockNode } from "../types";

export const TWO_SUM_BRUTE_BLOCKS: BlockNode[] = [
  {
    id: "brute-1",
    type: "for_index",
    label: "for i in range(len(nums))",
    value: { id: "brute-1-range", type: "length", label: "len(nums)" },
    children: [
      {
        id: "brute-2",
        type: "for_index",
        label: "for j in range(i + 1, len(nums))",
        value: { id: "brute-2-range", type: "length", label: "len(nums)" },
        children: [
          {
            id: "brute-3",
            type: "if",
            label: "if nums[i] + nums[j] == target",
            value: {
              id: "brute-3-cond",
              type: "compare",
              label: "==",
              values: [
                {
                  id: "brute-3-left",
                  type: "binop",
                  label: "+",
                  values: [
                    { id: "brute-3-l1", type: "index", label: "nums[i]" },
                    { id: "brute-3-l2", type: "index", label: "nums[j]" },
                  ],
                },
                { id: "brute-3-right", type: "var", label: "target" },
              ],
            },
            children: [
              {
                id: "brute-4",
                type: "return",
                label: "return [i, j]",
                values: [
                  { id: "brute-4-a", type: "var", label: "i" },
                  { id: "brute-4-b", type: "var", label: "j" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const TWO_SUM_OPTIMIZED_BLOCKS: BlockNode[] = [
  {
    id: "opt-1",
    type: "create",
    label: "seen = {}",
  },
  {
    id: "opt-2",
    type: "for_index",
    label: "for i in range(len(nums))",
    value: {
      id: "opt-2-range",
      type: "length",
      label: "len(nums)",
    },
    children: [
      {
        id: "opt-3",
        type: "assign",
        label: "complement =",
        value: {
          id: "opt-3-val",
          type: "binop",
          label: "-",
          values: [
            { id: "opt-3-left", type: "var", label: "target" },
            { id: "opt-3-right", type: "index", label: "nums[i]" },
          ],
        },
      },
      {
        id: "opt-4",
        type: "if",
        label: "if complement in seen",
        value: {
          id: "opt-4-cond",
          type: "in_set",
          label: "complement in seen",
        },
        children: [
          {
            id: "opt-5",
            type: "return",
            label: "return [seen[complement], i]",
            values: [
              { id: "opt-5-a", type: "map_get", label: "seen[complement]" },
              { id: "opt-5-b", type: "var", label: "i" },
            ],
          },
        ],
      },
      {
        id: "opt-6",
        type: "map_set",
        label: "seen[nums[i]] = i",
        values: [
          { id: "opt-6-key", type: "index", label: "nums[i]" },
          { id: "opt-6-val", type: "var", label: "i" },
        ],
      },
    ],
  },
];
