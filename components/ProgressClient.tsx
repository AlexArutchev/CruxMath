"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { latexToHtml } from "@/lib/latex";
import ProgressSkeleton from "./ProgressSkeleton";
import { supabaseBrowser, ensureDeviceUser } from "@/lib/supabase/client";
import type { Medal } from "@/lib/medal";
import {
  byContest,
  byDifficulty,
  countByMedal,
  hardestGold,
  hintsLabel,
  medalSplit,
  shortDate,
  totalOf,
  MEDAL_ORDER,
  type SolveRecord,
} from "@/lib/progress";

const DIFF_MIN = 1;
const DIFF_MAX = 10;
const LEDGER_PAGE = 25;

export default function ProgressClient({
  archiveTotal,
  archiveByGroup,
  allTopics,
}: {
  archiveTotal: number;
  archiveByGroup: Record<string, number>;
  allTopics: string[];
}) {
  const [records, setRecords] = useState<SolveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<string | null>(null);
  const [dlo, setDlo] = useState(DIFF_MIN);
  const [dhi, setDhi] = useState(DIFF_MAX);
  const [shown, setShown] = useState(LEDGER_PAGE);

  // Every medal ever earned counts here, lapsed or not. The 7-day expiry drives
  // the library tint (a nudge to revisit); a record of what you solved should
  // not shrink over time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await ensureDeviceUser();
      if (!id || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const sb = supabaseBrowser();
      const { data: prog } = await sb
        .from("user_progress")
        .select("problem_id, medal, medal_at")
        .eq("user_id", id)
        .not("medal", "is", null);
      if (cancelled) return;

      const rows = (prog ?? []) as { problem_id: string; medal: Medal; medal_at: string }[];
      if (!rows.length) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data: probs } = await sb
        .from("problems")
        .select("id, contest, num, statement, difficulty, topics")
        .in(
          "id",
          rows.map((r) => r.problem_id)
        );
      if (cancelled) return;

      const byId = new Map(
        (
          (probs ?? []) as {
            id: string;
            contest: string;
            num: number;
            statement: string;
            difficulty: number | null;
            topics: string[];
          }[]
        ).map((p) => [p.id, p])
      );

      const built: SolveRecord[] = [];
      for (const r of rows) {
        const p = byId.get(r.problem_id);
        if (!p) continue;
        built.push({
          problemId: p.id,
          contest: p.contest,
          num: p.num,
          statement: p.statement,
          difficulty: p.difficulty,
          topics: p.topics ?? [],
          medal: r.medal,
          medalAt: r.medal_at,
        });
      }
      built.sort((a, b) => (b.medalAt ?? "").localeCompare(a.medalAt ?? ""));
      setRecords(built);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => countByMedal(records), [records]);
  const split = useMemo(() => medalSplit(counts), [counts]);
  const contests = useMemo(
    () => byContest(records, archiveByGroup),
    [records, archiveByGroup]
  );
  const buckets = useMemo(() => byDifficulty(records), [records]);
  const peakColumn = useMemo(
    () => Math.max(1, ...buckets.map((b) => totalOf(b.counts))),
    [buckets]
  );
  const best = useMemo(() => hardestGold(records), [records]);

  const ledger = useMemo(() => {
    return records.filter((r) => {
      if (topic && !r.topics.includes(topic)) return false;
      const d = r.difficulty;
      if (d == null) return dlo === DIFF_MIN && dhi === DIFF_MAX;
      return d >= dlo && d <= dhi;
    });
  }, [records, topic, dlo, dhi]);
  const ledgerCounts = useMemo(() => countByMedal(ledger), [ledger]);

  const solved = records.length;
  const filterLabel = [
    topic ? topic.toUpperCase() : "ALL TOPICS",
    dlo === DIFF_MIN && dhi === DIFF_MAX ? null : "DIFFICULTY " + dlo + "-" + dhi,
  ]
    .filter(Boolean)
    .join(" · ");

  // The shell can arrive well before the record does, especially with a few
  // hundred solves. Reuse the route skeleton so the two phases look identical.
  if (loading) return <ProgressSkeleton />;

  return (
    <div>
      {/* ---- stat band ---- */}
      <div className="pg-band">
        <div className="lead">
          <div className="pg-label">PROBLEMS SOLVED</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
            <span className="pg-big">{loading ? "—" : solved}</span>
            <span className="pg-of">of {archiveTotal} in the archive</span>
          </div>
          <div className="pg-split">
            <span className="gold" style={{ width: split.gold + "%" }} />
            <span className="silver" style={{ width: split.silver + "%" }} />
            <span className="bronze" style={{ width: split.bronze + "%" }} />
          </div>
        </div>
        <div className="counters">
          {MEDAL_ORDER.map((m) => (
            <div className="counter" key={m}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={"pg-dot " + m} />
                <span className="pg-label" style={{ color: "var(--" + m + ")" }}>
                  {m.toUpperCase()}
                </span>
              </div>
              <div className="pg-num">{counts[m]}</div>
              <div className="pg-cap">
                {m === "gold"
                  ? "no hints spent"
                  : m === "silver"
                  ? "one hint"
                  : "two or more"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- by contest / by difficulty ---- */}
      <div className="pg-mid">
        <div className="pg-contests">
          <div className="pg-label" style={{ marginBottom: 6 }}>
            BY CONTEST
          </div>
          {contests.map((c) => {
            const s = medalSplit(c.counts);
            const share = c.total ? (c.solved / c.total) * 100 : 0;
            return (
              <div className="pg-crow" key={c.group}>
                <span className="pg-cname">{c.group}</span>
                <span>
                  <span className="pg-csolved">{c.solved}</span>
                  <span className="pg-ctotal"> / {c.total} solved</span>
                  {/* Bar length is the share of the archive; the split inside it is the medal mix. */}
                  <span className="pg-cbar">
                    <span className="gold" style={{ width: (share * s.gold) / 100 + "%" }} />
                    <span
                      className="silver"
                      style={{ width: (share * s.silver) / 100 + "%" }}
                    />
                    <span
                      className="bronze"
                      style={{ width: (share * s.bronze) / 100 + "%" }}
                    />
                  </span>
                </span>
                <span className="pg-ccounts">
                  <span style={{ color: "var(--gold)" }}>{c.counts.gold}</span>
                  <span style={{ color: "var(--silver)" }}>{c.counts.silver}</span>
                  <span style={{ color: "var(--bronze)" }}>{c.counts.bronze}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="pg-hist">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span className="pg-label">SOLVED BY DIFFICULTY</span>
            <span className="pg-label" style={{ letterSpacing: ".1em" }}>
              MEDALS STACKED
            </span>
          </div>
          <div className="pg-bars" style={{ marginTop: 16 }}>
            {buckets.map((b) => {
              const px = (n: number) => (n / peakColumn) * 124;
              return (
                <div className="pg-col" key={b.difficulty}>
                  <span className="gold" style={{ height: px(b.counts.gold) }} />
                  <span className="silver" style={{ height: px(b.counts.silver) }} />
                  <span className="bronze" style={{ height: px(b.counts.bronze) }} />
                </div>
              );
            })}
          </div>
          <div className="pg-axis">
            {buckets.map((b) => (
              <span key={b.difficulty}>{b.difficulty}</span>
            ))}
          </div>
          <p className="pg-note">
            {best ? (
              <>
                Hardest gold so far: difficulty{" "}
                <b style={{ color: "var(--ink)" }}>{best.difficulty}</b>, {best.contest}{" "}
                Problem {best.num}.
              </>
            ) : (
              "No golds yet. A gold is a problem you solved with no hints and no wrong guesses."
            )}
          </p>
        </div>
      </div>

      {/* ---- ledger ---- */}
      <div className="pg-ledger">
        <div className="pg-filters">
          <span className="pg-label">SOLVED LEDGER</span>

          <div className="pg-fgroup">
            <span className="pg-label" style={{ fontSize: 9.5 }}>
              TOPIC
            </span>
            <span
              className={"chip" + (topic === null ? " on" : "")}
              onClick={() => {
                setTopic(null);
                setShown(LEDGER_PAGE);
              }}
            >
              ALL TOPICS
            </span>
            {allTopics.map((t) => (
              <span
                key={t}
                className={"chip" + (topic === t ? " on" : "")}
                onClick={() => {
                  setTopic(topic === t ? null : t);
                  setShown(LEDGER_PAGE);
                }}
              >
                {t.toUpperCase()}
              </span>
            ))}
          </div>

          <div className="pg-fgroup">
            <span className="pg-label" style={{ fontSize: 9.5 }}>
              DIFFICULTY
            </span>
            <div className="drange" style={{ width: 120 }}>
              <div className="track" />
              <div
                className="fill"
                style={{
                  left: ((dlo - 1) / 9) * 100 + "%",
                  width: ((dhi - dlo) / 9) * 100 + "%",
                }}
              />
              <input
                type="range"
                min={DIFF_MIN}
                max={DIFF_MAX}
                step={0.5}
                value={dlo}
                onChange={(e) => {
                  setDlo(Math.min(+e.target.value, dhi));
                  setShown(LEDGER_PAGE);
                }}
              />
              <input
                type="range"
                min={DIFF_MIN}
                max={DIFF_MAX}
                step={0.5}
                value={dhi}
                onChange={(e) => {
                  setDhi(Math.max(+e.target.value, dlo));
                  setShown(LEDGER_PAGE);
                }}
              />
            </div>
            <span
              style={{ fontWeight: 600, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
            >
              {dlo} &ndash; {dhi}
            </span>
          </div>
        </div>

        <div className="pg-matchbar">
          <span className="pg-label">
            {loading
              ? "READING YOUR RECORD..."
              : ledger.length +
                " SOLVE" +
                (ledger.length === 1 ? "" : "S") +
                " MATCH" +
                (filterLabel ? " — " + filterLabel : "")}
          </span>
          <span className="pg-ccounts">
            <span style={{ color: "var(--gold)" }}>{ledgerCounts.gold} G</span>
            <span style={{ color: "var(--silver)" }}>{ledgerCounts.silver} S</span>
            <span style={{ color: "var(--bronze)" }}>{ledgerCounts.bronze} B</span>
          </span>
        </div>

        {!loading && !records.length && (
          <p className="pg-empty">
            Nothing solved yet. Every problem you finish lands here with the medal you
            earned on it.
          </p>
        )}

        {!loading && !!records.length && !ledger.length && (
          <p className="pg-empty">No solves match those filters.</p>
        )}

        {ledger.slice(0, shown).map((r) => (
          <Link className="pg-lrow" key={r.problemId} href={"/problem/" + r.problemId}>
            <span className={"pg-dot " + r.medal} />
            <span className="pg-lsrc">
              {r.contest.toUpperCase()} &middot; {r.num}
            </span>
            <span
              className="pg-ltex"
              dangerouslySetInnerHTML={{ __html: latexToHtml(r.statement) }}
            />
            <span className="pg-ldiff">{r.difficulty ?? "?"}</span>
            <span className="pg-lmeta">
              {hintsLabel(r.medal)}
              {r.medalAt ? " · " + shortDate(r.medalAt) : ""}
            </span>
          </Link>
        ))}

        {ledger.length > shown && (
          <div style={{ textAlign: "center", padding: "18px 0 0" }}>
            <button className="loadmore" onClick={() => setShown((s) => s + LEDGER_PAGE)}>
              {ledger.length - shown} more{" "}
              {ledger.length - shown === 1 ? "solve" : "solves"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
