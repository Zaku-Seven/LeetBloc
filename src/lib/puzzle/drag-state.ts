import type { TrayItem } from "./types";

/**
 * Global drag state using window — guarantees a single shared instance
 * even when Turbopack splits modules across chunks.
 */

declare global {
  interface Window {
    __leetbloc_dragged?: TrayItem | null;
  }
}

export function setDraggedItem(item: TrayItem | null) {
  if (typeof window !== "undefined") {
    window.__leetbloc_dragged = item;
  }
}

export function getDraggedItem(): TrayItem | null {
  if (typeof window !== "undefined") {
    return window.__leetbloc_dragged ?? null;
  }
  return null;
}
