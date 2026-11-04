import type { Metadata } from "next";
import {
  BrainCircuit,
  Cookie,
  Database,
  FileSearch,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = {
  title: "Privacy & Cookies",
  description:
    "What ProofCode stores, what it sends to an AI provider, and how deletion works.",
};

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="size-5 text-brand" aria-hidden="true" />
          {title}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Privacy & Cookies"
        description="Plain facts about what ProofCode does with the code you submit."
      />

      <div className="flex flex-col gap-4">
        <Section icon={FileSearch} title="What you submit">
          <p>
            You submit code in one of two ways: by uploading a ZIP archive of
            your project, or by giving ProofCode the URL of a public GitHub
            repository, which it clones. The code is copied into a temporary
            workspace on our server, where the analysis runs.
          </p>
          <p>
            Please do not upload secrets — API keys, passwords, or production
            credentials should never be part of a submission.
          </p>
        </Section>

        <Section icon={Database} title="What is stored">
          <p>
            Analysis results are stored in a Supabase database: the project
            name and source, file counts, the issues found (file, line,
            severity, explanation), quality scores, health scores, test
            results, and verification history snapshots. Your project&rsquo;s
            source files (text files only) are also stored with the project,
            so analysis, fixes, and verification keep working reliably over
            time — and they are deleted when you delete the project.
          </p>
        </Section>

        <Section icon={UserRound} title="Sign-in">
          <p>
            ProofCode uses Google sign-in, handled by Supabase Auth. When you
            sign in, Google shares your name and email address with us; the
            email identifies your account, and your projects are visible only
            to you. The workspace owner&rsquo;s account can see every project.
            We never see or store your Google password.
          </p>
        </Section>

        <Section icon={BrainCircuit} title="AI providers">
          <p>
            Your code is sent to an AI provider only when you request an
            AI-generated fix for an issue. In that case the relevant code is
            sent to Google Gemini, or to OpenRouter if Gemini is not
            configured, so the provider can propose the fix. The deterministic
            scanner and the built-in patches run entirely on our server and
            send nothing anywhere.
          </p>
          <p>
            If you add your own Gemini key in Settings, AI fixes run on your
            key instead of the server&rsquo;s. Your key is stored only in your
            browser, is sent only with your fix requests so the request can be
            made, and is never stored on our server.
          </p>
        </Section>

        <Section icon={Trash2} title="Deletion">
          <p>
            Deleting a project deletes its stored data — the project record,
            its issues, scores, and history — together with its stored file
            copies and its workspace copy from the server. There is no
            separate archive copy kept behind.
          </p>
        </Section>

        <Section icon={Cookie} title="Cookies and tracking">
          <p>
            ProofCode sets no advertising, analytics, or tracking cookies, and
            your data is never sold. The site uses only functional browser
            storage: your theme preference and your Google sign-in session
            kept in your browser so the interface can call the API on your
            behalf —
            plus, only if you choose to add one, your own AI key, which also
            never leaves your browser except with your fix requests.
          </p>
          <p>
            ProofCode is built by Ahmad Raza — Ahmad Digital Studio (
            <a
              href="https://ahmadrazaa.me"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              ahmadrazaa.me
            </a>
            ).
          </p>
        </Section>
      </div>
    </div>
  );
}
