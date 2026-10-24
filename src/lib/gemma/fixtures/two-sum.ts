import type { ProblemInput } from "../types";

export const TWO_SUM: ProblemInput = {
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  pythonStub:
    "def twoSum(self, nums: List[int], target: int) -> List[int]:",
  contentText:
    "Given an array of integers nums and an integer target, return indices " +
    "of the two numbers such that they add up to target. You may assume " +
    "that each input would have exactly one solution, and you may not use " +
    "the same element twice. You can return the answer in any order.",
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
    { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    { input: "nums = [3,3], target = 6", output: "[0,1]" },
  ],
};
