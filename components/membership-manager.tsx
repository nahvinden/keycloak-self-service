"use client";

import { useMemo, useState } from "react";

type RoleMembership = {
  id: string;
  name: string;
  description?: string;
  assigned: boolean;
};

type MembershipResponse = {
  username: string;
  userId: string;
  roles: RoleMembership[];
};

type MembershipManagerProps = {
  username: string;
  initialRoles: RoleMembership[];
};

function getDisplayDescription(description?: string): string | null {
  if (!description) {
    return null;
  }

  const trimmed = description.trim();
  if (!trimmed) {
    return null;
  }

  // Keycloak can return i18n placeholder keys like `${role_default-roles}`.
  if (/^\$\{[^}]+\}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function MembershipManager({ username, initialRoles }: MembershipManagerProps) {
  const [roles, setRoles] = useState<RoleMembership[]>(initialRoles);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    initialRoles.filter((role) => role.assigned).map((role) => role.id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    const initiallyAssignedIds = new Set(
      roles.filter((role) => role.assigned).map((role) => role.id),
    );

    if (selectedRoleIds.length !== initiallyAssignedIds.size) {
      return true;
    }

    return selectedRoleIds.some((id) => !initiallyAssignedIds.has(id));
  }, [roles, selectedRoleIds]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }

  async function saveMemberships() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/memberships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          desiredRoleIds: selectedRoleIds,
        }),
      });

      const payload = (await response.json()) as MembershipResponse | { error: string };
      if (!response.ok) {
        const message = "error" in payload ? payload.error : "Failed to save memberships";
        throw new Error(message);
      }

      const data = payload as MembershipResponse;
      setRoles(data.roles);
      setSelectedRoleIds(data.roles.filter((role) => role.assigned).map((role) => role.id));
      setSuccess("Role memberships updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memberships");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Signed in as: {username}</h2>
        <button
          type="button"
          onClick={saveMemberships}
          disabled={saving || !hasUnsavedChanges}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      ) : null}

      {roles.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          No realm roles found in this realm.
        </p>
      ) : (
        <ul className="grid gap-2">
          {roles.map((role) => {
            const displayDescription = getDisplayDescription(role.description);
            return (
              <li key={role.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{role.name}</span>
                    {displayDescription ? (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {displayDescription}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
