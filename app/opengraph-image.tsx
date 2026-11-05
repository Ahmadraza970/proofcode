import { ImageResponse } from "next/og";

export const alt = "ProofCode — AI code security scanner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Designed share banner (1200×630), rendered by the app itself so link
 * previews show a real banner instead of the small app icon.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0E0A05",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              border: "6px solid #D29A26",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12.5l5 5L20 6.5"
                stroke="#F2B33D"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#FFF6E8", fontSize: 84, fontWeight: 800, letterSpacing: -1 }}>
              ProofCode
            </div>
            <div style={{ color: "#D29A26", fontSize: 27, fontWeight: 700, letterSpacing: 4 }}>
              AI CODE SECURITY SCANNER
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            color: "#EDE4CE",
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1.3,
            maxWidth: 980,
          }}
        >
          <span style={{ marginRight: 14 }}>Don&rsquo;t just trust AI-generated code.</span>
          <span style={{ color: "#F2B33D" }}>Prove it.</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid rgba(210,154,38,0.35)",
            paddingTop: 28,
          }}
        >
          <div style={{ color: "#B8AC8E", fontSize: 25 }}>
            JavaScript · TypeScript · Python · PHP · Java · C/C++ · HTML · CSS
          </div>
          <div style={{ color: "#8A7F63", fontSize: 25 }}>Made by Ahmad</div>
        </div>
      </div>
    ),
    size,
  );
}
