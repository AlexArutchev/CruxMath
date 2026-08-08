"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { latexInHtml } from "@/lib/latex";
import type { Rung } from "@/lib/types";

/** Anything past this and the gesture was a swipe, not a tap that drifted. */
const SWIPE_PX = 30;

function toRoman(n: number): string {
  const vals: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of vals) while (n >= v) { out += s; n -= v; }
  return out;
}

function teaseFor(i: number, total: number): string {
  if (i === 0) return "WHERE TO START";
  if (i === total - 1) return "THE FINISH";
  return "THE NEXT STEP";
}

/** "III · IV" for the rungs from `from` to `to`, or "" when the range is empty. */
function romanRange(from: number, to: number): string {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(toRoman(i));
  return out.join(" · ");
}

/**
 * On mobile the panel docks to the bottom of the viewport as a sheet. The column
 * behind it has to reserve exactly that much room, or the last thing a student
 * reads sits underneath it, so the closed height is published as a custom
 * property and `.col` pads by it. Only the CLOSED height is ever written: an open
 * sheet is most of the screen, and padding the column by that would leave a
 * screenful of blank paper once it closed again.
 */
function useSheetHeight(el: HTMLElement | null, open: boolean) {
  useEffect(() => {
    if (!el || open) return;
    const publish = () => {
      document.documentElement.style.setProperty(
        "--crux-sheet-h",
        Math.round(el.getBoundingClientRect().height) + "px"
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, open]);
}

export default function HintLadder({
  rungs,
  revealed,
  pending,
  solved,
  onAsk,
  onConfirm,
  onCancel,
  children,
}: {
  rungs: (Rung | null)[];
  revealed: number;
  pending: number;
  solved: boolean;
  onAsk: (idx: number) => void;
  onConfirm: (idx: number) => void;
  onCancel: () => void;
  /** The answer row, pinned to the bottom of the sheet on mobile. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [aside, setAside] = useState<HTMLElement | null>(null);
  const touchY = useRef<number | null>(null);

  useSheetHeight(aside, open);

  const M = rungs.length;

  // Solving is done, so the sheet stops competing with the review layer for the
  // screen. Collapsing it is what turns it into the status bar the handoff wants.
  useEffect(() => {
    if (solved) setOpen(false);
  }, [solved]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchY.current;
    touchY.current = null;
    const end = e.changedTouches[0]?.clientY;
    if (start == null || end == null) return;
    const dy = end - start;
    if (dy < -SWIPE_PX) setOpen(true);
    else if (dy > SWIPE_PX) setOpen(false);
  }, []);

  /** Grab handle plus the tappable title row. Mobile only; CSS hides it above the breakpoint. */
  function sheetHead(right: React.ReactNode) {
    return (
      <>
        <span className="sheet-grab" aria-hidden="true" />
        <button
          className="sheet-head mono"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <span className="sheet-title">HINT LADDER</span>
          <span className="sheet-meta">{right}</span>
        </button>
      </>
    );
  }

  if (!M) {
    return (
      <aside ref={setAside} data-sheet={open ? "open" : "closed"}>
        {sheetHead("NOT YET AUTHORED")}
        <div className="ltop">
          <span className="ltitle">HINT LADDER</span>
          <span className="lcount">NOT YET AUTHORED</span>
        </div>
        <p className="lintro">Each rung says why you&rsquo;d think of the move, not just the move.</p>
        <div className="lbody">
          <div className="placeholder">
            A hint ladder has not been authored for this problem yet. The answer check
            still works for every problem.
          </div>
        </div>
        {children}
      </aside>
    );
  }

  // What the closed sheet shows: the rung being confirmed if there is one, else
  // the last one revealed, else the first, which is the one carrying the REVEAL
  // link. Without this a fresh problem would collapse to a header and nothing.
  const current = pending > 0 ? pending : revealed > 0 ? revealed : 1;
  const spent = romanRange(1, revealed);
  const rest = romanRange(revealed + 1, M);
  // Counted from `current`, not from `revealed`: the closed sheet is already
  // showing the current rung, so starting at revealed + 1 would list it twice.
  const hidden = romanRange(current + 1, M);

  return (
    <aside ref={setAside} data-sheet={open ? "open" : "closed"}>
      {sheetHead(
        solved ? (
          <>
            {spent && <span className="sheet-spent">{spent} SPENT</span>}
            {rest && <span className="sheet-rest">{rest} UNLOCKED</span>}
          </>
        ) : (
          <>
            {revealed} OF {M} &middot; {open ? "TAP TO CLOSE" : "SWIPE UP"}
          </>
        )
      )}

      <div className="ltop">
        <span className="ltitle">HINT LADDER</span>
        <span className="lcount">{solved ? "COMPLETE" : `${revealed} OF ${M} REVEALED`}</span>
      </div>
      <p className="lintro">Each rung says why you&rsquo;d think of the move, not just the move.</p>

      <div className="lbody">
        {rungs.map((r, i) => {
          const idx = i + 1;
          const roman = toRoman(idx);
          const shown = idx <= revealed || solved;
          const isNext = idx === revealed + 1 && !solved;
          const confirming = pending === idx;
          const far = !shown && !isNext && !confirming;

          return (
            <div
              className={`rung${far ? " far" : ""}${idx === current ? " is-current" : ""}`}
              key={idx}
            >
              {shown ? (
                <>
                  <div className="rhead">
                    <span className={`rnum${solved && idx > revealed ? " lk" : ""}`}>{roman}</span>
                    <span className="rtitle">{r ? r.title : "Loading…"}</span>
                  </div>
                  <div
                    className="rbody"
                    dangerouslySetInnerHTML={{ __html: r ? latexInHtml(r.bodyHtml) : "" }}
                  />
                </>
              ) : confirming ? (
                <div className="confirm">
                  <div className="q">Are you sure you want to reveal the hint?</div>
                  <div className="row">
                    <button className="cbtn yes" onClick={() => onConfirm(idx)}>
                      REVEAL {roman}
                    </button>
                    <button className="cbtn no" onClick={onCancel}>
                      NOT YET
                    </button>
                  </div>
                </div>
              ) : isNext ? (
                <div className="rhead">
                  <span className="rnum lk">{roman}</span>
                  <span className="tease">{teaseFor(i, M)} &middot; LOCKED</span>
                  <button className="reveal" onClick={() => onAsk(idx)}>
                    REVEAL
                  </button>
                </div>
              ) : (
                <div className="rhead">
                  <span className="rnum lk">{roman}</span>
                  <span className="tease" style={{ color: "#A39B8B" }}>
                    {teaseFor(i, M)} &middot; LOCKED
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Stands in for every rung the closed sheet is hiding. Mobile only. */}
        {!solved && hidden && (
          <div className="lockline mono">
            <span className="lockline-n">{hidden}</span>
            <span>LOCKED</span>
          </div>
        )}
      </div>

      <p className="lfoot">Solve it, or exhaust the ladder, and the review layer opens.</p>

      {solved && (
        <div className="sheet-actions">
          <button className="sheet-act" onClick={() => setOpen((v) => !v)}>
            {open ? "HIDE LADDER" : "REVIEW LADDER"}
          </button>
          <Link className="sheet-act primary" href="/browse">
            MORE PROBLEMS
          </Link>
        </div>
      )}

      {children}
    </aside>
  );
}
