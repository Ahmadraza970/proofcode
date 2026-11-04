"use client";

import { useProof } from "@/lib/store";
import { LandingPage } from "@/components/landing/LandingPage";
import DashboardHome from "@/components/home/DashboardHome";

/**
 * Root (/) branch. Signed-out visitors get the public landing page;
 * signed-in users get the dashboard exactly as before.
 *
 * The decision uses the store's existing session detection: `needsSignIn`
 * is set only after the projects call has answered 401 with no Supabase
 * session behind it, so while the first load is still in flight the
 * dashboard (with its own loading state) renders, and the landing page
 * appears only once signed-out is actually known. Signing in or out
 * while on / re-runs the store refresh and swaps the view to match.
 */
export function HomeRoot() {
  const { loading, needsSignIn } = useProof();

  if (!loading && needsSignIn) {
    return <LandingPage />;
  }
  return <DashboardHome />;
}
