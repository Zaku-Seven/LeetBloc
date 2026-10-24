import type { TrayPiece } from "./pieces";

const INSET = 16;
const NOTCH = 26;
const LIP = 4;
const FEMALE = 8;
const MALE = 7;
const RADIUS = 8;
const BODY = 42;
const ARM = 18;
const TOP = 40;
const MOUTH = 18;
const BOTTOM = 20;

function stackPath(width: number, cap: boolean): string {
  const h = BODY;
  const r = RADIUS;
  const x0 = INSET;
  const x1 = INSET + NOTCH;
  return [
    `M ${r} 0`,
    `H ${x0}`,
    `L ${x0 - LIP} ${FEMALE}`,
    `L ${x1 + LIP} ${FEMALE}`,
    `L ${x1} 0`,
    `H ${width - r}`,
    `Q ${width} 0 ${width} ${r}`,
    `V ${h - r}`,
    `Q ${width} ${h} ${width - r} ${h}`,
    ...(cap
      ? [`H ${r}`, `Q 0 ${h} 0 ${h - r}`, `V ${r}`, `Q 0 0 ${r} 0`, "Z"]
      : [
          `H ${x1}`,
          `L ${x1 + LIP} ${h + MALE}`,
          `L ${x0 - LIP} ${h + MALE}`,
          `L ${x0} ${h}`,
          `H ${r}`,
          `Q 0 ${h} 0 ${h - r}`,
          `V ${r}`,
          `Q 0 0 ${r} 0`,
          "Z",
        ]),
  ].join(" ");
}

function cPath(width: number): string {
  const r = RADIUS;
  const floor = TOP + MOUTH;
  const bottom = floor + BOTTOM;
  const x0 = INSET;
  const x1 = INSET + NOTCH;
  const ix0 = ARM + INSET;
  const ix1 = ix0 + NOTCH;
  return [
    `M ${r} 0`,
    `H ${x0}`,
    `L ${x0 - LIP} ${FEMALE}`,
    `L ${x1 + LIP} ${FEMALE}`,
    `L ${x1} 0`,
    `H ${width - r}`,
    `Q ${width} 0 ${width} ${r}`,
    `V ${TOP - r}`,
    `Q ${width} ${TOP} ${width - r} ${TOP}`,
    `H ${ix1}`,
    `L ${ix1 + LIP} ${TOP + MALE}`,
    `L ${ix0 - LIP} ${TOP + MALE}`,
    `L ${ix0} ${TOP}`,
    `H ${ARM + r}`,
    `Q ${ARM} ${TOP} ${ARM} ${TOP + r}`,
    `V ${floor - r}`,
    `Q ${ARM} ${floor} ${ARM + r} ${floor}`,
    `H ${ix0}`,
    `L ${ix0 - LIP} ${floor + FEMALE}`,
    `L ${ix1 + LIP} ${floor + FEMALE}`,
    `L ${ix1} ${floor}`,
    `H ${width - r}`,
    `Q ${width} ${floor} ${width} ${floor + r}`,
    `V ${bottom - r}`,
    `Q ${width} ${bottom} ${width - r} ${bottom}`,
    `H ${x1}`,
    `L ${x1 + LIP} ${bottom + MALE}`,
    `L ${x0 - LIP} ${bottom + MALE}`,
    `L ${x0} ${bottom}`,
    `H ${r}`,
    `Q 0 ${bottom} 0 ${bottom - r}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function widthFor(label: string): number {
  return Math.max(132, INSET + NOTCH + label.length * 8.2 + 22);
}

export function TrayBlock({ piece, onClick }: { piece: TrayPiece; onClick: () => void }) {
  const width = widthFor(piece.label);
  const cap = piece.shape === "cap";
  const cBlock = piece.shape === "c";
  const height = cBlock ? TOP + MOUTH + BOTTOM + MALE : BODY + (cap ? 0 : MALE);
  const textY = cBlock ? TOP / 2 + 1 : BODY / 2 + 1;
  return (
    <button
      type="button"
      title={piece.hint}
      aria-label={piece.label}
      onClick={onClick}
      className="shrink-0 bg-transparent p-0 leading-none active:translate-y-px"
      style={{ filter: "drop-shadow(3px 3px 0 #104070)" }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
        <path d={cBlock ? cPath(width) : stackPath(width, cap)} fill={piece.color} />
        <text
          x={INSET + NOTCH + 8}
          y={textY}
          fill={piece.ink}
          fontSize="15"
          fontWeight="600"
          fontFamily="inherit"
          dominantBaseline="middle"
        >
          {piece.label}
        </text>
      </svg>
    </button>
  );
}
