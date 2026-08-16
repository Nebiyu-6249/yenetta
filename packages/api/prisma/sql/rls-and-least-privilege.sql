-- ============================================================================
-- Yenetta - Row-Level Security (RLS) and least-privilege application role.
--
-- Purpose (defense in depth for OWASP LLM08 tenant isolation and IDOR):
--   1. A restricted `yenetta_app` LOGIN role that can run only DML
--      (SELECT/INSERT/UPDATE/DELETE). It cannot run DDL, cannot create
--      roles, and is not a superuser, so an SQL-injection or app-layer
--      compromise cannot drop tables, exfiltrate other schemas, or escalate.
--   2. Row-Level Security on every user-scoped table, keyed on the
--      `app.user_id` session GUC. With FORCE ROW LEVEL SECURITY, even a
--      table owner is constrained; the restricted role sees only rows that
--      belong to the user id set for the current session. If the app forgets
--      to set the GUC, `current_setting('app.user_id', true)` returns NULL
--      and the predicate matches no rows -- the policies fail closed.
--
-- This script is IDEMPOTENT: safe to run repeatedly. It is a deployment
-- artifact, applied by a superuser/owner (the migration role), NOT part of
-- Prisma's migration history, because it manages a separate login role and
-- privileges that Prisma does not model.
--
-- Enablement path (see docs/SECURITY.md section 6):
--   psql "$DATABASE_URL" -v app_password="'strong-secret'" \
--     -f packages/api/prisma/sql/rls-and-least-privilege.sql
--   then point the running app's DATABASE_URL user at `yenetta_app` and have
--   every request wrap its work in a transaction that runs
--     SELECT set_config('app.user_id', $userId, true);
--   before touching user-scoped tables.
--
-- NOTE: The owner/migration role (e.g. `yenetta`) remains a superuser so
--   migrations and RLS management keep working; superusers bypass RLS by
--   design. Isolation is enforced against the non-superuser `yenetta_app`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Restricted application login role (DML only).
-- ----------------------------------------------------------------------------
-- Password is supplied at apply time via `-v app_password="'...'"`. When the
-- variable is absent we fall back to a placeholder so the script still parses
-- for review; rotate it before any real use.
\if :{?app_password}
\else
  \set app_password '''change-me-app-password'''
\endif

-- Create the role if absent, otherwise reset its password. A CASE-selected
-- verb keeps the `:app_password` substitution outside any dollar-quoted body
-- (psql does not interpolate variables inside $$ ... $$).
SELECT CASE
         WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yenetta_app')
         THEN 'ALTER' ELSE 'CREATE'
       END AS role_verb \gset
:role_verb ROLE yenetta_app LOGIN PASSWORD :app_password;

-- Ensure the restricted role can never do more than DML.
ALTER ROLE yenetta_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;

-- Schema and object privileges: usage on the schema, DML on current tables,
-- and read/advance on sequences (needed for INSERT into serial columns).
GRANT USAGE ON SCHEMA public TO yenetta_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yenetta_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yenetta_app;

-- Same grants automatically apply to objects created later by the owner.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yenetta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO yenetta_app;

-- Explicitly deny DDL surface the default grants would not cover.
REVOKE CREATE ON SCHEMA public FROM yenetta_app;

-- ----------------------------------------------------------------------------
-- 2. Row-Level Security on user-scoped tables.
-- ----------------------------------------------------------------------------
-- Tables that carry a direct `userId` column. Each gets a single policy that
-- constrains every command to rows owned by the session's app.user_id.
DO $$
DECLARE
  t text;
  user_tables text[] := ARRAY[
    'chat_conversations',
    'learning_profiles',
    'mock_attempts',
    'payments',
    'quiz_attempts',
    'refresh_tokens',
    'sr_cards',
    'study_plans',
    'subscriptions',
    'usage_events',
    'user_progress',
    'user_stats',
    'weak_areas'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_user_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      || 'USING ("userId" = current_setting(''app.user_id'', true)) '
      || 'WITH CHECK ("userId" = current_setting(''app.user_id'', true))',
      t || '_user_isolation', t
    );
  END LOOP;
END
$$;

-- chat_messages has no userId; it belongs to a user through its conversation.
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_messages_user_isolation ON chat_messages;
CREATE POLICY chat_messages_user_isolation ON chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages."conversationId"
        AND c."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages."conversationId"
        AND c."userId" = current_setting('app.user_id', true)
    )
  );
