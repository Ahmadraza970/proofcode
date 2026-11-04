"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Palette,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { fetchToken } from "@/lib/api/client";

export default function SettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchToken()
      .then((value) => {
        if (!cancelled) setToken(value);
      })
      .catch((err) => {
        if (!cancelled) {
          setTokenError(
            err instanceof Error ? err.message : "Could not load the API token",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success("API token copied");
    } catch {
      toast.error("Copy failed — select the token and copy it manually");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Preferences and API access for your ProofCode workspace."
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
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Sign-in accounts are coming later. For now, ProofCode runs in a
              local workspace: your projects are stored on the server and
              identified by the API token below, not by a personal account.
            </p>
          </CardContent>
        </Card>

        {/* API access */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <KeyRound className="size-4" aria-hidden="true" />
              API access
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This token authorises API calls that change data — creating,
              analyzing, fixing, verifying and deleting projects. Keep it
              private and do not share it or commit it to a repository.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={
                  tokenError
                    ? ""
                    : token === null
                      ? ""
                      : showToken
                        ? token
                        : "•".repeat(Math.min(token.length, 32))
                }
                placeholder={
                  tokenError ?? (token === null ? "Loading token…" : "")
                }
                aria-label="API token"
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowToken((value) => !value)}
                  disabled={!token}
                >
                  {showToken ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                  {showToken ? "Hide" : "Show"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyToken()}
                  disabled={!token}
                >
                  {token === null && !tokenError ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  Copy
                </Button>
              </div>
            </div>
            {tokenError && (
              <p className="mt-2 text-sm text-critical" role="alert">
                Could not load the API token: {tokenError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
