// A learner's workspace: which tray blocks they placed, in what order, and
// what is nested inside what. It carries ids only. The server rebuilds the
// program from its own copy of the tray, so a client cannot change what a
// block does, only where it sits.

import { z } from "zod";
import { BLOCK_ID_PATTERN, SPECS, type BlockNode } from "./catalog";

export interface PlacedBlock {
  id: string;
  children?: PlacedBlock[];
}

export interface Workspace {
  blocks: PlacedBlock[];
}

const placedSchema: z.ZodType<PlacedBlock> = z.lazy(() =>
  z.object({
    id: z.string().regex(BLOCK_ID_PATTERN),
    children: z.array(placedSchema).max(100).optional(),
  }),
);

export const WorkspaceSchema: z.ZodType<Workspace> = z.object({
  blocks: z.array(placedSchema).max(100),
});

export class WorkspaceError extends Error {}

// Builds the function body from tray blocks. A tray block is a statement
// with its values filled in and no children.
export function assemble(tray: ReadonlyMap<string, BlockNode>, workspace: Workspace): BlockNode[] {
  const used = new Set<string>();

  const build = (placed: PlacedBlock[], depth: number): BlockNode[] => {
    if (depth > 16) throw new WorkspaceError("Blocks are nested too deeply");
    return placed.map((p) => {
      const block = tray.get(p.id);
      if (!block) throw new WorkspaceError(`Block ${p.id} is not in this tray`);
      if (used.has(p.id)) throw new WorkspaceError(`Block ${p.id} is placed twice`);
      used.add(p.id);
      if (p.children && p.children.length > 0) {
        if (!SPECS[block.type].children) throw new WorkspaceError(`Nothing can be nested inside a ${block.type} block`);
        return { ...block, children: build(p.children, depth + 1) };
      }
      const rest = { ...block };
      delete rest.children;
      return SPECS[block.type].children ? { ...rest, children: [] } : rest;
    });
  };

  return build(workspace.blocks, 0);
}

// Every node reachable in a body, values included.
export function nodesIn(body: BlockNode[]): BlockNode[] {
  const out: BlockNode[] = [];
  const go = (n: BlockNode) => {
    out.push(n);
    if (n.value) go(n.value);
    n.values?.forEach(go);
    n.children?.forEach(go);
  };
  body.forEach(go);
  return out;
}

// Flattens a canonical solution into its tray: every statement, children removed.
export function trayOf(blocks: BlockNode[]): BlockNode[] {
  const out: BlockNode[] = [];
  const go = (n: BlockNode) => {
    const { children, ...rest } = n;
    out.push(rest);
    children?.forEach(go);
  };
  blocks.forEach(go);
  return out;
}
