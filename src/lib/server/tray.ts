// Turns a stored puzzle into what the browser may see: a shuffled tray with
// opaque ids, no children, no distractor flags, and no canonical order.
// Tray ids are an HMAC of the canonical id, so they are stable across
// refreshes (a saved workspace still matches) but reveal nothing about order.

import { createHmac, randomInt } from "node:crypto";
import type { BlockNode } from "../blocks/catalog";
import { trayOf } from "../blocks/workspace";
import type { Approach, PuzzleContent } from "../puzzles/types";

export interface Tray {
  // Shuffled, safe to send.
  blocks: BlockNode[];
  // Tray id → block, for rebuilding a submitted workspace.
  byId: Map<string, BlockNode>;
}

export function buildTray(secret: string, puzzleId: string, content: PuzzleContent, approach: Approach): Tray {
  const opaque = (canonicalId: string) =>
    `b${createHmac("sha256", secret).update(`${puzzleId}:${approach}:${canonicalId}`).digest("base64url").slice(0, 15)}`;

  const remap = (n: BlockNode): BlockNode => {
    const out: BlockNode = { id: opaque(n.id), type: n.type, label: n.label };
    if (n.hint) out.hint = n.hint;
    if (n.fields) out.fields = { ...n.fields };
    if (n.value) out.value = remap(n.value);
    if (n.values) out.values = n.values.map(remap);
    return out;
  };

  const blocks = [...trayOf(content[approach].blocks), ...trayOf(content.distractors)].map(remap);
  shuffle(blocks);
  return { blocks, byId: new Map(blocks.map((b) => [b.id, b])) };
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}
