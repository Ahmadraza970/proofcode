import { NextResponse } from "next/server";
import { getApiToken } from "@/lib/api/db";
import { jsonError } from "@/lib/api/auth";
import {
  clientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const limit = rateLimit(`keys:${clientIp(request)}`, 10);
  if (!limit.ok) return rateLimitedResponse(limit);

  try {
    const token = await getApiToken();
    return NextResponse.json({
      token,
      tip: "Attach it to write endpoints as `Authorization: Bearer <token>` or `x-api-key: <token>`. Store it in .env.local or a secret manager — never commit it.",
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
