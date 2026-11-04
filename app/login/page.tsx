"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { GoogleIcon } from "@/components/shared/BrandIcons";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseAuthConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // On success the browser navigates away to Google; reaching this line
    // with an error means the flow never started.
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    setEmail(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <PageHeader
        title="Sign in"
        description="Sign in with Google to keep your own private ProofCode workspace."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          {!configured ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Google sign-in is not configured on this deployment yet, so it
              is switched off.
            </p>
          ) : email ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You are signed in as{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Projects you create are private to your account.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/projects">Go to your projects</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void signOut()}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                onClick={() => void signInWithGoogle()}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleIcon className="size-5" />
                )}
                Sign in with Google
              </Button>
              {error && (
                <p className="text-sm text-critical" role="alert">
                  Sign-in could not start: {error}
                </p>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your projects stay private to your account — nobody else who
                signs in can see or change them.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
