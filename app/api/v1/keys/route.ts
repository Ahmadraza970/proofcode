import { NextResponse } from "next/server";
import { getApiToken, isOwnerTokenConfigured, verifyToken } from "@/lib/api/db";
import { jsonError } from "@/lib/api/auth";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

function presentedToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, "").trim();
  return request.headers.get("x-api-key");
}

/**
 * Issuance gate. With no server-configured owner token this is an open dev
 * deployment and the token is handed out as before. Once
 * `PROOFCODE_OWNER_TOKEN` is set, handing the token to anonymous callers
 * would void authentication entirely — so only a caller who already presents
 * the valid token may read it back.
 */
async function issuanceDenied(request: Request): Promise<Response | null> {
  if (!isOwnerTokenConfigured()) return null;
  if (await verifyToken(presentedToken(request))) return null;
  return jsonError(
    "This deployment's API token is set on the server (PROOFCODE_OWNER_TOKEN) and is not issued here. Present that token to use the API.",
    401,
  );
}

export async function GET(request: Request): Promise<Response> {
  const limit = rateLimit(`keys:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  const denied = await issuanceDenied(request);
  if (denied) return denied;

  try {
    const token = await getApiToken();
    return NextResponse.json({
      token,
      tip: "Attach it to API requests as `Authorization: Bearer <token>` or `x-api-key: <token>`. Store it in .env.local or a secret manager — never commit it.",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not issue the API token",
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const limit = rateLimit(`keys:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  const denied = await issuanceDenied(request);
  if (denied) return denied;

  try {
    const token = await getApiToken();
    return NextResponse.json(
      { token, recreated: false, message: "A single token already exists for this app. GET returns the same one." },
      { status: 200 },
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not issue the API token",
      500,
    );
  }
}
