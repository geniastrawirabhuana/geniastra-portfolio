# Supabase setup for Geniastra

This guide distinguishes local checks from operations against a hosted Supabase project. No hosted project, migration, administrator, or import is created by this repository.

## 1. Create the Supabase project

In the owner's Supabase account, choose **New project**, select the organization, set a project name and a strong database password, and select a region. Store the database password in the owner's password manager; it is not an application environment variable.

For initial testing, use a separate development or staging project. Do not use production for the first migration, import, or integration tests.

## 2. Find the project URL and Publishable Key

Open the project dashboard and select **Connect** to view the project URL and Publishable Key. They are also available under **Project Settings > API Keys**. The URL looks like `https://<project-ref>.supabase.co`; the Publishable Key normally begins with `sb_publishable_`. Supabase currently recommends Publishable and Secret keys; do not copy the legacy `service_role` key into the app. See the [official API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).

## 3. Configure local environment variables

`.env.local` is ignored by Git. Keep any existing local values and add these three entries without committing the file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Fill in the URL and Publishable Key from the project dashboard. Leave `SUPABASE_SECRET_KEY` empty for normal local app use. Only fill it in temporarily in a trusted local shell for the approved import operation. A Secret Key bypasses RLS and must never be prefixed with `NEXT_PUBLIC_`, put in browser code, or added to Vercel's normal runtime environment. Restart `pnpm dev` after changing the file.

## 4. Disable public signup and create the administrator

Before allowing the app to accept logins, open **Authentication > Settings** and turn off **Allow new users to sign up**. Supabase will then allow existing users to sign in while blocking new public registrations; see [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

Create the owner's account with **Authentication > Users > Invite user**. The app has no registration screen or signup API. Do not grant admin access through user metadata.

## 5. Apply the migration to the intended project

Confirm the dashboard shows the development/staging project. Open **SQL Editor**, create a query, paste the contents of `migrations/202611110001_initial_portfolio_cms.sql`, review the project ref, then run it once. This is a hosted database operation. The migration creates the tables, functions, RLS policies, indexes, and `portfolio-media` bucket. The repo currently contains one migration, so it is the first and only migration to apply.

After the migration succeeds, open **Authentication > Users**, copy the invited administrator's user UUID, and run this statement in SQL Editor after replacing the placeholder:

```sql
insert into public.admin_users (user_id)
values ('AUTH_USER_UUID');
```

Run this as a trusted project owner. The application cannot insert or update `admin_users`.

## 6. Verify schema and Storage

In **Table Editor**, verify that `admin_users`, `projects`, `project_translations`, `project_media`, `experiences`, `experience_translations`, `education`, `site_content`, and `site_settings` exist. In each table's policies view, confirm RLS is enabled and policies are present. Confirm the admin UUID is in `admin_users` and `is_active` is true.

In **Storage**, verify a `portfolio-media` bucket exists, is public, has a 10 MB file-size limit, and allows only JPEG, PNG, WebP, and AVIF. The migration creates these settings for a new bucket and deliberately leaves an existing bucket unchanged; if a bucket with that name already exists, review and correct its settings before continuing. Public bucket URLs can be read by anyone who knows the URL, even for draft assets. Keep only portfolio-safe images in this bucket; upload, update, and delete operations still require an approved admin under Storage RLS.

## 7. Run local checks

These checks do not need Supabase credentials and do not make remote requests:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The test command runs local unit tests. Supabase integration tests are reported as skipped when their test environment variables are absent; a skipped test is not a remote pass.

## 8. Run remote integration tests on a test project

Only after applying the migration to a dedicated development/staging project, set these variables temporarily in the shell running the tests:

```text
SUPABASE_TEST_URL
SUPABASE_TEST_PUBLISHABLE_KEY
SUPABASE_TEST_ADMIN_EMAIL
SUPABASE_TEST_ADMIN_PASSWORD
SUPABASE_TEST_NONADMIN_EMAIL
SUPABASE_TEST_NONADMIN_PASSWORD
```

The last four variables are needed for the admin and non-admin checks; create a normal non-admin test account through the dashboard while keeping public signup disabled. Then run:

```sh
pnpm test
```

These tests query the remote database and attempt anonymous/non-admin writes to confirm RLS denies them. Run them only against the dedicated test project, never production. Do not print or commit the variable values. The current integration suite does not cover every upload size/MIME case or all admin CRUD flows; those still need separate verification before production use.

## 9. Review and run the initial import

First run the local dry-run. It reads the repository sources, reports counts and errors, and exits before creating a Supabase client or writing remotely:

```sh
pnpm supabase:import
```

Review the report and resolve any duplicate slugs or source-image errors. It imports built-in projects, `content/managed-projects.json`, `content/site-content.json` when present, local project images, and the ABX Guard assets. Current local sources include the ABX Guard cover and two gallery images.

Only after reviewing the dry-run and explicitly approving the hosted import, add `SUPABASE_SECRET_KEY` to the trusted local shell and run:

```sh
pnpm supabase:import -- --apply
```

The import uses stable project/media IDs and storage paths and upserts by stable keys, so retries do not intentionally create duplicate records. It preflights duplicate source slugs and images; failed uploads stop database writes. Because Storage and Postgres writes are separate hosted requests, a partial storage upload can leave an unreferenced object; rerunning the import is safe and reuses its stable path. New rows remain drafts until all import stages succeed; existing project publication status is preserved if an import fails.

Do not delete or edit source JSON/images until database rows and image assets have been checked in the dashboard and on the public site. The importer does not delete old remote records or storage objects.

## 10. Production configuration

After staging verification, configure only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the appropriate Vercel environments when deployment is approved. Do not add `SUPABASE_SECRET_KEY` to normal Vercel runtime variables. Apply reviewed SQL migrations and import content to the intended production project only as separate, explicitly approved operations.
