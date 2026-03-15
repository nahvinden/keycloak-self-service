import { NextResponse } from "next/server";
import { buildAuthorizeUrl, createAuthState, setAuthStateCookie } from "@/lib/keycloak-auth";

export async function GET() {
  try {
    const state = createAuthState();
    const authorizeUrl = buildAuthorizeUrl(state);
    const response = NextResponse.redirect(authorizeUrl);
    setAuthStateCookie(response, state);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
