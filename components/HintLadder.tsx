"use client";

import { latexInHtml } from "@/lib/latex";
import type { Rung } from "@/lib/types";

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

export default function HintLadder({
  rungs,
  revealed,
  pending,
  solved,
  onAsk,
  onConfirm,
  onCancel,
}: {
  rungs: Rung[];
  revealed: number;
  pending: number;
  solved: boolean;
  onAsk: (idx: number) => void;
  onConfirm: (idx: number) => void;
  onCancel: () => void;
}) {
  if (!rungs.length) {
    return (
      <aside>
        <div className="ltop">
          <span className="ltitle">HINT LADDER</span>
          <span className="lcount">NOT YET AUTHORED</span>
        </div>
        <p className="lintro">Each rung says why you&rsquo;d think of the move, not just the move.</p>
        <div className="placeholder">
          A hint ladder has not been authored for this problem yet. The answer check on
          the left still works for every problem.
        </div>
      </aside>
    );
  }

  const M = rungs.length;
  return (
    <aside>
      <div className="ltop">
        <span className="ltitle">HINT LADDER</span>
        <span className="lcount">{solved ? "COMPLETE" : `${revealed} OF ${M} REVEALED`}</span>
      </div>
      <p className="lintro">Each rung says why you&rsquo;d think of the move, not just the move.</p>

      {rungs.map((r, i) => {
        const idx = i + 1;
        const roman = toRoman(idx);
        const open = idx <= revealed || solved;
        const isNext = idx === revealed + 1 && !solved;
        const confirming = pending === idx;
        const far = !open && !isNext && !confirming;

        return (
          <div className={`rung${far ? " far" : ""}`} key={idx}>
            {open ? (
              <>
                <div className="rhead">
                  <span className={`rnum${solved && idx > revealed ? " lk" : ""}`}>{roman}</span>
                  <span className="rtitle">{r.title}</span>
                </div>
                <div
                  className="rbody"
                  dangerouslySetInnerHTML={{ __html: latexInHtml(r.bodyHtml) }}
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

      <p className="lfoot">Solve it, or exhaust the ladder, and the review layer opens.</p>
    </aside>
  );
}
