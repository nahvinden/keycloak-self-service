import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "kss_session";

export type AuthSession = {
  sub: string;
  username: string;
  name?: string;
  exp: number;
};

function readSessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("Missing required env var: SESSION_SECRET");
  }

  return value;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", readSessionSecret()).update(payload).digest("base64url");
}

function serializeSession(session: AuthSession): string {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function deserializeSession(value: string): AuthSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AuthSession;
    if (!parsed.sub || !parsed.username || typeof parsed.exp !== "number") {
      return null;
    }

    if (Date.now() / 1000 >= parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }

  return deserializeSession(value);
}

export function getRequestSession(request: NextRequest): AuthSession | null {
  const value = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }

  return deserializeSession(value);
}

export function setSessionCookie(response: NextResponse, session: AuthSession) {
  response.cookies.set(SESSION_COOKIE_NAME, serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
