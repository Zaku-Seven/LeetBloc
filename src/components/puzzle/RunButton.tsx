"use client";

import type { CheckResult } from "@/lib/puzzle/types";

interface RunButtonProps {
  checkResult: CheckResult;
  onCheck: () => void;
  onReset: () => void;
}

export function RunButton({ checkResult, onCheck, onReset }: RunButtonProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onCheck}
        className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
      >
        Run
      </button>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-zinc-200 text-zinc-700 font-medium rounded-lg hover:bg-zinc-300 transition-colors"
      >
        Reset
      </button>

      {checkResult.status === "pass" && (
        <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium border border-green-200">
          Correct! Your solution matches the optimized approach.
        </div>
      )}

      {checkResult.status === "fail" && (
        <div className="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium border border-red-200 max-w-md">
          {checkResult.message}
        </div>
      )}
    </div>
  );
}
