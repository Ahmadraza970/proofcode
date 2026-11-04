import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Shown in place of an error when this deployment is locked with the owner
 * token and the current browser has not saved it yet. From the visitor's
 * side the workspace is simply empty — the way in is Settings, not a Retry
 * button on a red error box.
 */
export function ProjectsLockedState() {
  return (
    <EmptyState
      icon={<KeyRound className="size-6" aria-hidden="true" />}
      title="No projects yet"
      description="This workspace is private. Add the owner token once in Settings and your projects will appear here."
    >
      <Button asChild>
        <Link href="/settings">Open Settings</Link>
      </Button>
    </EmptyState>
  );
}
