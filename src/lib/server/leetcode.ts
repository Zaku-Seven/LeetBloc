// Reads public problem text through LeetCode's GraphQL endpoint, the one the
// problem page uses. It is unofficial: read only, no LeetCode session, and
// results are cached in `problems`.

import { convert } from "html-to-text";
import { parseLiteral } from "../blocks/literals";
import { parseStub } from "../blocks/python";
import type { Example, Problem } from "../puzzles/types";
import type { NewProblem } from "./store";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Accepts leetcode.com/problems/{slug}, with or without www, a trailing
// path like /description/, or a query string. Returns null for anything else.
export function parseProblemUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "leetcode.com" && url.hostname !== "www.leetcode.com") return null;
  const m = /^\/problems\/([^/]+)(?:\/.*)?$/.exec(url.pathname);
  const slug = m?.[1]?.toLowerCase();
  return slug && slug.length <= 100 && SLUG.test(slug) ? slug : null;
}

export interface LeetCodeClient {
  // Null when LeetCode has no such problem. Throws when LeetCode is unreachable.
  fetchProblem(slug: string): Promise<NewProblem | null>;
}

const QUERY = `query problem($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title content difficulty isPaidOnly exampleTestcases
    topicTags { name }
    codeSnippets { langSlug code }
  }
}`;

interface Question {
  title: string;
  content: string | null;
  difficulty: string;
  isPaidOnly: boolean;
  exampleTestcases: string | null;
  topicTags: { name: string }[] | null;
  codeSnippets: { langSlug: string; code: string }[] | null;
}

export function leetCodeClient(fetchImpl: typeof fetch = fetch): LeetCodeClient {
  return {
    async fetchProblem(slug) {
      const res = await fetchImpl("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "content-type": "application/json", referer: `https://leetcode.com/problems/${slug}/` },
        body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`LeetCode returned ${res.status}`);
      const body = (await res.json()) as { data?: { question: Question | null } };
      const q = body.data?.question;
      return q ? toProblem(slug, q) : null;
    },
  };
}

export function toProblem(slug: string, q: Question): NewProblem {
  const difficulty = (["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium") as Problem["difficulty"];
  const base = { source: "leetcode" as const, slug, title: q.title, difficulty, tags: (q.topicTags ?? []).map((t) => t.name) };
  // Paid problems are stored only so they are not fetched again.
  if (q.isPaidOnly || !q.content) return { ...base, isPaid: true, contentText: "", examples: [], pythonStub: "" };

  const contentText = htmlToText(q.content);
  const pythonStub = q.codeSnippets?.find((s) => s.langSlug === "python3")?.code ?? "";
  return { ...base, isPaid: false, contentText, pythonStub, examples: readExamples(contentText, q.exampleTestcases ?? "", pythonStub) };
}

export function htmlToText(html: string): string {
  // Keep exponents readable: 10<sup>4</sup> → 10^4.
  const withPowers = html.replace(/<sup>(.*?)<\/sup>/g, "^$1");
  return convert(withPowers, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  }).trim();
}

// Pairs `exampleTestcases` (one argument per line) with the "Output:" lines
// in the statement. If the counts do not line up, no examples are kept,
// rather than risk pairing an input with the wrong output.
export function readExamples(contentText: string, exampleTestcases: string, pythonStub: string): Example[] {
  let params: string[];
  try {
    params = parseStub(pythonStub).params;
  } catch {
    return [];
  }
  const lines = exampleTestcases.split("\n").filter((l) => l.trim() !== "");
  const outputs = [...contentText.matchAll(/Output:?\s*\n?\s*([^\n]+)/g)].map((m) => m[1]!.trim());
  if (params.length === 0 || lines.length % params.length !== 0 || lines.length / params.length !== outputs.length) return [];

  const examples: Example[] = [];
  for (let i = 0; i < outputs.length; i++) {
    const args = lines.slice(i * params.length, (i + 1) * params.length);
    try {
      args.forEach((a) => parseLiteral(a));
      parseLiteral(outputs[i]!);
    } catch {
      return [];
    }
    examples.push({ input: params.map((p, j) => `${p} = ${args[j]!.trim()}`).join(", "), output: outputs[i]! });
  }
  return examples;
}
