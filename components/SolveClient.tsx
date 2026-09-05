"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { latexToHtml, latexInHtml } from "@/lib/latex";
import HintLadder from "./HintLadder";
import AopsButton from "./AopsButton";
import Button from "./ui/Button";
import { useProgressIdentity, type ProgressIdentity } from "@/lib/supabase/progress-identity";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadFilters } from "@/lib/browse-filters";
import { aopsUrl } from "@/lib/aops";
import { revealRung, submitAnswer, getReview } from "@/app/actions";
import {
  solveCost,
  medalForCost,
  medalAfterSolve,
  activeMedal,
  daysLeft,
  isExpired,
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
  const [shownAnswer, setShownAnswer] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [nextState, setNextState] = useState<"idle" | "loading" | "none">("idle");

  const router = useRouter();
  const userId = useRef<string | null>(null);
  const progress = useRef<ProgressIdentity | null>(null);
  const { isLoaded: progressIdentityLoaded, resolve: resolveProgressIdentity } =
    useProgressIdentity();
  const choiceMode = answerKind === "choice";
  const url = aopsUrl(problem.contest, problem.num);

  // Restore this device's progress. Rungs it had already spent are re-fetched so
  // the page comes back the way it was left.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The identity can change in place when someone signs in or out through
      // the header. Clear the old owner's view before loading the new owner's
      // record, including when that record has no row for this problem.
      setRungs(Array(M).fill(null));
      setReviewHtml(null);
      setRevealed(0);
      setPending(0);
      setSolved(false);
      setAttempts(0);
      setWrongAttempts(0);
      setAopsViewed(false);
      setMedal(null);
      setMedalAt(null);
      setLastCost(null);
      setShownAnswer(null);
      setVerdict(null);
      setNextState("idle");
      setReady(false);
      const identity = await resolveProgressIdentity();
      if (cancelled) return;
      userId.current = identity?.userId ?? null;
      progress.current = identity;
      if (identity) {
        const { data } = await identity.client
          .from("user_progress")
          .select(
            "solved, hints_revealed, attempts, wrong_attempts, aops_viewed, medal, medal_at"
          )
          .eq("user_id", identity.userId)
          .eq("problem_id", problem.id)
          .maybeSingle();
        if (!cancelled && data) {
          const p = data as Saved;
          const retryReady =
            !!p.medal && medalLapses(p.medal) && isExpired(p.medal_at);
          setMedal(p.medal ?? null);
          setMedalAt(p.medal_at ?? null);

          // A silver or bronze attempt becomes fresh after its seven-day
          // cooldown. Keep the earned medal, but do not restore any hints,
          // solution state, or answer access from the previous attempt.
          if (retryReady) {
            void identity.client
              .from("user_progress")
              .upsert(
                {
                  user_id: identity.userId,
                  problem_id: problem.id,
                  solved: false,
                  hints_revealed: 0,
                  attempts: 0,
                  wrong_attempts: 0,
                  solved_at: null,
                },
                { onConflict: "user_id,problem_id" }
              );
          } else {
            const n = Math.min(p.hints_revealed, M);
            setRevealed(n);
            setSolved(p.solved);
            setAttempts(p.attempts);
            setWrongAttempts(p.wrong_attempts ?? 0);
            setAopsViewed(p.aops_viewed);
            if (p.solved) {
              setLastCost(solveCost(p.hints_revealed, p.wrong_attempts ?? 0));
              setVerdict({ ok: true, text: "Solved." });
            }
            // A solved problem exposes the entire ladder, including rungs the
            // student did not spend. Fetch those too: rendering all rungs with
            // only the spent ones populated leaves the rest stuck on “Loading…”.
            const rungsToLoad = p.solved ? M : n;
            if (rungsToLoad > 0) {
              const fetched = await Promise.all(
                Array.from({ length: rungsToLoad }, (_, i) => revealRung(problem.id, i))
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
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [problem.id, M, progressIdentityLoaded, resolveProgressIdentity]);

  const save = useCallback(
    async (patch: Partial<Saved> & { solved_at?: string | null }) => {
      const identity = progress.current;
      const id = userId.current;
      if (!id || !identity) return;
      await identity.client
        .from("user_progress")
        .upsert(
          { user_id: id, problem_id: problem.id, ...patch },
          { onConflict: "user_id,problem_id" }
        );
    },
    [problem.id]
  );

  const cooldownActive =
    !!medal && medalLapses(medal) && !isExpired(medalAt, clock);

  // A tab that stays open across the boundary must reset too, not merely one
  // that is revisited later. The timer advances `clock`, then this effect clears
  // the old attempt while leaving its medal and timestamp intact.
  useEffect(() => {
    if (!medal || !medalLapses(medal) || !medalAt || isExpired(medalAt, clock)) return;
    const delay = Math.max(0, Date.parse(medalAt) + 7 * 24 * 60 * 60 * 1000 - Date.now()) + 1;
    const timer = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [medal, medalAt, clock]);

  useEffect(() => {
    if (!medal || !medalLapses(medal) || !isExpired(medalAt, clock)) return;
    setRungs(Array(M).fill(null));
    setReviewHtml(null);
    setRevealed(0);
    setPending(0);
    setSolved(false);
    setAttempts(0);
    setWrongAttempts(0);
    setLastCost(null);
    setShownAnswer(null);
    setChoice(null);
    setInput("");
    setVerdict(null);
    void save({ solved: false, hints_revealed: 0, attempts: 0, wrong_attempts: 0, solved_at: null });
  }, [medal, medalAt, clock, M, save]);

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

    const { correct, answer, rungs: earnedRungs, reviewHtml: earnedReview } = await submitAnswer(
      problem.id,
      given
    );

    if (correct) {
      // `submitAnswer` returns this only after a correct guess. Keeping the
      // earned rungs and review in its response avoids a second action round
      // trip before the solved state can render.
      if (earnedRungs) setRungs(earnedRungs);
      setReviewHtml(earnedReview ?? "");
      const cost = solveCost(revealed, wrongAttempts);
      const outcome = medalAfterSolve(medal, medalAt, cost);
      const now = new Date().toISOString();
      setSolved(true);
      setShownAnswer(answer);
      setLastCost(cost);
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

  async function openNextProblem() {
    if (nextState === "loading") return;
    setNextState("loading");
    try {
      // Browse saves its exact filters before opening a row. Reapply those
      // conditions and its stable contest/number order, then move one slot
      // forward from this problem. The query selects ids only, never answers.
      const filters = loadFilters("");
      let medalIds: string[] | null = null;
      if (filters.medals.size) {
        const identity = await resolveProgressIdentity();
        if (!identity) {
          setNextState("none");
          return;
        }
        const { data } = await identity.client
          .from("user_progress")
          .select("problem_id, medal")
          .eq("user_id", identity.userId)
          .not("medal", "is", null);
        medalIds = (data ?? [])
          .filter((row) => !!row.medal && filters.medals.has(row.medal as Medal))
          .map((row) => row.problem_id);
        if (!medalIds.length) {
          setNextState("none");
          return;
        }
      }

      let query = supabaseBrowser().from("problems").select("id");
      if (filters.q.trim()) query = query.textSearch("statement_fts", filters.q.trim(), { type: "websearch" });
      if (filters.year.trim()) query = query.like("contest", filters.year.trim() + "%");
      if (filters.type) query = query.like("contest", "%" + filters.type + "%");
      if (filters.tiers.size) query = query.in("tier", Array.from(filters.tiers));
      if (filters.topics.size) query = query.overlaps("topics", Array.from(filters.topics));
      if (filters.hints === "with") query = query.eq("has_ladder", true);
      if (filters.hints === "without") query = query.eq("has_ladder", false);
      if (medalIds) query = query.in("id", medalIds);
      if (filters.dlo > 1) query = query.gte("difficulty", filters.dlo);
      if (filters.dhi < 10) query = query.lte("difficulty", filters.dhi);
      const { data, error } = await query
        .order("contest", { ascending: false })
        .order("num", { ascending: true })
        .range(0, 9999);
      if (error) throw error;
      const ids = (data ?? []) as { id: string }[];
      const next = ids[ids.findIndex((item) => item.id === problem.id) + 1];
      if (!next) {
        setNextState("none");
        return;
      }
      router.push("/problem/" + next.id);
    } catch (error) {
      console.warn("[cruxmath] next problem query failed:", (error as Error).message);
      setNextState("none");
    }
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
    if (cooldownActive) return;
    setRevealed(0);
    setPending(0);
    setSolved(false);
    setWrongAttempts(0);
    setLastCost(null);
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

  const tagbits = [
    ...(problem.topics ?? []).map((t) => t.toUpperCase()),
    ...(problem.tier ? [problem.tier.toUpperCase() + " TIER"] : []),
  ].join(" · ");

  /**
   * Rendered twice: once under the statement, once pinned inside the mobile
   * ladder sheet, with CSS showing exactly one. Both read the same state so they
   * cannot disagree, and `display:none` keeps the hidden copy out of the tab
   * order and the accessibility tree. Choosing between them on a media-query
   * hook instead would cost a re-render and a visible jump on every phone that
   * loads the page.
   */
  function answerBlock(place: "col" | "sheet") {
    return (
      <>
        <div className={"answer answer-" + place}>
          <span className="lbl">{answerLabel(answerKind)}</span>

          {choiceMode ? (
            <div className="choices">
              {["A", "B", "C", "D", "E"].map((c) => {
                let cls = "cbox";
                if (solved && shownAnswer && shownAnswer.toUpperCase() === c) cls = "cbox correct";
                else if (verdict && !verdict.ok && choice === c) cls = "cbox wrong";
                else if (choice === c && !solved) cls = "cbox sel";
                return (
                  <Button
                    key={c}
                    variant="secondary"
                    className={cls}
                    aria-pressed={choice === c && !solved}
                    onClick={() => {
                      if (solved) return;
                      setChoice(c);
                      setVerdict(null);
                    }}
                  >
                    {c}
                  </Button>
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

          <Button
            className="btn"
            onClick={() => void check()}
            disabled={!ready || solved || busy}
          >
            CHECK
          </Button>
        </div>

        {(verdict || (solved && lastCost != null)) && (
          <div className={"verdict-row verdict-" + place}>
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
      </>
    );
  }

  return (
    <div className="stage" data-solved={solved ? "1" : "0"}>
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
                ? cooldownActive
                  ? "RETRY IN " + left + (left === 1 ? " DAY" : " DAYS")
                  : "RETRY READY"
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

        {answerBlock("col")}

        {canReset && (
          <div className="reset-row">
            <Button
              variant="secondary"
              className="reset-btn"
              onClick={resetAttempt}
              disabled={cooldownActive}
            >
              RESET AND TRY AGAIN
            </Button>
            <span className="reset-note">
              {!shownMedal
                ? "Clears your hints and guesses so you can work the problem cold."
                : !medalLapses(shownMedal)
                ? "Clears your hints and guesses. Your gold is permanent, so it stays for good."
                : cooldownActive
                ? "Your " +
                  shownMedal +
                  " attempt resets in " +
                  left +
                  (left === 1 ? " day" : " days") +
                  "."
                : "Clears your hints and guesses so you can work the problem cold."}
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
            {/* Inside the review, so it inherits reviewOpen: solved, or every
                rung spent. Below the review text rather than above it, since
                the question it answers is where to go next. */}
          </div>
        )}

        {solved && (
          <div className="next-problem">
            <Button variant="accent" onClick={openNextProblem} disabled={nextState !== "idle"}>
              {nextState === "loading" ? "FINDING NEXT PROBLEM…" : "NEXT PROBLEM"}
            </Button>
            {nextState === "none" && (
              <span className="next-note">No later problem matches your current library filters.</span>
            )}
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
        onNextProblem={openNextProblem}
        nextState={nextState}
      >
        {answerBlock("sheet")}
      </HintLadder>
    </div>
  );
}
