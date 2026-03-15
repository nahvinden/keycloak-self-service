import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth-session";
import {
  findUserByUsername,
  getUserRealmRoleMemberships,
  replaceUserRealmRoles,
} from "@/lib/keycloak-admin";

type RoleMembershipResponse = {
  username: string;
  userId: string;
  roles: {
    id: string;
    name: string;
    description?: string;
    assigned: boolean;
  }[];
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unexpected server error";
}

export async function GET(request: NextRequest) {
  const session = getRequestSession(request);
  if (!session) {
    return unauthorized();
  }

  try {
    const username = session.username;
    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: `User '${username}' not found` }, { status: 404 });
    }

    const roles = await getUserRealmRoleMemberships(user.id);
    const payload: RoleMembershipResponse = {
      username: user.username,
      userId: user.id,
      roles,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: unknownErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = getRequestSession(request);
  if (!session) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as {
      desiredRoleIds?: string[];
    };

    const username = session.username;

    if (!Array.isArray(body.desiredRoleIds)) {
      return badRequest("desiredRoleIds must be an array");
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: `User '${username}' not found` }, { status: 404 });
    }

    const desiredRoleIds = body.desiredRoleIds.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    await replaceUserRealmRoles(user.id, desiredRoleIds);
    const roles = await getUserRealmRoleMemberships(user.id);

    const payload: RoleMembershipResponse = {
      username: user.username,
      userId: user.id,
      roles,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: unknownErrorMessage(error) }, { status: 500 });
  }
}
