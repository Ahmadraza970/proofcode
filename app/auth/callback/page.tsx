"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "@/lib/supabase-browser";

/**
 * OAuth landing route. Google returns here (via Supabase Auth) after the
 * consent screen; this page finishes establishing the session — the
 * browser client picks the PKCE code up automatically, with one explicit
 * exchange as a fallback — and then sends the user to their projects.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  // Failures that are knowable immediately (auth not configured, or Google
  // sent an error back) are derived during the first render instead of
  // being set from inside the effect.
  const [error, setError] = useState<string | null>(() => {
    if (!isSupabaseAuthConfigured()) {
      return "Google sign-in is not configured on this deployment.";
    }
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("error_description") ?? params.get("error");
  });
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    if (error) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const params = new URLSearchParams(window.location.search);

    let done = false;
    const goToProjects = () => {
      if (done) return;
      done = true;
      router.replace("/projects");
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goToProjects();
    });

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) goToProjects();
    });

    // Fallback: if the client has not consumed the PKCE code on its own
    // within a moment, exchange it explicitly — once.
    const code = params.get("code");
    const exchangeTimer = code
      ? setTimeout(() => {
          if (done || exchangeAttempted.current) return;
          exchangeAttempted.current = true;
          void supabase.auth.exchangeCodeForSession(code).then((result) => {
            if (result.error && !done) setError(result.error.message);
          });
        }, 1200)
      : undefined;

    const giveUpTimer = setTimeout(() => {
      if (!done) {
        setError("Sign-in did not complete. Please try again.");
      }
    }, 10000);

    return () => {
      data.subscription.unsubscribe();
      if (exchangeTimer) clearTimeout(exchangeTimer);
      clearTimeout(giveUpTimer);
    };
  }, [router, error]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md">
        <ErrorState title="Sign-in failed" description={error}>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </ErrorState>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-3 py-16 text-muted-foreground"
      aria-busy="true"
    >
      <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}
