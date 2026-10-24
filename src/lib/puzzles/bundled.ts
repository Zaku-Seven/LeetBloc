// The three starter problems. They are hand-written, so they open even when
// LeetCode or generation is unavailable. Statements are paraphrased.

import type { TestCase } from "../blocks/catalog";
import {
  append, assign, bin, bool, call, cmp, create, elseBlock, finalize, forEach, forIndex, get, has, hint, idx,
  ifBlock, len, list, mapSet, num, ret, required, str, v, whileLoop,
} from "./build";
import type { Example, Problem, PuzzleCandidate } from "./types";

export interface BundledProblem {
  problem: Omit<Problem, "id" | "source" | "isPaid">;
  puzzle: PuzzleCandidate;
}

const tests = (pairs: [string, string][]): TestCase[] => pairs.map(([input, expected]) => ({ input, expected }));
const examples = (pairs: [string, string][]): Example[] => pairs.map(([input, output]) => ({ input, output }));

// --- Two Sum -------------------------------------------------------------

const twoSumBrute = finalize("ts_b", [
  hint(
    "Pick the first number of the pair.",
    forIndex("i", num(0), len(v("nums")), [
      hint(
        "Pick a second number, only from after the first.",
        forIndex("j", bin(v("i"), "+", num(1)), len(v("nums")), [
          hint(
            "Do these two add up to the target?",
            ifBlock(cmp(bin(idx(v("nums"), v("i")), "+", idx(v("nums"), v("j"))), "==", v("target")), [
              hint("Answer with both positions.", ret(list(v("i"), v("j")))),
            ]),
          ),
        ]),
      ),
    ]),
  ),
]);

const twoSumOptimized = finalize("ts_o", [
  hint("Make somewhere to remember each number and where it was.", required(create("seen", "map"))),
  hint(
    "Walk the list once.",
    forIndex("i", num(0), len(v("nums")), [
      hint("Which number would finish the pair?", assign("complement", bin(v("target"), "-", idx(v("nums"), v("i"))))),
      hint(
        "Have we already seen the number that would finish the pair?",
        required(
          ifBlock(has(v("seen"), v("complement")), [
            hint("Answer with where we saw it, and where we are now.", ret(list(get(v("seen"), v("complement")), v("i")))),
          ]),
        ),
      ),
      hint("Remember this number and its position.", required(mapSet("seen", idx(v("nums"), v("i")), v("i")))),
    ]),
  ),
]);

const twoSumDistractors = finalize("ts_d", [
  hint("Put the numbers in order.", assign("nums", call("sorted", v("nums")))),
  hint("Start the second number from the beginning.", forIndex("j", num(0), len(v("nums")), [])),
  hint("Make a list to collect answers.", create("pairs", "list")),
]);

const twoSum: BundledProblem = {
  problem: {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    contentText:
      "Given a list of integers nums and an integer target, return the positions of the two numbers that add up to target. " +
      "Every input has exactly one answer, and the same position cannot be used twice. Return the smaller position first.",
    examples: examples([
      ["nums = [2,7,11,15], target = 9", "[0,1]"],
      ["nums = [3,2,4], target = 6", "[1,2]"],
      ["nums = [3,3], target = 6", "[0,1]"],
    ]),
    pythonStub: "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        ",
  },
  puzzle: {
    brute: {
      plan: "Check every pair of positions. The pair whose numbers add up to the target is the answer.",
      complexity: "O(n²) time, O(1) space",
      ...twoSumBrute,
      requiredBlockIds: [],
    },
    optimized: {
      plan:
        "Walk the list once. For each number, work out which number would finish the pair. " +
        "If you have already seen it, you are done. Otherwise remember this number and where it was.",
      complexity: "O(n) time, O(n) space",
      ...twoSumOptimized,
    },
    distractors: twoSumDistractors.blocks,
    extraTests: tests([
      ["nums = [1,5,3,7], target = 10", "[2,3]"],
      ["nums = [-1,-2,-3,-4,-5], target = -8", "[2,4]"],
      ["nums = [0,4,3,0], target = 0", "[0,3]"],
    ]),
  },
};

// --- Valid Parentheses ---------------------------------------------------

const parensBrute = finalize("vp_b", [
  hint(
    "Keep going while there is still an empty pair to remove.",
    whileLoop(
      bin(bin(has(v("s"), str("()")), "or", has(v("s"), str("[]"))), "or", has(v("s"), str("{}"))),
      [
        hint(
          "Remove every empty pair.",
          assign("s", call("replace", call("replace", call("replace", v("s"), str("()"), str("")), str("[]"), str("")), str("{}"), str(""))),
        ),
      ],
    ),
  ),
  hint("Valid only if nothing is left.", ret(cmp(len(v("s")), "==", num(0)))),
]);

const parensOptimized = finalize("vp_o", [
  hint("Make a stack of brackets still waiting to close.", required(create("stack", "list"))),
  hint("Make somewhere to look up each closer's opener.", create("pairs", "map")),
  hint("A ) closes a (.", mapSet("pairs", str(")"), str("("))),
  hint("A ] closes a [.", mapSet("pairs", str("]"), str("["))),
  hint("A } closes a {.", mapSet("pairs", str("}"), str("{"))),
  hint(
    "Look at each character.",
    forEach("c", v("s"), [
      hint(
        "Is this a closing bracket?",
        ifBlock(has(v("pairs"), v("c")), [
          hint("Nothing is waiting to be closed.", ifBlock(cmp(len(v("stack")), "==", num(0)), [ret(bool(false))])),
          hint(
            "Does the most recent opener match?",
            required(ifBlock(cmp(call("pop", v("stack")), "!=", get(v("pairs"), v("c"))), [ret(bool(false))])),
          ),
        ]),
      ),
      hint(
        "Otherwise it is an opener.",
        elseBlock([hint("Wait for it to close.", required(append("stack", v("c"))))]),
      ),
    ]),
  ),
  hint("Valid only if nothing is still waiting.", ret(cmp(len(v("stack")), "==", num(0)))),
]);

