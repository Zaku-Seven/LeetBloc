// Connects the Gemma layer (src/lib/gemma) to the puzzles route. generatePuzzle
// already runs verifyPuzzle on the response, so this only adapts the shapes.

import type { CallGemmaOptions } from "../gemma/client";
import { generatePuzzle } from "../gemma/generate";
import type { Problem } from "../puzzles/types";
import type { Generator } from "./service";

export class GenerationFailed extends Error {
  constructor(
    readonly model: string,
    readonly errors: string[],
  ) {
    super(`Gemma (${model}) did not produce a valid puzzle: ${errors.slice(0, 5).join("; ")}`);
  }
}

export function gemmaGenerator(call?: (opts: CallGemmaOptions) => Promise<string>): Generator {
  return async (problem: Problem) => {
    const result = await generatePuzzle(
      {
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        pythonStub: problem.pythonStub,
        contentText: problem.contentText,
        examples: problem.examples,
      },
      call,
    );
    if (result.status !== "ready" || !result.response) throw new GenerationFailed(result.model, result.errors);
    return { model: result.model, candidate: result.response };
  };
}
