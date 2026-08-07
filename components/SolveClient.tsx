"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { latexToHtml, latexInHtml } from "@/lib/latex";
import HintLadder from "./HintLadder";
import AopsButton from "./AopsButton";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import { aopsUrl } from "@/lib/aops";
import { revealRung, checkAnswer, getReview } from "@/app/actions";
import {
  solveCost,
  medalForCost,
  medalAfterSolve,
  activeMedal,
  daysLeft,
  medalLapses,
  type Medal,
} from "@/lib/medal";
import type { Problem, Rung } from "@/lib/types";

type Saved = {
  solved: boolean;
  hints_revealed: number;
  attempts: number;
  wrong_attempts: number;
  aops_viewed: boolean;
  medal: Medal | null;
  medal_at: string | null;
};

/** The answer itself never reaches the browser, only its shape. */
export type AnswerKind = "choice" | "integer" | "other";

function costLabel(hints: number, wrong: number): string {
  const bits = [hints + (hints === 1 ? " HINT" : " HINTS")];
  if (wrong > 0) bits.push(wrong + " WRONG");
  return bits.join(" · ");
}

function answerLabel(kind: AnswerKind): string {
  if (kind === "choice") return "ANSWER · MULTIPLE CHOICE";
  if (kind === "integer") return "ANSWER · INTEGER 0-999";
  return "ANSWER";
}

