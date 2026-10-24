import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePuzzle } from "@/lib/gemma/generate";
import type { ProblemInput } from "@/lib/gemma/types";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const problemInputSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  pythonStub: z.string().min(1),
  contentText: z.string().min(1),
  examples: z
    .array(
      z.object({
        input: z.string().min(1),
        output: z.string().min(1),
      }),
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------

// Development only: it returns the canonical solutions and spends Gemma
// quota on any input. Learners get puzzles through POST /api/puzzles.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // Validate input
  const parsed = problemInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid problem input.",
        details: parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      },
      { status: 400 },
    );
  }

  const problem: ProblemInput = parsed.data;

  // Generate puzzle
  try {
    const result = await generatePuzzle(problem);

    if (result.status === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          errors: result.errors,
          ...(process.env.NODE_ENV === "development" && {
            _debug: result.debug,
          }),
        },
        { status: 502 },
      );
    }

    const response = result.response!;

    return NextResponse.json({
      status: "ready",
      model: result.model,
      brute: {
        plan: response.brute.plan,
        complexity: response.brute.complexity,
        blockCount: response.brute.blocks.length,
        requiredCount: response.brute.requiredBlockIds.length,
      },
      optimized: {
        plan: response.optimized.plan,
        complexity: response.optimized.complexity,
        blockCount: response.optimized.blocks.length,
        requiredCount: response.optimized.requiredBlockIds.length,
      },
      distractorCount: response.distractors.length,
      extraTestCount: response.extraTests.length,
      agreedTests: result.content?.tests ?? [],
      data: response,
      ...(process.env.NODE_ENV === "development" && {
        _debug: result.debug,
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
