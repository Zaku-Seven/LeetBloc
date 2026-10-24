import { describe, expect, it } from "vitest";
import { ARM, BODY_H, CHILD_GAP, HAT_H, layoutScript, scriptSpan } from "./layout";
import { TWO_SUM_PIECES, type TrayPiece } from "./pieces";
import {
  clampSocket,
  gradeScript,
  insertPiece,
  listSockets,
  pythonPeek,
  socketAfterInsert,
  takePiece,
  type ScriptBlock,
  type Socket,
} from "./script";
import { buildCShape, buildStackShape, signedArea } from "./shapes";

function piece(id: string): TrayPiece {
  const found = TWO_SUM_PIECES.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function snap(ids: string[]): ScriptBlock[] {
  let script: ScriptBlock[] = [];
  let socket: Socket = { parentId: null, index: 0 };
  for (const id of ids) {
    const nextPiece = piece(id);
    script = insertPiece(script, socket, nextPiece);
    socket = clampSocket(script, socketAfterInsert(script, nextPiece, socket));
  }
  return script;
}

describe("scratch script", () => {
  it("clicks the fast Two Sum together and prints the nest", () => {
    const script = snap(["memory", "walk", "test", "answer", "remember"]);
    expect(gradeScript(script).ok).toBe(true);
    expect(pythonPeek(script)).toBe(
      [
        "def twoSum(nums, target):",
        "    seen = {}",
        "    for i in range(len(nums)):",
        "        if target - nums[i] in seen:",
        "            return [seen[target - nums[i]], i]",
        "        seen[nums[i]] = i",
      ].join("\n"),
    );
  });

  it("does not offer a connector under a cap", () => {
    const script = snap(["answer"]);
    expect(listSockets(script)).toEqual([{ parentId: null, index: 0 }]);
  });

  it("sends the next piece inside a C block, then back out after a cap", () => {
    let script: ScriptBlock[] = [];
    let socket: Socket = { parentId: null, index: 0 };
    script = insertPiece(script, socket, piece("walk"));
    socket = clampSocket(script, socketAfterInsert(script, piece("walk"), socket));
    expect(socket).toEqual({ parentId: "walk", index: 0 });
    script = insertPiece(script, socket, piece("answer"));
    socket = clampSocket(script, socketAfterInsert(script, piece("answer"), socket));
    expect(socket).toEqual({ parentId: null, index: 1 });
  });

  it("rejects the sort distractor and a flat stack", () => {
    expect(gradeScript(snap(["extra-sort"])).message).toMatch(/Sort isn't/);
    const flat = ["memory", "walk", "test", "remember", "answer"].reduce<ScriptBlock[]>((script, id, index) => {
      return insertPiece(script, { parentId: null, index }, piece(id));
    }, []);
    expect(gradeScript(flat).ok).toBe(false);
    expect(gradeScript(flat).message).toMatch(/inside/);
  });

  it("lifts a C block out with the pieces clicked inside it", () => {
    const script = snap(["walk", "test"]);
    const taken = takePiece(script, "walk");
    expect(taken.script).toEqual([]);
    expect(taken.node?.children.map((child) => child.piece.id)).toEqual(["test"]);
  });

  it("nests the next row inside the walk and one body-height below the hat", () => {
    const script = snap(["memory", "walk", "test"]);
    const span = scriptSpan(script);
    const layout = layoutScript(script, -span.width / 2, span.height / 2);
    const memory = layout.blocks.find((block) => block.id === "memory");
    const walk = layout.blocks.find((block) => block.id === "walk");
    const test = layout.blocks.find((block) => block.id === "test");
    expect(memory?.y).toBeCloseTo(span.height / 2 - HAT_H);
    expect(walk && memory ? memory.y - walk.y : 0).toBeCloseTo(BODY_H);
    expect(test && walk ? test.x - walk.x : 0).toBeCloseTo(ARM + CHILD_GAP);
    const structural = layout.sockets.map(({ parentId, index }) => ({ parentId, index }));
    expect(structural).toEqual(listSockets(script));
  });
});

describe("scratch outlines", () => {
  it("winds the stack and the C block so the front face points outward", () => {
    const stack = buildStackShape({
      width: 2.4,
      height: BODY_H,
      topNotch: true,
      bottomBump: true,
      topRadius: 0.1,
      bottomRadius: 0.1,
    });
    const mouth = buildCShape(3, 0.8, true);
    expect(signedArea(stack)).toBeGreaterThan(0);
    expect(signedArea(mouth)).toBeGreaterThan(0);
  });
});
