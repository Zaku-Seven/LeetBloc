import { ExtrudeGeometry, Shape } from "three";
import {
  ARM,
  BODY_H,
  CHILD_GAP,
  BOTTOM_BAR,
  DEPTH,
  FEMALE_H,
  FEMALE_LIP,
  HAT_H,
  HAT_TOP_R,
  HAT_W,
  MALE_H,
  MALE_LIP,
  NOTCH_INSET,
  NOTCH_W,
  RADIUS,
  TOP_BAR,
  type LayoutBlock,
} from "./layout";

const extrude = { depth: DEPTH, bevelEnabled: false, curveSegments: 10, steps: 1 };
const cache = new Map<string, ExtrudeGeometry>();

function maleBump(shape: Shape, y: number, x0: number) {
  const x1 = x0 + NOTCH_W;
  const tip = y - MALE_H;
  const shoulder = y - MALE_H * 0.42;
  shape.lineTo(x0, y);
  shape.quadraticCurveTo(x0, shoulder, x0 - MALE_LIP, tip);
  shape.lineTo(x1 + MALE_LIP, tip);
  shape.quadraticCurveTo(x1, shoulder, x1, y);
}

// Drawn while traveling toward -x. The cavity is wider at its deep end, so the bump locks in.
function femaleNotch(shape: Shape, y: number, x0: number) {
  const x1 = x0 + NOTCH_W;
  const tip = y - FEMALE_H;
  const shoulder = y - FEMALE_H * 0.42;
  shape.lineTo(x1, y);
  shape.quadraticCurveTo(x1, shoulder, x1 + FEMALE_LIP, tip);
  shape.lineTo(x0 - FEMALE_LIP, tip);
  shape.quadraticCurveTo(x0, shoulder, x0, y);
}

export function buildStackShape(opts: {
  width: number;
  height: number;
  topNotch: boolean;
  bottomBump: boolean;
  topRadius: number;
  bottomRadius: number;
}): Shape {
  const { width: w, height: h, topNotch, bottomBump, topRadius: tr, bottomRadius: br } = opts;
  const shape = new Shape();
  shape.moveTo(0, -tr);
  shape.lineTo(0, -(h - br));
  shape.quadraticCurveTo(0, -h, br, -h);
  if (bottomBump) maleBump(shape, -h, NOTCH_INSET);
  shape.lineTo(w - br, -h);
  shape.quadraticCurveTo(w, -h, w, -(h - br));
  shape.lineTo(w, -tr);
  shape.quadraticCurveTo(w, 0, w - tr, 0);
  if (topNotch) femaleNotch(shape, 0, NOTCH_INSET);
  shape.lineTo(tr, 0);
  shape.quadraticCurveTo(0, 0, 0, -tr);
  return shape;
}

// Outer left, bottom bump, up the right side of the bottom bar, back across the
// mouth floor, up the arm, out across the underside (inner bump), up the right
// side of the top bar, and back across the top notch.
export function buildCShape(width: number, inner: number, floorNotch: boolean): Shape {
  const w = width;
  const height = TOP_BAR + inner + BOTTOM_BAR;
  const ceil = -TOP_BAR;
  const floor = -(TOP_BAR + inner);
  const innerNotch = ARM + CHILD_GAP + NOTCH_INSET;
  const r = RADIUS;
  const shape = new Shape();
  shape.moveTo(0, -r);
  shape.lineTo(0, -(height - r));
  shape.quadraticCurveTo(0, -height, r, -height);
  maleBump(shape, -height, NOTCH_INSET);
  shape.lineTo(w - r, -height);
  shape.quadraticCurveTo(w, -height, w, -(height - r));
  shape.lineTo(w, floor - r);
  shape.quadraticCurveTo(w, floor, w - r, floor);
  if (floorNotch) femaleNotch(shape, floor, innerNotch);
  shape.lineTo(ARM + r, floor);
  shape.quadraticCurveTo(ARM, floor, ARM, floor + r);
  shape.lineTo(ARM, ceil - r);
  shape.quadraticCurveTo(ARM, ceil, ARM + r, ceil);
  maleBump(shape, ceil, innerNotch);
  shape.lineTo(w - r, ceil);
  shape.quadraticCurveTo(w, ceil, w, ceil + r);
  shape.lineTo(w, -r);
  shape.quadraticCurveTo(w, 0, w - r, 0);
  femaleNotch(shape, 0, NOTCH_INSET);
  shape.lineTo(r, 0);
  shape.quadraticCurveTo(0, 0, 0, -r);
  return shape;
}

export function buildMarkerShape(): Shape {
  const shape = new Shape();
  const x1 = NOTCH_W;
  const shoulder = -MALE_H * 0.42;
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0, shoulder, -MALE_LIP, -MALE_H);
  shape.lineTo(x1 + MALE_LIP, -MALE_H);
  shape.quadraticCurveTo(x1, shoulder, x1, 0);
  shape.closePath();
  return shape;
}

export function buildPillShape(rx: number, ry: number): Shape {
  const shape = new Shape();
  shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  return shape;
}

function cached(key: string, shape: Shape, depth = DEPTH): ExtrudeGeometry {
  const hit = cache.get(key);
  if (hit) return hit;
  const geometry = new ExtrudeGeometry(shape, depth === DEPTH ? extrude : { ...extrude, depth, curveSegments: 16 });
  cache.set(key, geometry);
  return geometry;
}

export function blockGeometry(block: Pick<LayoutBlock, "piece" | "width" | "inner" | "floorNotch">): ExtrudeGeometry {
  if (block.piece.shape === "c") {
    return cached(
      `c2:${block.width}:${block.inner}:${block.floorNotch}`,
      buildCShape(block.width, block.inner, block.floorNotch),
    );
  }
  const cap = block.piece.shape === "cap";
  return cached(
    `s2:${block.piece.shape}:${block.width}`,
    buildStackShape({
      width: block.width,
      height: BODY_H,
      topNotch: true,
      bottomBump: !cap,
      topRadius: RADIUS,
      bottomRadius: RADIUS,
    }),
  );
}

export function hatGeometry(): ExtrudeGeometry {
  return cached(
    "hat-v2",
    buildStackShape({
      width: HAT_W,
      height: HAT_H,
      topNotch: false,
      bottomBump: true,
      topRadius: HAT_TOP_R,
      bottomRadius: RADIUS,
    }),
  );
}

export function markerGeometry(): ExtrudeGeometry {
  return cached("marker", buildMarkerShape(), 0.16);
}

export function pillGeometry(rx: number, ry: number): ExtrudeGeometry {
  return cached(`pill:${rx}:${ry}`, buildPillShape(rx, ry), 0.08);
}

export function signedArea(shape: Shape): number {
  const points = shape.getPoints(8);
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
