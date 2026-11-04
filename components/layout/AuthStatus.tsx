"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "@/lib/supabase-browser";
import { useProof } from "@/lib/store";

/**
 * Sign-in state for the header: a "Sign in" link when signed out, the
 * signed-in user's email plus a "Sign out" button when signed in.
 *
 * Renders nothing until the session state is known (no flash of the wrong
 * state), and nothing at all when Supabase Auth is not configured on this
 * deployment — the owner-token path then stands alone, as before.
 */
export function AuthStatus() {
  const router = useRouter();
  const { refresh } = useProof();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    // Not configured: the render guard below returns null regardless of
    // `ready`, so there is nothing to do here.
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseAuthConfigured() || !ready) return null;

  if (!email) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">
          <LogIn className="size-4" aria-hidden="true" />
          Sign in
        </Link>
      </Button>
    );
  }

  const signOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    setEmail(null);
    // The store also refreshes on SIGNED_OUT; refresh here too so the
    // signed-out state is reflected even before that event lands.
    void refresh();
    router.push("/");
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden max-w-44 truncate text-xs text-muted-foreground md:inline"
        title={email}
      >
        {email}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
