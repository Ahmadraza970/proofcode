import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProofCodeProvider } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/layout/TopNav";
import { SkipLink } from "@/components/layout/SkipLink";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ProofCode — Don't just trust AI-generated code. Prove it.",
    template: "%s — ProofCode",
  },
  description:
    "Analyze, fix, test, and verify your software with an AI-powered code verification workflow.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1b1712" },
    { media: "(prefers-color-scheme: light)", color: "#fffdf7" },
  ],
};

/**
 * Runs during HTML parsing, before first paint: applies the saved theme (light
 * by default) to <html data-theme> and mirrors it onto the `dark` class that
 * the shadcn dark: variants rely on. No flash, no hydration mismatch.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var t=s||"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.toggle("dark",t!=="light");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ProofCodeProvider>
          <SkipLink />
          <TopNav />
          <main
            id="main"
            className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8"
          >
            {children}
          </main>
          <footer className="border-t border-border py-8">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-2 px-4 text-center sm:px-6 lg:px-8">
              <p className="text-sm text-muted-foreground">
ProofCode — Don&apos;t just trust AI-generated code. Prove it.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Hackathon MVP · demo data only · built with Next.js
              </p>
            </div>
          </footer>
          <Toaster richColors closeButton position="bottom-right" />
        </ProofCodeProvider>
      </body>
    </html>
  );
}