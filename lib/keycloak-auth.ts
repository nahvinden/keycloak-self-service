import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_STATE_COOKIE = "kss_auth_state";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getConfig() {
  return {
    baseUrl: readEnv("KEYCLOAK_BASE_URL").replace(/\/$/, ""),
    realm: readEnv("KEYCLOAK_REALM"),
    appClientId: readEnv("KEYCLOAK_APP_CLIENT_ID"),
    appClientSecret: readEnv("KEYCLOAK_APP_CLIENT_SECRET"),
    appBaseUrl: readEnv("APP_BASE_URL").replace(/\/$/, ""),
  };
}

export type KeycloakIdentity = {
  sub: string;
  preferred_username: string;
  name?: string;
};

export function setAuthStateCookie(response: NextResponse, value: string) {
  response.cookies.set(AUTH_STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export function clearAuthStateCookie(response: NextResponse) {
  response.cookies.set(AUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readAuthStateCookie(request: NextRequest): string | null {
  return request.cookies.get(AUTH_STATE_COOKIE)?.value ?? null;
}

export function createAuthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function buildAuthorizeUrl(state: string): string {
  const { baseUrl, realm, appClientId, appBaseUrl } = getConfig();
  const redirectUri = `${appBaseUrl}/api/auth/callback`;

  const query = new URLSearchParams({
    client_id: appClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
  });

  return `${baseUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/auth?${query.toString()}`;
}

export async function exchangeCodeForUserIdentity(code: string): Promise<KeycloakIdentity> {
  const { baseUrl, realm, appClientId, appClientSecret, appBaseUrl } = getConfig();
  const tokenUrl = `${baseUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;
  const redirectUri = `${appBaseUrl}/api/auth/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: appClientId,
    client_secret: appClientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const message = await tokenResponse.text();
    throw new Error(`Failed to exchange code for token (${tokenResponse.status}): ${message}`);
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error("Keycloak token response is missing access_token");
  }

  const userInfoUrl = `${baseUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/userinfo`;
  const userInfoResponse = await fetch(userInfoUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    cache: "no-store",
  });

  if (!userInfoResponse.ok) {
    const message = await userInfoResponse.text();
    throw new Error(`Failed to fetch user profile (${userInfoResponse.status}): ${message}`);
  }

  const identity = (await userInfoResponse.json()) as KeycloakIdentity;
  if (!identity.sub || !identity.preferred_username) {
    throw new Error("Keycloak userinfo response is missing required identity fields");
  }

  return identity;
}
