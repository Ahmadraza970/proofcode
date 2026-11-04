"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client for Google sign-in (Supabase Auth).
 *
 * Configured purely from the public env vars; when they are absent the
 * sign-in surface disables itself and the API rejects every call (there
 * is no other way in). The
 * anon key is safe to ship to the browser — every API call is still
 * authorised server-side, where the access token is validated on each
 * request.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let browserClient: SupabaseClient | null = null;

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

/** The current sign-in session's access token, or null when signed out. */
export async function getSessionAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
