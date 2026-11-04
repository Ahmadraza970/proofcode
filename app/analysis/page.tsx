import { redirect } from "next/navigation";

/**
 * The old step-by-step analysis screen replayed a scripted animation. The
 * real flow is synchronous — upload → analysis → report — so this route now
 * simply sends visitors to their projects.
 */
export default function AnalysisPage() {
  redirect("/projects");
}
