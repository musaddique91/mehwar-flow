-- Row-Level Security: defense-in-depth tenant isolation.
--
-- The API/worker connect as `mehwar_app` (not owner, not superuser). Every tenant query runs in a
-- transaction that first sets `app.current_org_id` (see packages/db/src/tenant.ts). Rows of other
-- organizations are invisible and cannot be written, even if application code forgets a WHERE.
-- Trusted system paths (sign-up, background workers) set `app.bypass_rls = 'on'` explicitly.

CREATE OR REPLACE FUNCTION app_rls_allows(org uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on'
      OR org = nullif(current_setting('app.current_org_id', true), '')::uuid
$$;

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "organizations"
  USING (app_rls_allows("id")) WITH CHECK (app_rls_allows("id"));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['channels', 'channel_credentials', 'media_assets', 'posts', 'post_targets', 'audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (app_rls_allows(organization_id)) WITH CHECK (app_rls_allows(organization_id))',
      t);
  END LOOP;
END
$$;

-- post_media has no organization column; it inherits visibility from its post.
ALTER TABLE "post_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "post_media"
  USING (EXISTS (SELECT 1 FROM "posts" p WHERE p.id = post_id))
  WITH CHECK (EXISTS (SELECT 1 FROM "posts" p WHERE p.id = post_id));

-- Runtime role privileges (the role is created by docker/postgres/init.sql).
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mehwar_app') THEN
    GRANT USAGE ON SCHEMA public TO mehwar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mehwar_app;
    REVOKE ALL ON "_prisma_migrations" FROM mehwar_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mehwar_app;
  END IF;
END
$$;
