type RequiredEnvVar =
  | "KEYCLOAK_BASE_URL"
  | "KEYCLOAK_REALM"
  | "KEYCLOAK_ADMIN_CLIENT_ID"
  | "KEYCLOAK_ADMIN_CLIENT_SECRET";

function readEnv(name: RequiredEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export type UserRoleMembership = {
  id: string;
  name: string;
  description?: string;
  assigned: boolean;
};

type KeycloakRole = {
  id: string;
  name: string;
  description?: string;
};

type KeycloakUser = {
  id: string;
  username: string;
};

function getConfig() {
  return {
    baseUrl: readEnv("KEYCLOAK_BASE_URL").replace(/\/$/, ""),
    realm: readEnv("KEYCLOAK_REALM"),
    clientId: readEnv("KEYCLOAK_ADMIN_CLIENT_ID"),
    clientSecret: readEnv("KEYCLOAK_ADMIN_CLIENT_SECRET"),
  };
}

async function getAdminAccessToken(): Promise<string> {
  const { baseUrl, realm, clientId, clientSecret } = getConfig();
  const tokenUrl = `${baseUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to get Keycloak token (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Keycloak token response is missing access_token");
  }

  return payload.access_token;
}

async function keycloakAdminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { baseUrl, realm } = getConfig();
  const accessToken = await getAdminAccessToken();
  const url = `${baseUrl}/admin/realms/${encodeURIComponent(realm)}${path}`;

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Keycloak admin request failed (${response.status} ${path}): ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function findUserByUsername(username: string): Promise<KeycloakUser | null> {
  const trimmed = username.trim();
  if (!trimmed) {
    return null;
  }

  const users = await keycloakAdminRequest<KeycloakUser[]>(
    `/users?username=${encodeURIComponent(trimmed)}&exact=true`,
  );

  return users[0] ?? null;
}

export async function getUserRealmRoleMemberships(
  userId: string,
): Promise<UserRoleMembership[]> {
  const [allRoles, assignedRoles] = await Promise.all([
    keycloakAdminRequest<KeycloakRole[]>("/roles"),
    keycloakAdminRequest<KeycloakRole[]>(
      `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
    ),
  ]);

  const assignedIds = new Set(assignedRoles.map((role) => role.id));

  return allRoles
    .map((role) => ({
      ...role,
      assigned: assignedIds.has(role.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceUserRealmRoles(
  userId: string,
  desiredRoleIds: string[],
): Promise<void> {
  const memberships = await getUserRealmRoleMemberships(userId);

  const desiredRoleIdSet = new Set(desiredRoleIds);
  const currentlyAssigned = memberships.filter((role) => role.assigned);
  const currentlyAssignedById = new Map(currentlyAssigned.map((role) => [role.id, role]));

  const toAdd = memberships.filter(
    (role) => desiredRoleIdSet.has(role.id) && !currentlyAssignedById.has(role.id),
  );

  const toRemove = currentlyAssigned.filter((role) => !desiredRoleIdSet.has(role.id));
  const toRoleRepresentation = (role: UserRoleMembership): KeycloakRole => ({
    id: role.id,
    name: role.name,
    description: role.description,
  });

  if (toAdd.length > 0) {
    await keycloakAdminRequest<void>(`/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
      method: "POST",
      body: JSON.stringify(toAdd.map(toRoleRepresentation)),
    });
  }

  if (toRemove.length > 0) {
    await keycloakAdminRequest<void>(`/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
      method: "DELETE",
      body: JSON.stringify(toRemove.map(toRoleRepresentation)),
    });
  }
}
