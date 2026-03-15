import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

export async function POST(request: Request) {
  const redirectTarget = new URL("/", request.url);
  const response = NextResponse.redirect(redirectTarget);
  clearSessionCookie(response);
  return response;
}
