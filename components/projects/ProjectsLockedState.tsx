import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Shown in place of an error when the visitor is not signed in. From
 * their side the workspace is simply private and empty — the one way in
 * is Google sign-in, not a Retry button on a red error box.
 */
export function ProjectsLockedState() {
  return (
    <EmptyState
      icon={<LogIn className="size-6" aria-hidden="true" />}
      title="No projects yet"
      description="This workspace is private. Sign in with Google to see your projects and run your first check."
    >
      <Button asChild>
        <Link href="/login">Sign in with Google</Link>
      </Button>
    </EmptyState>
  );
}
