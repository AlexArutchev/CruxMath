"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { isCorrect } from "@/lib/answer";
import type { Rung } from "@/lib/types";

/**
 * Hints, answers and the review layer are fetched on demand rather than sent
 * with the page.
 *
 * Anything passed from a Server Component into a Client Component is serialized
 * into the RSC payload and sits in the page source, so shipping the ladder up
 * front meant every hint and the answer were one Ctrl+F away in view-source.
 * These actions hand back a piece only once the student has asked for it.
 */

/** One rung, requested when the student confirms the reveal. */
export async function revealRung(
  problemId: string,
  index: number
): Promise<Rung | null> {
  if (!problemId || !Number.isInteger(index) || index < 0) return null;
  const sb = supabaseServer();
  const { data } = await sb
    .from("ladders")
    .select("rungs")
    .eq("problem_id", problemId)
    .maybeSingle();
  const rungs = (data?.rungs ?? []) as Rung[];
  return rungs[index] ?? null;
}

/**
 * Grade a guess without ever sending the answer to the browser. The answer comes
 * back only once it has been earned, so the solved view can display it.
 */
export async function checkAnswer(
  problemId: string,
  guess: string
): Promise<{ correct: boolean; answer: string | null }> {
  if (!problemId || typeof guess !== "string") return { correct: false, answer: null };
  const sb = supabaseServer();
  const { data } = await sb
    .from("problems")
    .select("answer")
    .eq("id", problemId)
    .maybeSingle();
  const answer = (data?.answer ?? null) as string | null;
  const correct = isCorrect(guess, answer);
  return { correct, answer: correct ? answer : null };
}

/** The after-action review, once the problem is solved or the ladder is spent. */
export async function getReview(problemId: string): Promise<string | null> {
  if (!problemId) return null;
  const sb = supabaseServer();
  const { data } = await sb
    .from("ladders")
    .select("review_html")
    .eq("problem_id", problemId)
    .maybeSingle();
  return (data?.review_html ?? null) as string | null;
}
