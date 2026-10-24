import type { TrayPiece } from "./pieces";

// Scratch-style sizes in board units. The male bump is a little smaller than the
// female notch, so a piece sits in the notch with a visible seam instead of
// z-fighting on the shared faces.
export const BODY_H = 0.74;
export const TOP_BAR = 0.74;
export const BOTTOM_BAR = 0.5;
export const MIN_MOUTH = 0.58;
export const ARM = 0.46;
export const CHILD_GAP = 0.04;
export const RADIUS = 0.11;
export const HAT_H = 0.9;
export const HAT_W = 3.35;
export const HAT_TOP_R = 0.34;
export const DEPTH = 0.46;
export const NOTCH_W = 0.64;
export const NOTCH_INSET = 0.34;
export const FEMALE_H = 0.2;
export const FEMALE_LIP = 0.09;
export const MALE_H = 0.16;
export const MALE_LIP = 0.055;
export const MIN_W = 1.9;
export const MOUTH_PAD = 0.22;

export type ScriptBlock = {
  piece: TrayPiece;
  children: ScriptBlock[];
};

export type Socket = {
  parentId: string | null;
  index: number;
};

export type LayoutBlock = {
  id: string;
  piece: TrayPiece;
  x: number;
  y: number;
  width: number;
  inner: number;
  floorNotch: boolean;
};

export type LayoutSocket = Socket & {
  x: number;
  y: number;
};

export type Measured = {
  width: number;
  /** How far the next piece's top sits below this piece's top. The bump hangs past this. */
  advance: number;
  inner: number;
};

function snap(n: number): number {
  return Math.round(n * 100) / 100;
}

export function textWidth(label: string): number {
  return snap(NOTCH_INSET + NOTCH_W + 0.18 + label.length * 0.093 + 0.22);
}

export function measure(node: ScriptBlock): Measured {
  const own = Math.max(MIN_W, textWidth(node.piece.label));
  if (node.piece.shape !== "c") {
    return { width: own, advance: BODY_H, inner: 0 };
  }
  let childW = 0;
  let inner = 0;
  for (const child of node.children) {
    const size = measure(child);
    childW = Math.max(childW, size.width);
    inner += size.advance;
  }
  if (node.children.length === 0) inner = MIN_MOUTH;
  const width = snap(Math.max(own, ARM + CHILD_GAP + Math.max(childW, MIN_W) + MOUTH_PAD));
  return { width, advance: snap(TOP_BAR + inner + BOTTOM_BAR), inner: snap(inner) };
}

export function scriptSpan(script: ScriptBlock[]): { width: number; height: number } {
  let width = HAT_W;
  let height = HAT_H + MALE_H;
  for (const node of script) {
    const size = measure(node);
    width = Math.max(width, size.width);
    height += size.advance;
  }
  return { width: snap(width), height: snap(height) };
}

export function layoutScript(script: ScriptBlock[], left: number, top: number): {
  blocks: LayoutBlock[];
  sockets: LayoutSocket[];
} {
  const blocks: LayoutBlock[] = [];
  const sockets: LayoutSocket[] = [];
  layoutList(script, null, left, top - HAT_H, blocks, sockets);
  return { blocks, sockets };
}

function layoutList(
  nodes: ScriptBlock[],
  parentId: string | null,
  x: number,
  y: number,
  blocks: LayoutBlock[],
  sockets: LayoutSocket[],
) {
  let cursor = y;
  sockets.push({ parentId, index: 0, x, y: cursor });
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const size = measure(node);
    const last = node.children[node.children.length - 1];
    blocks.push({
      id: node.piece.id,
      piece: node.piece,
      x,
      y: cursor,
      width: size.width,
      inner: size.inner,
      floorNotch: node.piece.shape === "c" && (!last || last.piece.shape !== "cap"),
    });
    if (node.piece.shape === "c") {
      layoutList(node.children, node.piece.id, x + ARM + CHILD_GAP, cursor - TOP_BAR, blocks, sockets);
    }
    if (node.piece.shape === "cap") break;
    cursor -= size.advance;
    sockets.push({ parentId, index: index + 1, x, y: cursor });
  }
}

export function nearestSocket(sockets: LayoutSocket[], x: number, y: number): LayoutSocket | null {
  let best: LayoutSocket | null = null;
  let bestD = Infinity;
  for (const socket of sockets) {
    const dx = socket.x - x;
    const dy = socket.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      best = socket;
      bestD = d;
    }
  }
  return best;
}
