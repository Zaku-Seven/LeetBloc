import { TWO_SUM_ORDER, type TrayPiece } from "./pieces";
import type { ScriptBlock, Socket } from "./layout";

export type { ScriptBlock, Socket };

type Expected = { id: string; children: Expected[] };

const SOLUTION: Expected[] = [
  { id: "memory", children: [] },
  {
    id: "walk",
    children: [
      { id: "test", children: [{ id: "answer", children: [] }] },
      { id: "remember", children: [] },
    ],
  },
];

export function insertPiece(script: ScriptBlock[], socket: Socket, piece: TrayPiece): ScriptBlock[] {
  return insertNode(script, socket, { piece, children: [] });
}

export function insertNode(script: ScriptBlock[], socket: Socket, node: ScriptBlock): ScriptBlock[] {
  if (socket.parentId === null) {
    const next = [...script];
    next.splice(socket.index, 0, node);
    return next;
  }
  return script.map((block) => {
    if (block.piece.id === socket.parentId) {
      if (block.piece.shape !== "c") return block;
      const children = [...block.children];
      children.splice(socket.index, 0, node);
      return { ...block, children };
    }
    return { ...block, children: insertNode(block.children, socket, node) };
  });
}

export function takePiece(script: ScriptBlock[], id: string): { script: ScriptBlock[]; node: ScriptBlock | null } {
  let found: ScriptBlock | null = null;
  function walk(list: ScriptBlock[]): ScriptBlock[] {
    const next: ScriptBlock[] = [];
    for (const block of list) {
      if (block.piece.id === id) {
        found = block;
        continue;
      }
      next.push({ ...block, children: walk(block.children) });
    }
    return next;
  }
  return { script: walk(script), node: found };
}

export function locate(script: ScriptBlock[], id: string): { node: ScriptBlock; parentId: string | null; index: number } | null {
  function walk(list: ScriptBlock[], parentId: string | null): { node: ScriptBlock; parentId: string | null; index: number } | null {
    for (let index = 0; index < list.length; index += 1) {
      const node = list[index];
      if (node.piece.id === id) return { node, parentId, index };
      const nested = walk(node.children, node.piece.id);
      if (nested) return nested;
    }
    return null;
  }
  return walk(script, null);
}

export function flatten(script: ScriptBlock[]): TrayPiece[] {
  const out: TrayPiece[] = [];
  function walk(list: ScriptBlock[]) {
    for (const block of list) {
      out.push(block.piece);
      walk(block.children);
    }
  }
  walk(script);
  return out;
}

export function piecesIn(node: ScriptBlock): TrayPiece[] {
  return [node.piece, ...flatten(node.children)];
}

export function listSockets(script: ScriptBlock[]): Socket[] {
  const out: Socket[] = [];
  collect(script, null, out);
  return out;
}

function collect(list: ScriptBlock[], parentId: string | null, out: Socket[]) {
  out.push({ parentId, index: 0 });
  for (let index = 0; index < list.length; index += 1) {
    const node = list[index];
    if (node.piece.shape === "c") collect(node.children, node.piece.id, out);
    if (node.piece.shape === "cap") break;
    out.push({ parentId, index: index + 1 });
  }
}

export function clampSocket(script: ScriptBlock[], socket: Socket): Socket {
  const sockets = listSockets(script);
  if (sockets.some((item) => item.parentId === socket.parentId && item.index === socket.index)) return socket;
  const sameParent = sockets.filter((item) => item.parentId === socket.parentId);
  if (sameParent.length > 0) return sameParent[sameParent.length - 1];
  return sockets[sockets.length - 1] ?? { parentId: null, index: 0 };
}

export function socketAfterInsert(script: ScriptBlock[], piece: TrayPiece, at: Socket): Socket {
  if (piece.shape === "c") return { parentId: piece.id, index: 0 };
  if (piece.shape !== "cap") return { parentId: at.parentId, index: at.index + 1 };
  if (!at.parentId) return at;
  const parent = locate(script, at.parentId);
  if (!parent) return { parentId: null, index: 0 };
  return { parentId: parent.parentId, index: parent.index + 1 };
}

export function socketBlurb(script: ScriptBlock[], socket: Socket): string {
  if (socket.parentId) {
    const parent = locate(script, socket.parentId);
    if (parent) return `Next piece clicks inside ${parent.node.piece.label}.`;
  }
  return "Next piece clicks onto the bump under twoSum.";
}

export function pythonPeek(script: ScriptBlock[]): string {
  const body = printList(script, "    ");
  return `def twoSum(nums, target):\n${body || "    pass"}`;
}

function printList(list: ScriptBlock[], indent: string): string {
  return list
    .map((node) => {
      const line = `${indent}${node.piece.python}`;
      if (node.piece.shape !== "c") return line;
      const inner = printList(node.children, `${indent}    `);
      return `${line}\n${inner || `${indent}    pass`}`;
    })
    .join("\n");
}

export function gradeScript(script: ScriptBlock[]): { ok: boolean; message: string } {
  const pieces = flatten(script);
  if (pieces.length === 0) {
    return { ok: false, message: "Snap a piece onto the bump, then check." };
  }
  if (pieces.some((piece) => piece.distractor)) {
    return { ok: false, message: "Sort isn't how this one goes. Send that piece back to the tray." };
  }
  if (sameTree(script, SOLUTION)) {
    return {
      ok: true,
      message:
        "That is the fast way. You save each number, then look for the one that finishes the pair. nums is 2 and 7, target is 9, and the answer is the indexes 0 and 1.",
    };
  }
  if (pieces.some((piece) => piece.id === "memory") && script[0]?.piece.id !== "memory") {
    return { ok: false, message: "Make the memory first. It clicks under twoSum." };
  }
  const walk = locate(script, "walk");
  const test = locate(script, "test");
  const answer = locate(script, "answer");
  const remember = locate(script, "remember");
  if (test && test.parentId !== "walk") {
    return { ok: false, message: "The test clicks inside the walk." };
  }
  if (answer && answer.parentId !== "test") {
    return { ok: false, message: "The answer clicks inside the test." };
  }
  if (remember && remember.parentId !== "walk") {
    return { ok: false, message: "Remember the number inside the walk, after the test." };
  }
  if (remember && test && remember.parentId === "walk" && test.parentId === "walk" && remember.index < test.index) {
    return { ok: false, message: "Test the pair before you remember the number." };
  }
  if (walk && walk.parentId !== null) {
    return { ok: false, message: "The walk clicks under the memory." };
  }
  const ids = pieces.map((piece) => piece.id).sort().join();
  if (ids === [...TWO_SUM_ORDER].sort().join()) {
    return {
      ok: false,
      message: "The pieces are the right ones. The answer clicks inside the test, and the test clicks inside the walk.",
    };
  }
  return { ok: false, message: `You snapped ${pieces.length} of 5 pieces. nums is 2 and 7, target is 9.` };
}

function sameTree(script: ScriptBlock[], expect: Expected[]): boolean {
  if (script.length !== expect.length) return false;
  return script.every((node, index) => {
    const want = expect[index];
    return node.piece.id === want.id && sameTree(node.children, want.children);
  });
}
