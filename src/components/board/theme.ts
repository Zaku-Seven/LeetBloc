import {
  DataTexture,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

export const CREAM = "#F0E0D0";

export const PIECE_W = 2.6;
export const PIECE_H = 0.72;
export const PIECE_D = 0.42;
export const SLOT_GAP = 0.9;
export const STACK_TOP = 1.35;

let gradient: DataTexture | null = null;

/** Three hard bands so the pieces read as flat color with a shadow edge. */
export function toonGradient(): DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([
    80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255,
  ]);
  const texture = new DataTexture(data, 3, 1, RGBAFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  gradient = texture;
  return texture;
}

export function slotY(index: number): number {
  return STACK_TOP - index * SLOT_GAP;
}
