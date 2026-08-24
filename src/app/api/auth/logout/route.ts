import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  await deleteSession(request);
  const response = NextResponse.json({ authenticated: false });
  clearSessionCookie(response, request);
  return response;
}
