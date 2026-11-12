#!/bin/sh
# Runs once, when the Postgres volume is first created (docker-entrypoint-initdb.d).
# Schema changes for an existing database need a migration; see AGENTS.md.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
	-v auth_password="$AUTHENTICATOR_PASSWORD" <<'SQL'
create schema api;

-- One JSON document per key. The app stores everything under key 'wheels'.
create table api.app_state (
	key text primary key check (key ~ '^[a-z0-9-]{1,64}$'),
	data jsonb not null check (pg_column_size(data) < 2000000),
	updated_at timestamptz not null default now()
);

create function api.touch_updated_at() returns trigger language plpgsql as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

create trigger app_state_touch before update on api.app_state
	for each row execute function api.touch_updated_at();

-- Requests without a JWT run as web_anon. It can read and upsert rows but not delete them.
create role web_anon nologin;
grant usage on schema api to web_anon;
grant select, insert, update on api.app_state to web_anon;
revoke execute on function api.touch_updated_at() from public;

-- PostgREST logs in as authenticator and switches to web_anon per request.
create role authenticator noinherit login password :'auth_password';
grant web_anon to authenticator;
SQL
