export type TrayPiece = {
  id: string;
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
    label: "make a memory",
    hint: "A place to save numbers you have already passed.",
    color: "#F0B040",
    ink: "#104070",
    python: "seen = {}",
  },
  {
    id: "walk",
    label: "walk the list",
    hint: "Look at each number once, from the start.",
    color: "#309060",
    ink: "#104070",
    python: "for i in range(len(nums)):",
  },
  {
    id: "test",
    label: "test the pair",
    hint: "Have we already seen the number that finishes the pair?",
    color: "#B070B0",
    ink: "#F0E0D0",
    python: "if target - nums[i] in seen:",
  },
  {
    id: "remember",
    label: "remember this number",
    hint: "Save this number and the index where it was.",
    color: "#F07030",
    ink: "#104070",
    python: "seen[nums[i]] = i",
  },
  {
    id: "answer",
    label: "answer",
    hint: "Give back the two indexes.",
    color: "#E04030",
    ink: "#F0E0D0",
    python: "return [seen[target - nums[i]], i]",
  },
  {
    id: "extra-sort",
    label: "sort the list",
    hint: "Sorting is a different idea.",
    color: "#F0B040",
    ink: "#104070",
    python: "nums.sort()",
    distractor: true,
  },
];

export const TWO_SUM_ORDER = ["memory", "walk", "test", "remember", "answer"];

export function pythonPeek(placed: TrayPiece[]): string {
  const body = placed.map((piece) => `    ${piece.python}`).join("\n");
  return `def twoSum(nums, target):\n${body || "    pass"}`;
}

export function gradePlacement(placed: TrayPiece[]): { ok: boolean; message: string } {
  if (placed.length === 0) {
    return {
      ok: false,
      message: "Place a piece on the board, then check.",
    };
  }
  if (placed.some((piece) => piece.distractor)) {
    return {
      ok: false,
      message: "Sort isn't how this one goes. Send that piece back to the tray.",
    };
  }
  const ids = placed.map((piece) => piece.id);
  if (ids.join() === TWO_SUM_ORDER.join()) {
    return {
      ok: true,
      message:
        "That is the fast way. You save each number, then look for the one that finishes the pair. nums is 2 and 7, target is 9, and the answer is the indexes 0 and 1.",
    };
  }
  const samePieces = [...ids].sort().join() === [...TWO_SUM_ORDER].sort().join();
  if (samePieces) {
    return {
      ok: false,
      message: "The pieces are the right ones. Walk the list before you remember the number.",
    };
  }
  return {
    ok: false,
    message: `You placed ${placed.length} of 5 pieces. nums is 2 and 7, target is 9.`,
  };
}