const parensDistractors = finalize("vp_d", [
  hint("Count the opening brackets.", create("opens", "number")),
  hint("Put the characters in order.", assign("s", call("sorted", v("s")))),
  hint("Valid if the length is even.", ret(cmp(bin(len(v("s")), "%", num(2)), "==", num(0)))),
]);

const validParentheses: BundledProblem = {
  problem: {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    tags: ["String", "Stack"],
    contentText:
      "Given a string s made of the characters ( ) [ ] { }, decide whether it is valid. " +
      "It is valid when every opening bracket is closed by the same kind of bracket, in the right order, " +
      "and every closing bracket has an opening bracket before it.",
    examples: examples([
      ['s = "()"', "true"],
      ['s = "()[]{}"', "true"],
      ['s = "(]"', "false"],
      ['s = "([])"', "true"],
    ]),
    pythonStub: "class Solution:\n    def isValid(self, s: str) -> bool:\n        ",
  },
  puzzle: {
    brute: {
      plan: "Keep deleting empty pairs like () until none are left. The string is valid only if that empties it.",
      complexity: "O(n²) time, O(n) space",
      ...parensBrute,
      requiredBlockIds: [],
    },
    optimized: {
      plan:
        "Walk the string once with a stack. Push every opener. Each closer must match the opener on top of the stack. " +
        "At the end, nothing may be left waiting.",
      complexity: "O(n) time, O(n) space",
      ...parensOptimized,
    },
    distractors: parensDistractors.blocks,
    extraTests: tests([
      ['s = "([)]"', "false"],
      ['s = "{[]}"', "true"],
      ['s = "("', "false"],
      ['s = "]"', "false"],
      ['s = "(("', "false"],
    ]),
  },
};

// --- Best Time to Buy and Sell Stock --------------------------------------

const stockBrute = finalize("st_b", [
  hint("Start with no profit.", create("best", "number")),
  hint(
    "Pick a day to buy.",
    forIndex("i", num(0), len(v("prices")), [
      hint(
        "Pick a later day to sell.",
        forIndex("j", bin(v("i"), "+", num(1)), len(v("prices")), [
          hint(
            "Is this the best trade so far?",
            ifBlock(cmp(bin(idx(v("prices"), v("j")), "-", idx(v("prices"), v("i"))), ">", v("best")), [
              hint("Remember it.", assign("best", bin(idx(v("prices"), v("j")), "-", idx(v("prices"), v("i"))))),
            ]),
          ),
        ]),
      ),
    ]),
  ),
  hint("Answer with the best trade.", ret(v("best"))),
]);

const stockOptimized = finalize("st_o", [
  hint("Start with no profit.", create("best", "number")),
  hint("The cheapest price so far starts as the first day.", assign("low", idx(v("prices"), num(0)))),
  hint(
    "Walk the days once.",
    required(
      forEach("p", v("prices"), [
        hint("Is today the cheapest day yet?", required(assign("low", call("min", v("low"), v("p"))))),
        hint("Would selling today beat the best trade?", assign("best", call("max", v("best"), bin(v("p"), "-", v("low"))))),
      ]),
    ),
  ),
  hint("Answer with the best trade.", ret(v("best"))),
]);

const stockDistractors = finalize("st_d", [
  hint("Put the prices in order.", assign("prices", call("sorted", v("prices")))),
  hint("Buy at the highest price.", assign("low", call("max", v("prices")))),
]);

const bestTimeToBuyAndSellStock: BundledProblem = {
  problem: {
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    tags: ["Array", "Dynamic Programming"],
    contentText:
      "prices[i] is a stock's price on day i. Choose one day to buy and a later day to sell. " +
      "Return the largest profit you can make, or 0 if no trade makes money.",
    examples: examples([
      ["prices = [7,1,5,3,6,4]", "5"],
      ["prices = [7,6,4,3,1]", "0"],
    ]),
    pythonStub: "class Solution:\n    def maxProfit(self, prices: List[int]) -> int:\n        ",
  },
  puzzle: {
    brute: {
      plan: "Try every buy day with every later sell day, and keep the best profit.",
      complexity: "O(n²) time, O(1) space",
      ...stockBrute,
      requiredBlockIds: [],
    },
    optimized: {
      plan: "Walk the days once. Keep the cheapest price so far, and check what selling today would earn.",
      complexity: "O(n) time, O(1) space",
      ...stockOptimized,
    },
    distractors: stockDistractors.blocks,
    extraTests: tests([
      ["prices = [1]", "0"],
      ["prices = [2,4,1]", "2"],
      ["prices = [3,2,6,5,0,3]", "4"],
    ]),
  },
};

export const BUNDLED: Readonly<Record<string, BundledProblem>> = {
  [twoSum.problem.slug]: twoSum,
  [validParentheses.problem.slug]: validParentheses,
  [bestTimeToBuyAndSellStock.problem.slug]: bestTimeToBuyAndSellStock,
};

export const BUNDLED_MODEL = "bundled";
