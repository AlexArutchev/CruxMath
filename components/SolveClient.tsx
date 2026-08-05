"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { latexToHtml, latexInHtml } from "@/lib/latex";
import HintLadder from "./HintLadder";
import AopsButton from "./AopsButton";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import { isChoiceAnswer, isCorrect, answerLabel } from "@/lib/answer";
import { aopsUrl } from "@/lib/aops";
import {
  medalForHints,
  bestMedal,
  activeMedal,
  daysLeft,
  medalLapses,
  type Medal,
} from "@/lib/medal";
import type { Problem, Ladder } from "@/lib/types";

type Saved = {
  solved: boolean;
  hints_revealed: number;
  attempts: number;
  aops_viewed: boolean;
  medal: Medal | null;
  medal_at: string | null;
};

export default function SolveClient({
  problem,
  ladder,
}: {
  problem: Problem;
  ladder: Ladder | null;
}) {
  const rungs = ladder?.rungs ?? [];
  const M = rungs.length;

  const [revealed, setRevealed] = useState(0);
  const [pending, setPending] = useState(0);
  const [solved, setSolved] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [aopsViewed, setAopsViewed] = useState(false);
  const [hintsAtSolve, setHintsAtSolve] = useState(0);
  const [medal, setMedal] = useState<Medal | null>(null);
  const [medalAt, setMedalAt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [ready, setReady] = useState(false);

  const userId = useRef<string | null>(null);
  const choiceMode = isChoiceAnswer(problem.answer);
  const url = aopsUrl(problem.contest, problem.num);

  // Load this device's prior progress, creating the anonymous user on first visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await ensureDeviceUser();
      if (cancelled) return;
      userId.current = id;
      if (id) {
        const { data } = await supabaseBrowser()
          .from("user_progress")
          .select("solved, hints_revealed, attempts, aops_viewed, medal, medal_at")
          .eq("user_id", id)
          .eq("problem_id", problem.id)
          .maybeSingle();
        if (!cancelled && data) {
          const p = data as Saved;
          setRevealed(Math.min(p.hints_revealed, M));
          setSolved(p.solved);
          setHintsAtSolve(p.hints_revealed);
          setAttempts(p.attempts);
          setAopsViewed(p.aops_viewed);
          setMedal(p.medal ?? null);
          setMedalAt(p.medal_at ?? null);
          if (p.solved) {
            setVerdict({ ok: true, text: "Solved. The answer is " + problem.answer + "." });
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [problem.id, problem.answer, M]);

  const save = useCallback(
    async (patch: Partial<Saved> & { solved_at?: string | null }) => {
      const id = userId.current;
      if (!id) return; // anonymous sign-in unavailable; page still works, just unsaved
      await supabaseBrowser()
        .from("user_progress")
        .upsert(
          { user_id: id, problem_id: problem.id, ...patch },
          { onConflict: "user_id,problem_id" }
        );
    },
    [problem.id]
  );

  function confirmRung(idx: number) {
    setRevealed(idx);
    setPending(0);
    void save({ hints_revealed: idx });
  }

  function check() {
    const given = choiceMode ? choice ?? "" : input.trim();
    if (!given) return;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (isCorrect(given, problem.answer)) {
      // Hints spent on THIS attempt decide the medal. A previously earned medal
      // is never demoted by a hintier re-solve, and any solve restarts the clock.
      const justEarned = medalForHints(revealed);
      const keep = bestMedal(activeMedal(medal, medalAt), justEarned) ?? justEarned;
      const now = new Date().toISOString();

      setSolved(true);
      setHintsAtSolve(revealed);
      setMedal(keep);
      setMedalAt(now);
      setVerdict({ ok: true, text: "Correct. The answer is " + problem.answer + "." });
      void save({
        solved: true,
        attempts: nextAttempts,
        hints_revealed: revealed,
        solved_at: now,
        medal: keep,
        medal_at: now,
      });
    } else {
      setVerdict({ ok: false, text: "Not yet. The ladder is there when you want it." });
      void save({ attempts: nextAttempts });
    }
  }

  function markAopsViewed() {
    if (aopsViewed) return;
    setAopsViewed(true);
    void save({ aops_viewed: true });
  }

  /**
   * Re-lock the hints and clear the solve so the problem can be attempted cold.
   * The medal and its timestamp are deliberately left alone: what you already
   * earned stays in the library until it lapses on its own.
   */
  function resetAttempt() {
    setRevealed(0);
    setPending(0);
    setSolved(false);
    setHintsAtSolve(0);
    setChoice(null);
    setInput("");
    setVerdict(null);
    void save({ solved: false, hints_revealed: 0, solved_at: null });
  }

  const earned = !ladder || solved || revealed >= M;
  const reviewOpen = solved || (M > 0 && revealed >= M);
  const shownMedal = activeMedal(medal, medalAt);
  const canReset = revealed > 0 || solved;
  const left = daysLeft(medalAt);

  const tagbits = [
    ...(problem.topics ?? []).map((t) => t.toUpperCase()),
    ...(problem.tier ? [problem.tier.toUpperCase() + " TIER"] : []),
  ].join(" · ");

  return (
    <div className="stage">
      <div className="col">
        <div className="meta">
          <span className="mono m m-loc">
            {problem.contest.toUpperCase()} &middot; PROBLEM {problem.num}
          </span>
          <span className="mono m m-diff">
            DIFFICULTY {problem.difficulty ?? "?"} / 10
          </span>
          <span className="mono m m-tags">{tagbits}</span>
          {solved && (
            <span className={"solved-pill " + medalForHints(hintsAtSolve)}>
              {medalForHints(hintsAtSolve).toUpperCase()} &middot; {hintsAtSolve} HINT
              {hintsAtSolve === 1 ? "" : "S"}
            </span>
          )}
        </div>

        <p className="stmt" dangerouslySetInnerHTML={{ __html: latexToHtml(problem.statement) }} />

        {problem.figure_img && (
          <figure>
            {/* Official contest figure. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="figimg" src={problem.figure_img} alt="Official contest figure" />
            <div className="cap">Official figure, {problem.contest}.</div>
          </figure>
        )}

        <div className="answer">
          <span className="lbl">{answerLabel(problem.answer)}</span>

          {choiceMode ? (
            <div className="choices">
              {["A", "B", "C", "D", "E"].map((c) => {
                let cls = "cbox";
                if (solved && problem.answer && problem.answer.toUpperCase() === c) {
                  cls = "cbox correct";
                } else if (verdict && !verdict.ok && choice === c) {
                  cls = "cbox wrong";
                } else if (choice === c && !solved) {
                  cls = "cbox sel";
                }
                return (
                  <button
                    key={c}
                    className={cls}
                    onClick={() => {
                      if (solved) return;
                      setChoice(c);
                      setVerdict(null);
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              className="ainput"
              value={input}
              placeholder="&middot;&middot;&middot;"
              inputMode={
                problem.answer && /^\d+$/.test(problem.answer) ? "numeric" : undefined
              }
              autoComplete="off"
              disabled={solved}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") check();
              }}
            />
          )}

          <button className="btn" onClick={check} disabled={!ready || solved}>
            CHECK
          </button>
          {verdict && (
            <span className={"verdict " + (verdict.ok ? "ok" : "no")}>{verdict.text}</span>
          )}
        </div>

        {canReset && (
          <div className="reset-row">
            <button className="reset-btn" onClick={resetAttempt}>
              RESET AND TRY AGAIN
            </button>
            <span className="reset-note">
              {!shownMedal
                ? "Re-locks the hints so you can work the problem cold."
                : !medalLapses(shownMedal)
                ? "Re-locks the hints for a clean attempt. Your gold is permanent, so it stays in the library for good."
                : "Re-locks the hints for a clean attempt. Your " +
                  shownMedal +
                  " stays in the library for " +
                  left +
                  (left === 1 ? " more day" : " more days") +
                  ", and solving again with no hints earns a gold that never fades."}
            </span>
          </div>
        )}

        <AopsButton url={url} hasLadder={!!ladder} earned={earned} onView={markAopsViewed} />

        {reviewOpen && (
          <div className="review">
            <div className="hd">REVIEW</div>
            <div className="rgrid">
              <div
                className="rcard alt"
                style={{ gridColumn: "1/-1" }}
                dangerouslySetInnerHTML={{
                  __html: ladder?.review_html
                    ? latexInHtml(ladder.review_html)
                    : "<p>The after-action review has not been authored for this problem yet.</p>",
                }}
              />
            </div>
          </div>
        )}
      </div>

      <HintLadder
        rungs={rungs}
        revealed={revealed}
        pending={pending}
        solved={solved}
        onAsk={setPending}
        onConfirm={confirmRung}
        onCancel={() => setPending(0)}
      />
    </div>
  );
}
