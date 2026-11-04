"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LogOut, Palette, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  clearUserKey,
  getStoredUserKey,
  storeUserKey,
} from "@/lib/api/client";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "@/lib/supabase-browser";

export default function SettingsPage() {
  const [userKeyInput, setUserKeyInput] = useState("");
  const [userKeySaved, setUserKeySaved] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // When sign-in is not configured there is nothing to check — start in
  // the checked state instead of setting it from the effect below.
  const [accountChecked, setAccountChecked] = useState(
    () => !isSupabaseAuthConfigured(),
  );

  useEffect(() => {
    setUserKeySaved(Boolean(getStoredUserKey()));
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccountEmail(data.session?.user?.email ?? null);
      setAccountChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user?.email ?? null);
      setAccountChecked(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    setAccountEmail(null);
    toast.success("Signed out");
  };

  const saveUserKey = () => {
    const value = userKeyInput.trim();
    if (!value) {
      toast.error("Paste your Gemini key first");
      return;
    }
    storeUserKey(value);
    setUserKeySaved(true);
    setUserKeyInput("");
    toast.success("Your AI key is saved in this browser");
  };

  const removeUserKey = () => {
    clearUserKey();
    setUserKeySaved(false);
    setUserKeyInput("");
    toast.success("Your AI key was removed from this browser");
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Preferences and your account for your ProofCode workspace."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preferences */}
        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Palette className="size-4" aria-hidden="true" />
              Preferences
            </h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark appearance.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <UserRound className="size-4" aria-hidden="true" />
              Accounts
            </h2>
            {!accountChecked ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Checking your sign-in…
              </p>
            ) : accountEmail ? (
              <>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  You are signed in as{" "}
                  <span className="font-medium text-foreground">
                    {accountEmail}
                  </span>
                  . Your projects belong to your account and are visible only
                  to you. The workspace owner&rsquo;s account can see every
                  project.
                </p>
                <div className="mt-4">
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
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  ProofCode uses Google sign-in. Your projects belong to your
                  account and are visible only to you.
                </p>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/login">Sign in with Google</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Your own AI key */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              Your own AI key
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Heavy AI work — AI-generated fixes — uses this key first, before
              the server&rsquo;s key. It is stored only in this browser, sent
              only with your fix requests, and never saved on the server.
              Leave it empty to use the server&rsquo;s key. Get a free key
              from{" "}
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Google AI Studio
              </a>
              .
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                value={userKeyInput}
                onChange={(event) => setUserKeyInput(event.target.value)}
                placeholder={
                  userKeySaved
                    ? "A key is saved in this browser — paste a new one to replace it"
                    : "Paste your Gemini API key (optional)"
                }
                aria-label="Your Gemini API key"
                className="font-mono text-xs"
                autoComplete="off"
              />
              <div className="flex gap-2">
                <Button type="button" onClick={saveUserKey}>
                  Save key
                </Button>
                {userKeySaved && (
                  <Button type="button" variant="outline" onClick={removeUserKey}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {userKeySaved
                ? "Status: a key is saved in this browser and will be used for AI fixes."
                : "Status: no key saved — AI fixes will use the server's key."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
