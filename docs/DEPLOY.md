# Deploy Guide: Supabase + Clerk + Vercel

Ship educaplus to production. Follow the steps in order — each section
depends on the previous one being complete.

---

> **SECURITY RELEASE-BLOCKER CHECKLIST (RLS-PROD-01)**
>
> Before you go live, confirm ALL of the following:
>
> - [ ] `DATABASE_URL` connects as `app_user` (NOT `postgres` or any superuser)
> - [ ] `DIRECT_DATABASE_URL` also connects as `app_user` (NOT superuser)
> - [ ] `pnpm db:rls` was run after `pnpm db:migrate`
> - [ ] `FORCE ROW LEVEL SECURITY` is confirmed on all RLS tables
>
> Connecting as a superuser silently bypasses RLS even with `FORCE ROW LEVEL
> SECURITY` set, leaking course data across academies. This is NOT caught by
> tests because the test harness already uses the restricted `app_user` role.

---

## 1. Prerequisites

| What you need | Why |
|---------------|-----|
| GitHub repo pushed | Vercel imports from GitHub |
| [Supabase](https://supabase.com) account | Postgres host |
| [Clerk](https://clerk.com) account | Authentication + org management |
| [Vercel](https://vercel.com) account | Hosting + serverless functions |

---

## 2. Supabase: Create Project and Restricted Role

### 2.1 Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Choose a region close to your users.
3. Save the **database password** securely — you will need it below.

### 2.2 Get connection strings

1. Inside your project → **Connect** button (top right toolbar).
2. Select the **"Connection string"** tab.
3. Copy two strings:

| Type | Port | Where to find it | Env var |
|------|------|-------------------|---------|
| Transaction pooler | **6543** | "Transaction" mode | `DATABASE_URL` |
| Direct | **5432** | "Direct connection" | `DIRECT_DATABASE_URL` |

**Transaction pooler format (DATABASE_URL):**
```
postgresql://app_user.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

**Direct connection format (DIRECT_DATABASE_URL):**
```
postgresql://app_user:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

> **Gotcha — username format differs by connection type:**
> - Transaction pooler: username is `app_user.YOUR_PROJECT_REF` (project-ref suffix required)
> - Direct connection: username is `app_user` (no suffix)
>
> **Gotcha — percent-encode special characters in the password:**
> `@` → `%40`, `#` → `%23`, `%` → `%25`, `space` → `%20`

### 2.3 Create the restricted `app_user` role

Open **SQL Editor** in your Supabase project and run:

```sql
-- Replace 'STRONG_RANDOM' with a unique, high-entropy password.
-- Store it in a password manager — you need it for the connection strings above.
CREATE ROLE app_user WITH LOGIN PASSWORD 'STRONG_RANDOM'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

> **Why not `postgres`/superuser?**
> Superusers bypass `FORCE ROW LEVEL SECURITY` silently. Even with correct
> RLS policies in place, a superuser connection returns ALL rows across ALL
> academies. `app_user` is constrained by `NOBYPASSRLS` — it cannot opt out.

---

## 3. Run Migrations

Do this from your local machine with both `DATABASE_URL` and
`DIRECT_DATABASE_URL` set in `.env.local`.

```bash
# 1. Generate (migrations already exist — skip if no schema changes)
pnpm db:generate

# 2. Apply Drizzle schema migrations (tables, policies, indexes)
#    drizzle.config.ts reads DIRECT_DATABASE_URL automatically
pnpm db:migrate

# 3. Apply manual RLS hardening (FORCE RLS + grants)
#    Must run AFTER db:migrate so tables exist, and AFTER app_user is created
pnpm db:rls
```

> **Why is `db:rls` separate from `db:migrate`?**
> `drizzle-kit migrate` handles schema DDL (CREATE TABLE, CREATE POLICY, etc.)
> but intentionally does NOT emit:
> - `FORCE ROW LEVEL SECURITY` — subjects the table owner to RLS (the
>   footgun guard that prevents superuser bypass)
> - `CREATE ROLE` / `GRANT` — role lifecycle is outside schema management
>
> `pnpm db:rls` applies `drizzle/0001_rls.sql` and `drizzle/0002_course_rls.sql`
> which contain these statements. It is idempotent: the role creation is
> guarded by `IF NOT EXISTS` and the `GRANT`/`FORCE` statements are safe to
> re-run.
>
> **Ordering matters:** `app_user` role must exist before `db:rls` (which
> grants privileges to it). The role is created inside `0001_rls.sql`, so
> running `db:migrate` first and then `db:rls` is the correct order.

---

## 4. Clerk: Create Production Instance

### 4.1 Create and configure

1. [Clerk Dashboard](https://dashboard.clerk.com) → **Create application**.
2. Choose **Production** environment.
3. Enable **Organizations** (your Settings → Organizations).

### 4.2 Get API keys

From **API Keys** in your application:

| Env var | Value | Notes |
|---------|-------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Build-time; safe to expose to browser |
| `CLERK_SECRET_KEY` | `sk_live_...` | Server-side only; never expose publicly |

### 4.3 Configure the webhook

1. Clerk Dashboard → **Webhooks** → **Add Endpoint**.
2. URL: `https://YOUR_VERCEL_DOMAIN/api/webhooks/clerk`
   (you will update this to the real domain after the first Vercel deploy)
3. Subscribe to these events:
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
4. After creating the endpoint, open it → copy **Signing Secret** (`whsec_...`).

| Env var | Value |
|---------|-------|
| `CLERK_WEBHOOK_SECRET` | `whsec_YOUR_SIGNING_SECRET` |

---

## 5. Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables**.

| Variable | Value source | Vercel scope | Notes |
|----------|-------------|--------------|-------|
| `DATABASE_URL` | Supabase Connect → Transaction pooler (6543) | Production | **MUST be `app_user`, not superuser** |
| `DIRECT_DATABASE_URL` | Supabase Connect → Direct (5432) | Production | Migrations only; optional at runtime |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys | Production + Preview | Build-time; baked into the JS bundle |
| `CLERK_SECRET_KEY` | Clerk → API Keys | Production | Server-side only |
| `CLERK_WEBHOOK_SECRET` | Clerk → Webhooks → Signing Secret | Production | Starts with `whsec_` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard | Production | |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → API Tokens | Production | |
| `ANTHROPIC_API_KEY` | Anthropic Console | Production | |
| `VOYAGE_API_KEY` | Voyage AI Dashboard | Production | |
| `SUPABASE_URL` | Supabase → Project Settings → API | *(optional)* | Future Storage use only |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → API → anon key | *(optional)* | Future Storage use only |
| `SUPABASE_SECRET_KEY` | Supabase → API → service_role key | *(optional)* | Future Storage; server-side only |

> **NEXT_PUBLIC_ variables are build-time and client-exposed.**
> Never put secrets (keys, tokens, passwords) in a `NEXT_PUBLIC_` variable.
> The publishable key is intentionally public — it identifies your Clerk
> application to the browser SDK.

> **CRITICAL (RLS-PROD-01):** `DATABASE_URL` and `DIRECT_DATABASE_URL` MUST
> use the `app_user` role created in step 2.3, NOT `postgres` or any other
> superuser/owner account. Connecting as owner silently bypasses all RLS
> policies and leaks data across academies despite all tests passing green.

---

## 6. Vercel Deploy

### 6.1 Import the repository

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select your GitHub repo.
2. Framework: **Next.js** (auto-detected).
3. **Build command**: leave blank — Vercel reads `package.json` `build` script
   which already includes `--webpack` (required for Serwist PWA compatibility).
4. Set all environment variables from the table above.
5. Deploy.

### 6.2 After first deploy

1. Note your Vercel domain (e.g. `educaplus.vercel.app`).
2. Go back to Clerk → **Webhooks** → edit your endpoint.
3. Update the URL to `https://educaplus.vercel.app/api/webhooks/clerk`.

### 6.3 Wildcard subdomains (optional — for per-academy subdomains)

Per-academy subdomains (e.g. `myacademy.educaplus.com`) require Vercel to
manage your DNS (Vercel nameservers). This is an advanced step — skip for
initial launch and revisit when routing per-tenant subdomains is needed.

---

## 7. Post-Deploy Smoke Check

Run through this sequence to confirm the full stack is wired:

- [ ] Sign up at your Vercel URL.
- [ ] Create an **Organization** (academy) in Clerk.
- [ ] Confirm a row appears in `academies` in Supabase → Table Editor.
  (The Clerk webhook fires `organization.created` → ProvisionAcademy use-case
   inserts the row. If missing, check the webhook delivery log in Clerk.)
- [ ] Create a course inside the academy.
- [ ] Sign in as a second user in a different organization → confirm they
  cannot see the first academy's courses (RLS isolation check).

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `academies` row missing after org creation | Webhook URL wrong or not updated after deploy | Update Clerk webhook URL; re-trigger `organization.created` |
| RLS check: user sees other academy's data | `DATABASE_URL` uses superuser | Switch to `app_user` connection string |
| `prepare: false` error in logs | Wrong pooler port or URL | Ensure `DATABASE_URL` uses port 6543 (transaction pooler) |
| Drizzle migration fails | Using transaction pooler for migrations | Set `DIRECT_DATABASE_URL` to port 5432 direct connection |
| Build fails: missing env | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` not set in Vercel | Add it to Production scope in Vercel settings |
