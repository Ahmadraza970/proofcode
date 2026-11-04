import { verifyToken } from "./db";
import type { NextRequest } from "next/server";

function extractToken(request: NextRequest | Request): string | null {
  const header = request.headers.get("authorization");
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return request.headers.get("x-api-key");
}

/** Rejects requests without a valid API token. Applies to reads and writes. */
export async function requireAuth(
  request: NextRequest | Request,
): Promise<{ token: string } | Response> {
  const token = extractToken(request);
  if (!token || !(await verifyToken(token))) {
    const message =
      "Missing or invalid API token. Send it as `Authorization: Bearer <token>` or `x-api-key: <token>` on this request.";
    return new Response(JSON.stringify({ error: "unauthorized", message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { token };
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}