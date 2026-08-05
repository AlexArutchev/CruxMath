"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Browser client. The anonymous session is persisted in localStorage, which is
 *  what makes a device remember its progress with nobody ever signing in. */
export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "cruxmath-auth",
      },
    }
  );
  return cached;
}

let signingIn: Promise<string | null> | null = null;

/**
 * Return this device's user id, creating an anonymous account the first time.
 *
 * Anonymous sign-in mints a real auth.users row and a JWT, so row level
 * security can enforce that a device only touches its own progress. There is no
 * UI and no prompt. Clearing site data starts a new identity, which is inherent
 * to any no-sign-in scheme.
 *
 * Concurrent callers share one in-flight request so a page with several
 * components cannot create duplicate users.
 */
export async function ensureDeviceUser(): Promise<string | null> {
  const sb = supabaseBrowser();

  // getSession only reads localStorage, so it happily returns a token for a user
  // that no longer exists server side. getUser validates against the server, which
  // is what lets a device recover instead of failing every write with a dead JWT.
  const { data: existing } = await sb.auth.getSession();
  if (existing.session?.user?.id) {
    const { data: verified } = await sb.auth.getUser();
    if (verified.user?.id) return verified.user.id;
    // Stale token: drop it and mint a fresh anonymous identity below.
    await sb.auth.signOut().catch(() => {});
  }

  if (!signingIn) {
    signingIn = sb.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error) {
          // Most likely cause: anonymous sign-ins are disabled in the project.
          console.warn("[cruxmath] anonymous sign-in failed:", error.message);
          return null;
        }
        return data.user?.id ?? null;
      })
      .finally(() => {
        signingIn = null;
      });
  }
  return signingIn;
}
