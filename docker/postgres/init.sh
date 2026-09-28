#!/bin/sh
# Runs once when the Postgres volume is first initialized (as the POSTGRES_USER superuser).
# Creates the unprivileged runtime role used by the API and worker. It does not own the tables and
# is not a superuser, so Row-Level Security policies apply to it.
set -eu
psql -v ON_ERROR_STOP=1 -v app_password="$POSTGRES_APP_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE mehwar_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mehwar_app') \gexec
GRANT CONNECT ON DATABASE mehwar TO mehwar_app;
GRANT USAGE ON SCHEMA public TO mehwar_app;
SQL
