"use client";

interface ProblemInfoProps {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  plan: string;
  complexity: string;
}

const DIFFICULTY_COLORS = {
  Easy: "text-green-600 bg-green-100",
  Medium: "text-amber-600 bg-amber-100",
  Hard: "text-red-600 bg-red-100",
} as const;

export function ProblemInfo({
  title,
  difficulty,
  plan,
  complexity,
}: ProblemInfoProps) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${DIFFICULTY_COLORS[difficulty]}`}
        >
          {difficulty}
        </span>
        <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
          {complexity}
        </span>
      </div>
      <p className="text-sm text-zinc-600">{plan}</p>
    </div>
  );
}
