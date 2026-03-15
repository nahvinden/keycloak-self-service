# Keycloak Role Membership Self-Service

Simple web app where users sign in with Keycloak and manage **their own realm role memberships**.

## What it does

- Requires login against your Keycloak realm (OIDC Authorization Code flow)
- Loads the authenticated user's own role memberships
- Lets users add/remove their own realm-role memberships and save changes
- Uses Keycloak Admin REST API from server-side routes

## Setup

1. Copy `.env.example` to `.env.local`
2. Fill in your Keycloak details
3. Run the app

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

## Docker

Build the image:

```bash
docker build -t keycloak-self-service .
```

Run the container with your local env file:

```bash
docker run --rm -p 3001:3001 --env-file .env.local keycloak-self-service
```

Then open [http://localhost:3001](http://localhost:3001).

If you change the external port or host, make sure `APP_BASE_URL` in `.env.local` matches the URL you use in the browser.

### Docker Compose

Start with Compose:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```



```markdown
The container listens on `0.0.0.0:3001`, and maps to `http://localhost:3001`.

If Keycloak is running on your host machine at `http://localhost:8080`, use
`http://host.docker.internal:8080` for `KEYCLOAK_BASE_URL` when running in Docker.
```



## Environment Variables

```env
KEYCLOAK_BASE_URL=https://your-keycloak.example.com
KEYCLOAK_REALM=your-realm
KEYCLOAK_ADMIN_CLIENT_ID=your-admin-client-id
KEYCLOAK_ADMIN_CLIENT_SECRET=your-admin-client-secret
KEYCLOAK_APP_CLIENT_ID=your-app-client-id
KEYCLOAK_APP_CLIENT_SECRET=your-app-client-secret
APP_BASE_URL=http://localhost:3001
SESSION_SECRET=replace-with-a-long-random-string
```

### Required Keycloak permissions

The admin client (`KEYCLOAK_ADMIN_CLIENT_ID`) needs permissions to:

- view-users
- manage-users

Authentication flows:

- Direct access grants
- Service account roles

The app login client (`KEYCLOAK_APP_CLIENT_ID`) must:

- be a confidential client
- allow standard authorization code flow
- include `APP_BASE_URL/api/auth/callback` in valid redirect URIs

