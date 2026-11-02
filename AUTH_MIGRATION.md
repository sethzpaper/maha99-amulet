# Verified Auth Rollout

The browser now signs in using Supabase Auth email/password and verifies users
with getUser(). Application roles come from server-managed app_metadata only.
The old admin shortcut, employee password RPC login and persisted role snapshot
are no longer supported.

## Before Applying SQL

1. Back up the database and test the migration in a staging Supabase project.
2. Create/invite the administrators in Supabase Authentication. Set their
   app_metadata.role to admin or super_admin with the trusted Admin API.
   Never place a service-role key in a VITE variable or browser code.
3. Create/invite employee Auth accounts using their existing email addresses.
   Existing employees.password_hash values do not migrate to Auth.
4. Apply supabase/migrations/202609060001_verified_auth_rls.sql after the original
   schema setup. Review employees.auth_user_id mappings and unmatched records.
5. Deploy the frontend with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
   Configure SPA fallback to index.html; public/_redirects covers Cloudflare Pages.

## Permissions

| Principal | Read | Write |
| --- | --- | --- |
| Anonymous | Public trend datasets only | None |
| Employee | Public trends and own employee profile | None |
| Admin / Super Admin | Managed application tables | Managed application tables |

This keeps the existing admin-only internal pages. Employee self-service writes
are intentionally not enabled until their workflows use Auth identity consistently.
Employee profile role is not an authorization source.

Legacy password-management RPCs are revoked, including authenticated access.
Manage invitations and password recovery in Supabase Auth during this transition.
Attendance identity is now resolved from the signed-in user's linked employee
profile; admins can also manage attendance records. The old password reset approval UI cannot change Auth
passwords and is removed from Settings.

The migration replaces policies on the listed tables only. Audit any additional
deployed tables, RPCs, views and storage policies before production rollout.
Do not rerun legacy SQL scripts that recreate permissive policies.

## Verification Before Production

Run supabase/tests/verified_auth_rls.sql on staging after applying the migration.
It tests anonymous denial, forged user metadata, cross-employee reads and admin
CRUD inside a transaction that rolls back its fixtures. This SQL test was not
executed against a live database in this workspace.

- Anonymous writes to employees, videos and time_entries must fail.
- A normal Auth user cannot read another employee or modify internal records.
- Setting user_metadata.role to admin must not grant privileges.
- An admin can perform CRUD on the internal tables.
- All legacy password RPCs must reject anon and authenticated callers.
- Reload a protected URL with expired/revoked credentials: access must be denied.

Database enforcement only takes effect after the SQL is applied. No live database
credentials were configured in the workspace when this change was prepared.

## Local Validation

TypeScript, production build and five authentication regression tests passed.
Playwright covered desktop/mobile navigation, refresh/back, forged local auth
storage and protected routes. Run npm test, npm run lint and npm run build.
The production bundle still triggers Vite's large-chunk warning.
The dependency install reported six audit findings (one low, five high); these
require a separate dependency audit before production deployment.