export default function SolveClient({
  problem,
  answerKind,
  rungCount,
  hasLadder,
}: {
  problem: Omit<Problem, "answer">;
  answerKind: AnswerKind;
  rungCount: number;
  hasLadder: boolean;
}) {
  const M = rungCount;

  // Only revealed rungs are ever held here; the rest stay on the server.
  const [rungs, setRungs] = useState<(Rung | null)[]>(() => Array(M).fill(null));
  const [reviewHtml, setReviewHtml] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [pending, setPending] = useState(0);
  const [solved, setSolved] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [aopsViewed, setAopsViewed] = useState(false);
  const [medal, setMedal] = useState<Medal | null>(null);
  const [medalAt, setMedalAt] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const [wasLocked, setWasLocked] = useState(false);
  const [shownAnswer, setShownAnswer] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = useRef<string | null>(null);
  const choiceMode = answerKind === "choice";
  const url = aopsUrl(problem.contest, problem.num);

  // Restore this device's progress. Rungs it had already spent are re-fetched so
  // the page comes back the way it was left.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await ensureDeviceUser();
      if (cancelled) return;
      userId.current = id;
      if (id) {
        const { data } = await supabaseBrowser()
          .from("user_progress")
          .select(
            "solved, hints_revealed, attempts, wrong_attempts, aops_viewed, medal, medal_at"
          )
          .eq("user_id", id)
          .eq("problem_id", problem.id)
          .maybeSingle();
        if (!cancelled && data) {
          const p = data as Saved;
          const n = Math.min(p.hints_revealed, M);
          setRevealed(n);
          setSolved(p.solved);
          setAttempts(p.attempts);
          setWrongAttempts(p.wrong_attempts ?? 0);
          setAopsViewed(p.aops_viewed);
          setMedal(p.medal ?? null);
          setMedalAt(p.medal_at ?? null);
          if (p.solved) {
            setLastCost(solveCost(p.hints_revealed, p.wrong_attempts ?? 0));
            setVerdict({ ok: true, text: "Solved." });
          }
          if (n > 0) {
            const fetched = await Promise.all(
              Array.from({ length: n }, (_, i) => revealRung(problem.id, i))
            );
            if (!cancelled) {
              setRungs((prev) => {
                const next = prev.slice();
                fetched.forEach((r, i) => {
                  next[i] = r;
                });
                return next;
              });
            }
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [problem.id, M]);

  const save = useCallback(
    async (patch: Partial<Saved> & { solved_at?: string | null }) => {
      const id = userId.current;
      if (!id) return;
      await supabaseBrowser()
        .from("user_progress")
        .upsert(
          { user_id: id, problem_id: problem.id, ...patch },
          { onConflict: "user_id,problem_id" }
        );
    },
    [problem.id]
  );

  async function confirmRung(idx: number) {
    setPending(0);
    setBusy(true);
    const rung = await revealRung(problem.id, idx - 1);
    setRungs((prev) => {
      const next = prev.slice();
      next[idx - 1] = rung;
      return next;
    });
    setRevealed(idx);
    setBusy(false);
    void save({ hints_revealed: idx });
  }

  async function check() {
    const given = choiceMode ? choice ?? "" : input.trim();
    if (!given || busy) return;
    setBusy(true);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const { correct, answer } = await checkAnswer(problem.id, given);

    if (correct) {
      const cost = solveCost(revealed, wrongAttempts);
      const outcome = medalAfterSolve(medal, medalAt, cost);
      const now = new Date().toISOString();
      setSolved(true);
      setShownAnswer(answer);
      setLastCost(cost);
      setWasLocked(outcome.locked);
      setMedal(outcome.medal);
      setMedalAt(outcome.medalAt);
      setVerdict({ ok: true, text: "Correct. The answer is " + answer + "." });
      void save({
        solved: true,
        attempts: nextAttempts,
        hints_revealed: revealed,
        wrong_attempts: wrongAttempts,
        solved_at: now,
        medal: outcome.medal,
        medal_at: outcome.medalAt,
      });
    } else {
      const nextWrong = wrongAttempts + 1;
      setWrongAttempts(nextWrong);
      setVerdict({ ok: false, text: "Not yet. A wrong answer costs the same as a hint." });
      void save({ attempts: nextAttempts, wrong_attempts: nextWrong });
    }
    setBusy(false);
  }

  const earned = !hasLadder || solved || revealed >= M;
  const reviewOpen = solved || (M > 0 && revealed >= M);

  // The review is only pulled once it has been earned.
  useEffect(() => {
    if (!reviewOpen || reviewHtml !== null || !hasLadder) return;
    let cancelled = false;
    getReview(problem.id).then((html) => {
      if (!cancelled) setReviewHtml(html ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [reviewOpen, reviewHtml, hasLadder, problem.id]);

  function markAopsViewed() {
    if (aopsViewed) return;
    setAopsViewed(true);
    void save({ aops_viewed: true });
  }

  function resetAttempt() {
    setRevealed(0);
    setPending(0);
    setSolved(false);
    setWrongAttempts(0);
    setLastCost(null);
    setWasLocked(false);
    setShownAnswer(null);
    setChoice(null);
    setInput("");
    setVerdict(null);
    setRungs(Array(M).fill(null));
    setReviewHtml(null);
    void save({ solved: false, hints_revealed: 0, wrong_attempts: 0, solved_at: null });
  }

  const shownMedal = activeMedal(medal, medalAt);
  const canReset = revealed > 0 || solved || wrongAttempts > 0;
  const left = daysLeft(medalAt);
  const attemptMedal = lastCost == null ? null : medalForCost(lastCost);
  const beatenByLock =
    wasLocked && attemptMedal === "gold" && !!shownMedal && shownMedal !== "gold";

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
          <span className="mono m m-diff">DIFFICULTY {problem.difficulty ?? "?"} / 10</span>
          <span className="mono m m-tags">{tagbits}</span>
          {shownMedal && (
            <span className={"solved-pill " + shownMedal}>
              {shownMedal.toUpperCase()} &middot;{" "}
              {medalLapses(shownMedal)
                ? left + (left === 1 ? " DAY LEFT" : " DAYS LEFT")
                : "PERMANENT"}
            </span>
          )}
        </div>

        <p className="stmt" dangerouslySetInnerHTML={{ __html: latexToHtml(problem.statement) }} />

        {problem.figure_img && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="figimg" src={problem.figure_img} alt="Official contest figure" />
            <div className="cap">Official figure, {problem.contest}.</div>
          </figure>
        )}

        <div className="answer">
          <span className="lbl">{answerLabel(answerKind)}</span>

          {choiceMode ? (
            <div className="choices">
              {["A", "B", "C", "D", "E"].map((c) => {
                let cls = "cbox";
                if (solved && shownAnswer && shownAnswer.toUpperCase() === c) cls = "cbox correct";
                else if (verdict && !verdict.ok && choice === c) cls = "cbox wrong";
                else if (choice === c && !solved) cls = "cbox sel";
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
              inputMode={answerKind === "integer" ? "numeric" : undefined}
              autoComplete="off"
              disabled={solved}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void check();
              }}
            />
          )}

          <button
            className="btn"
            onClick={() => void check()}
            disabled={!ready || solved || busy}
          >
            CHECK
          </button>
        </div>

        {(verdict || (solved && lastCost != null)) && (
          <div className="verdict-row">
            {verdict && (
              <span className={"verdict " + (verdict.ok ? "ok" : "no")}>{verdict.text}</span>
            )}
            {solved && lastCost != null && (
              <span className="verdict-cost mono">
                THIS ATTEMPT &middot; {costLabel(revealed, wrongAttempts)}
                {attemptMedal ? " · " + attemptMedal.toUpperCase() : ""}
              </span>
            )}
          </div>
        )}

        {beatenByLock && (
          <div className="lock-note">
            You solved it clean this time, but your {shownMedal} is locked for {left} more
            day{left === 1 ? "" : "s"}. Come back once it lapses and solve it cold to take the
            gold.
          </div>
        )}

        {canReset && (
          <div className="reset-row">
            <button className="reset-btn" onClick={resetAttempt}>
              RESET AND TRY AGAIN
            </button>
            <span className="reset-note">
              {!shownMedal
                ? "Clears your hints and guesses so you can work the problem cold."
                : !medalLapses(shownMedal)
                ? "Clears your hints and guesses. Your gold is permanent, so it stays for good."
                : "Clears your hints and guesses. Your " +
                  shownMedal +
                  " is locked for " +
                  left +
                  (left === 1 ? " more day" : " more days") +
                  " either way, so a retry now cannot change it."}
            </span>
          </div>
        )}

        <AopsButton url={url} hasLadder={hasLadder} earned={earned} onView={markAopsViewed} />

        {reviewOpen && (
          <div className="review">
            <div className="hd">REVIEW</div>
            <div className="rgrid">
              <div
                className="rcard alt"
                style={{ gridColumn: "1/-1" }}
                dangerouslySetInnerHTML={{
                  __html: reviewHtml
                    ? latexInHtml(reviewHtml)
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
        onConfirm={(idx) => void confirmRung(idx)}
        onCancel={() => setPending(0)}
      />
    </div>
  );
}
