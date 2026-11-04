import { NextResponse } from "next/server";
import { getApiToken } from "@/lib/api/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const token = await getApiToken();
  return NextResponse.json({
    token,
    tip: "Attach it to write endpoints as `Authorization: Bearer <token>` or `x-api-key: <token>`. Store it in .env.local or a secret manager — never commit it.",
  });
}

export async function POST(): Promise<Response> {
  const token = await getApiToken();
  return NextResponse.json(
    { token, recreated: false, message: "A single token already exists for this app. GET returns the same one." },
    { status: 200 },
  );
}