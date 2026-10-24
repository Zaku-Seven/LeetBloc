"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { TrayBlock } from "@/components/board/TrayBlock";
import { TWO_SUM_PIECES, type TrayPiece } from "@/components/board/pieces";
import type { ScriptBlock, Socket } from "@/components/board/layout";
import {
  clampSocket,
  flatten,
  gradeScript,
  insertNode,
  insertPiece,
  locate,
  piecesIn,
  pythonPeek,
  socketAfterInsert,
  socketBlurb,
  takePiece,
} from "@/components/board/script";
import { STARTERS } from "./starters";

const BoardCanvas = dynamic(
  () => import("@/components/board/BoardCanvas").then((mod) => mod.BoardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm">Setting up the board…</div>
    ),
  },
);

const ROOT: Socket = { parentId: null, index: 0 };

export function PuzzleShell() {
  const [index, setIndex] = useState(0);
  const [tray, setTray] = useState<TrayPiece[]>(TWO_SUM_PIECES);
  const [placed, setPlaced] = useState<ScriptBlock[]>([]);
  const [socket, setSocket] = useState<Socket>(ROOT);
  const [history, setHistory] = useState<{ id: string; socket: Socket }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [signInNote, setSignInNote] = useState(false);

  const starter = STARTERS[index];
  const selected = flatten(placed).find((piece) => piece.id === selectedId) ?? null;
  const python = useMemo(() => pythonPeek(placed), [placed]);

  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    setTray(TWO_SUM_PIECES);
    setPlaced([]);
    setSocket(ROOT);
    setHistory([]);
    setSelectedId(null);
    setPeek(false);
    setResult(null);
  }

  function place(piece: TrayPiece) {
    const next = insertPiece(placed, socket, piece);
    setPlaced(next);
    setSocket(clampSocket(next, socketAfterInsert(next, piece, socket)));
    setTray(tray.filter((item) => item.id !== piece.id));
    setHistory([...history, { id: piece.id, socket }]);
    setSelectedId(piece.id);
    setResult(null);
  }

  function undo() {
    const step = history[history.length - 1];
    if (!step) return;
    const { script, node } = takePiece(placed, step.id);
    if (!node) return;
    const back = piecesIn(node);
    const ids = new Set(back.map((piece) => piece.id));
    setPlaced(script);
    setTray([...tray, ...back]);
    setHistory(history.filter((item) => !ids.has(item.id)));
    setSocket(clampSocket(script, step.socket));
    setSelectedId(null);
    setResult(null);
  }

  function move(id: string, nextSocket: Socket) {
    const { script, node } = takePiece(placed, id);
    if (!node) return;
    const safe = clampSocket(script, nextSocket);
    const next = insertNode(script, safe, node);
    setPlaced(next);
    setSocket(clampSocket(next, safe));
    setSelectedId(id);
    setResult(null);
  }

  return (
    <div className="flex h-screen min-w-[1080px] flex-col bg-[#F0E0D0] text-[#104070]">
      <header className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <button
            type="button"
            aria-label="Previous puzzle"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/70 shadow-[3px_3px_0_#104070] disabled:opacity-40"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            ‹
          </button>
          <span>LeetBloc</span>
          <button
            type="button"
            aria-label="Next puzzle"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/70 shadow-[3px_3px_0_#104070] disabled:opacity-40"
            disabled={index === STARTERS.length - 1}
            onClick={() => goTo(index + 1)}
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className="rounded-full bg-[#1060A0] px-4 py-2 text-sm font-semibold text-[#F0E0D0]"
          onClick={() => setSignInNote(true)}
        >
          Sign in
        </button>
      </header>

      <p className="hidden px-5 pb-1 text-sm max-[1080px]:block">This board wants a wider screen.</p>
      {signInNote ? (
        <p className="px-5 pb-1 text-sm">Google sign-in saves your puzzles. That is not wired yet.</p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-3 px-3 pb-3">
        <aside className="overflow-auto rounded-3xl bg-[#F7F1E6] p-5 shadow-[4px_4px_0_#104070]">
          <p className="text-xs font-semibold uppercase tracking-wide">Easy</p>
          <h1 className="mt-1 text-2xl font-semibold">{starter.title}</h1>
          <p className="mt-4 text-lg leading-snug">{starter.sentence}</p>
          <p className="mt-3 rounded-2xl bg-[#F0E0D0] p-3 text-sm leading-relaxed">{starter.example}</p>
          <p className="mt-4 text-sm leading-relaxed opacity-80">{starter.prompt}</p>
          {selected ? (
            <p className="mt-4 text-sm">
              <span className="font-semibold">{selected.label}. </span>
              {selected.hint}
            </p>
          ) : null}
        </aside>

        <section className="relative min-h-0 overflow-hidden rounded-3xl shadow-[4px_4px_0_#104070]">
          {starter.playable ? (
            <div className="absolute inset-0">
              <BoardCanvas
                script={placed}
                selectedId={selectedId}
                socket={socket}
                onSelect={setSelectedId}
                onAim={(id) => {
                  setSelectedId(id);
                  const found = locate(placed, id);
                  if (!found) return;
                  setSocket(clampSocket(placed, { parentId: id, index: found.node.children.length }));
                }}
                onSocket={setSocket}
                onMove={move}
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center bg-[#F7F1E6] p-8 text-center text-lg">
              Pieces for this one come next. Two Sum is ready on the left chevron.
            </div>
          )}
          {starter.playable ? (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3">
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-white/80 px-3 py-1 text-sm font-semibold"
                onClick={() => setPeek((open) => !open)}
              >
                {peek ? "Hide Python" : "See this in Python"}
              </button>
              {peek ? (
                <pre className="pointer-events-auto mt-2 max-h-28 overflow-auto rounded-2xl bg-[#104070] p-3 text-xs text-[#F0E0D0]">
                  {python}
                </pre>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="grid h-48 shrink-0 grid-cols-[minmax(0,1fr)_320px] gap-3 px-3 pb-3">
        <div className="flex items-center gap-3 overflow-x-auto rounded-3xl bg-[#F7F1E6] px-4 shadow-[4px_4px_0_#104070]">
          {starter.playable ? (
            tray.map((piece) => <TrayBlock key={piece.id} piece={piece} onClick={() => place(piece)} />)
          ) : (
            <p className="text-sm">The tray fills in when this puzzle is built.</p>
          )}
        </div>
        <div className="flex flex-col justify-between rounded-3xl bg-[#F7F1E6] p-4 shadow-[4px_4px_0_#104070]">
          <p className="text-sm leading-snug">{result?.message ?? socketBlurb(placed, socket)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-40"
              disabled={!starter.playable || history.length === 0}
              onClick={undo}
            >
              Undo
            </button>
            <button
              type="button"
              className="rounded-full bg-[#309060] px-4 py-2 text-sm font-semibold text-[#F0E0D0] disabled:opacity-40"
              disabled={!starter.playable}
              onClick={() => setResult(gradeScript(placed))}
            >
              Check
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
