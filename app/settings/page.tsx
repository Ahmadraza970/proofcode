"use client";

import { Info, Lock, UserRound, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CURRENT_USER } from "@/lib/mock-data";

export default function SettingsPage() {
  const user = CURRENT_USER;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Profile and preferences for your ProofCode workspace."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <UserRound className="size-4" aria-hidden="true" />
              Profile
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-brand/15 text-base font-semibold text-brand">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              This is a demo workspace. Authentication and profile persistence are
              out of scope for the hackathon MVP.
            </p>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              <Zap className="size-4" aria-hidden="true" />
              Preferences
            </h2>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Appearance</p>
                <p className="text-xs text-muted-foreground">
                  Light is the default; dark follows your saved choice.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo note */}
      <Card className="border-brand/25 bg-brand-dim/20">
        <CardContent className="flex items-start gap-3 p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-brand">
              <Info className="size-4" aria-hidden="true" />
              About this build
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              ProofCode verifies real codebases end to end: upload or clone,
              static analysis, deterministic and AI-assisted fixes, re-scan, and
              test execution. The demo workflow runs on realistic sample data so
              you can explore every screen instantly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}