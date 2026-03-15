import { MembershipManager } from "@/components/membership-manager";
import { getServerSession } from "@/lib/auth-session";
import { findUserByUsername, getUserRealmRoleMemberships } from "@/lib/keycloak-admin";

type PageProps = {
  searchParams: Promise<{
    authError?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getServerSession();
  const authError = params.authError;
  let loadError: string | null = null;
  let initialRoles: Awaited<ReturnType<typeof getUserRealmRoleMemberships>> = [];

  if (session) {
    try {
      const user = await findUserByUsername(session.username);
      if (!user) {
        loadError = `Authenticated user '${session.username}' was not found in Keycloak.`;
      } else {
        initialRoles = await getUserRealmRoleMemberships(user.id);
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Failed to load memberships";
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Role Membership Self-Service
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Sign in and manage your role memberships.
          </p>
        </header>

        {authError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            Authentication failed: {authError}
          </div>
        ) : null}

        {!session ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <a
              href="/api/auth/login"
              className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Sign in with Keycloak
            </a>
          </section>
        ) : loadError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Logged in as <strong>{session.username}</strong>
                </p>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </section>
            <MembershipManager username={session.username} initialRoles={initialRoles} />
          </>
        )}
      </div>
    </main>
  );
}
