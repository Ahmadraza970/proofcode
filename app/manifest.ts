import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProofCode",
    short_name: "ProofCode",
    description:
      "Analyze, fix, test, and verify your software with an AI-powered code verification workflow.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf7",
    theme_color: "#bd871c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
