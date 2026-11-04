import type { Metadata } from "next";
import { HomeRoot } from "@/components/home/HomeRoot";

/**
 * Root route metadata. Signed-out visitors see the public landing page
 * here, so this route carries the landing description and Open Graph
 * tags. The title is absolute and matches the site default word for
 * word, so the signed-in dashboard tab title is unchanged.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://proofcodeweb.onrender.com"),
  title: {
    absolute: "ProofCode — Don't just trust AI-generated code. Prove it.",
  },
  description:
    "ProofCode scans JavaScript, TypeScript, and Python code for security issues, explains every finding, generates a fix, and re-scans to verify it, with a 0–100 security health score for every project. Free to use — sign in with Google.",
  openGraph: {
    type: "website",
    siteName: "ProofCode",
    title: "ProofCode — Don't just trust AI-generated code. Prove it.",
    description:
      "Scan your code for security issues, understand each finding, generate a fix, and verify it — with a 0–100 health score for every project.",
    images: [
      {
        url: "/icon.svg",
        width: 64,
        height: 64,
        alt: "ProofCode",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ProofCode — Don't just trust AI-generated code. Prove it.",
    description:
      "Scan your code for security issues, understand each finding, generate a fix, and verify it — with a 0–100 health score for every project.",
    images: ["/icon.svg"],
  },
};

export default function Page() {
  return <HomeRoot />;
}
