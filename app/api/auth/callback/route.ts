import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth-session";
import {
  clearAuthStateCookie,
  exchangeCodeForUserIdentity,
  readAuthStateCookie,
} from "@/lib/keycloak-auth";

function redirectWithError(message: string): NextResponse {
  const url = new URL("/", process.env.APP_BASE_URL ?? "http://localhost:");
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const storedState = readAuthStateCookie(request);

  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    const response = redirectWithError("Invalid authentication state");
    clearAuthStateCookie(response);
    return response;
  }

  try {
    const identity = await exchangeCodeForUserIdentity(code);
    const response = NextResponse.redirect(new URL("/", request.url));

    setSessionCookie(response, {
      sub: identity.sub,
      username: identity.preferred_username,
      name: identity.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    });

    clearAuthStateCookie(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    const response = redirectWithError(message);
    clearAuthStateCookie(response);
    return response;
  }
}
