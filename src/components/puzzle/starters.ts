export type Starter = {
  slug: string;
  title: string;
  sentence: string;
  example: string;
  prompt: string;
  playable: boolean;
};

export const STARTERS: Starter[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    sentence: "Save each number, then look for the one that finishes the pair.",
    example: "nums is 2 and 7. target is 9. The indexes are 0 and 1.",
    prompt:
      "Given an array of integers nums and an integer target, return the indexes of the two numbers that add up to target. Each input has one solution, and you may not use the same element twice.",
    playable: true,
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    sentence: "A closing bracket has to match the last one you opened.",
    example: "()[]{} is valid. (] is not.",
    prompt:
      "Given a string of brackets, decide if every opening bracket is closed by the same kind, in the right order.",
    playable: false,
  },
  {
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    sentence: "Remember the cheapest day so far, and how much you could gain today.",
    example: "Prices 7, 1, 5, 3, 6, 4. Buy on day 2, sell on day 5. Profit is 5.",
    prompt:
      "You are given an array of prices, one per day. Choose one day to buy and a later day to sell, so the profit is as large as it can be.",
    playable: false,
  },
];
