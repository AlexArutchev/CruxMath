"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { ensureDeviceUser, supabaseBrowser, supabaseForClerk } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProgressRow = {
  problem_id: string;
  solved: boolean;
  hints_revealed: number;
  attempts: number;
  wrong_attempts: number;
  aops_viewed: boolean;
  medal: "gold" | "silver" | "bronze" | null;
  medal_at: string | null;
  solved_at: string | null;
  first_seen_at: string;
};

export type ProgressIdentity = {
  userId: string;
  client: SupabaseClient;
};

const medalRank: Record<NonNullable<ProgressRow["medal"]>, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

function mergeRow(anonymous: ProgressRow, account?: ProgressRow): ProgressRow {
  if (!account) return anonymous;

  const anonymousRank = anonymous.medal ? medalRank[anonymous.medal] : 0;
  const accountRank = account.medal ? medalRank[account.medal] : 0;
  const medalFromAnonymous = anonymousRank > accountRank;
  const medal = medalFromAnonymous ? anonymous.medal : account.medal;
  const medal_at = medalFromAnonymous
    ? anonymous.medal_at
    : accountRank > anonymousRank
    ? account.medal_at
    : (anonymous.medal_at ?? "") > (account.medal_at ?? "")
    ? anonymous.medal_at
    : account.medal_at;

  return {
    problem_id: anonymous.problem_id,
    solved: anonymous.solved || account.solved,
    hints_revealed: Math.max(anonymous.hints_revealed, account.hints_revealed),
    attempts: Math.max(anonymous.attempts, account.attempts),
    wrong_attempts: Math.max(anonymous.wrong_attempts, account.wrong_attempts),
    aops_viewed: anonymous.aops_viewed || account.aops_viewed,
    medal,
    medal_at,
    solved_at:
      !anonymous.solved_at || (account.solved_at && account.solved_at < anonymous.solved_at)
        ? account.solved_at
        : anonymous.solved_at,
    first_seen_at:
      anonymous.first_seen_at < account.first_seen_at
        ? anonymous.first_seen_at
        : account.first_seen_at,
  };
}

/**
 * Copy a browser's anonymous progress into an account exactly once. The source
 * rows are never deleted: signing out still returns the browser to its local,
 * anonymous record. If an account already has the same problem, we preserve the
 * stronger medal and the furthest state reached on either device.
 */
async function mergeAnonymousProgress(
  anonymousId: string,
  accountId: string,
  accountClient: SupabaseClient
) {
  if (typeof window === "undefined") return;
  const marker = `cruxmath-clerk-merged:${accountId}:${anonymousId}`;
  if (window.localStorage.getItem(marker)) return;

  const anonymousClient = supabaseBrowser();
  const { data: anonymousRows, error: anonymousError } = await anonymousClient
    .from("user_progress")
    .select(
      "problem_id, solved, hints_revealed, attempts, wrong_attempts, aops_viewed, medal, medal_at, solved_at, first_seen_at"
    )
    .eq("user_id", anonymousId);
  if (anonymousError) throw anonymousError;

  const source = (anonymousRows ?? []) as ProgressRow[];
  if (!source.length) {
    window.localStorage.setItem(marker, "1");
    return;
  }

  const { data: accountRows, error: accountError } = await accountClient
    .from("user_progress")
    .select(
      "problem_id, solved, hints_revealed, attempts, wrong_attempts, aops_viewed, medal, medal_at, solved_at, first_seen_at"
    )
    .eq("user_id", accountId)
    .in(
      "problem_id",
      source.map((row) => row.problem_id)
    );
  if (accountError) throw accountError;

  const accountByProblem = new Map(
    ((accountRows ?? []) as ProgressRow[]).map((row) => [row.problem_id, row])
  );
  const merged = source.map((row) => ({
    user_id: accountId,
    ...mergeRow(row, accountByProblem.get(row.problem_id)),
  }));
  const { error: writeError } = await accountClient
    .from("user_progress")
    .upsert(merged, { onConflict: "user_id,problem_id" });
  if (writeError) throw writeError;

  window.localStorage.setItem(marker, "1");
}

/**
 * Select the identity that owns progress. Anonymous Supabase auth remains the
 * default. Once someone elects to sign in, Clerk's stable user id and token
 * take over and the current browser's saved work is merged into that account.
 */
export function useProgressIdentity() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  const resolve = useCallback(async (): Promise<ProgressIdentity | null> => {
    if (!isLoaded) return null;
    if (!isSignedIn || !userId) {
      const anonymousId = await ensureDeviceUser();
      return anonymousId ? { userId: anonymousId, client: supabaseBrowser() } : null;
    }

    const client = supabaseForClerk(getToken);
    const anonymousId = await ensureDeviceUser();
    if (anonymousId) {
      try {
        await mergeAnonymousProgress(anonymousId, userId, client);
      } catch (error) {
        // Account progress remains usable even if the best-effort one-time
        // migration is interrupted. It will retry on the next page load.
        console.warn("[cruxmath] anonymous progress merge failed:", (error as Error).message);
      }
    }
    return { userId, client };
  }, [getToken, isLoaded, isSignedIn, userId]);

  return { isLoaded, resolve };
}
