export type BlockShape = "stack" | "c" | "cap";

export type TrayPiece = {
  id: string;
  shape: BlockShape;
  label: string;
  hint: string;
  /** Fill from the illustration palette. */
  color: string;
  /** Cream text on the darker fills. */
  ink: string;
  python: string;
  distractor?: boolean;
};

export const TWO_SUM_PIECES: TrayPiece[] = [
  {
    id: "memory",
    shape: "stack",
    label: "make a memory",
    hint: "A place to save numbers you have already passed.",
    color: "#F0B040",
    ink: "#104070",
    python: "seen = {}",
  },
  {
    id: "walk",
    shape: "c",
    label: "walk the list",
    hint: "Look at each number once. The next pieces click inside.",
    color: "#309060",
    ink: "#104070",
    python: "for i in range(len(nums)):",
  },
  {
    id: "test",
    shape: "c",
    label: "test the pair",
    hint: "Have we already seen the number that finishes the pair? The answer clicks inside.",
    color: "#B070B0",
    ink: "#F0E0D0",
    python: "if target - nums[i] in seen:",
  },
  {
    id: "remember",
    shape: "stack",
    label: "remember this number",
    hint: "Save this number and the index where it was.",
    color: "#F07030",
    ink: "#104070",
    python: "seen[nums[i]] = i",
  },
  {
    id: "answer",
    shape: "cap",
    label: "answer",
    hint: "Give back the two indexes.",
    color: "#E04030",
    ink: "#F0E0D0",
    python: "return [seen[target - nums[i]], i]",
  },
  {
    id: "extra-sort",
    shape: "stack",
    label: "sort the list",
    hint: "Sorting is a different idea.",
    color: "#F0B040",
    ink: "#104070",
    python: "nums.sort()",
    distractor: true,
  },
];

export const TWO_SUM_ORDER = ["memory", "walk", "test", "remember", "answer"];
