import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    email: user.email,
  });
}
