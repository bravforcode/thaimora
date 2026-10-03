#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?Missing DATABASE_URL}"
: "${AGE_RECIPIENT:?Missing public AGE_RECIPIENT}"
: "${AGE_IDENTITY_FILE:?Missing private AGE_IDENTITY_FILE for restore verification}"
[[ -z "${RESTORE_DATABASE_URL:-}" ]] || { echo 'External restore targets are forbidden'; exit 1; }
[[ -r "$AGE_IDENTITY_FILE" ]] || { echo 'Restore identity file is unreadable'; exit 1; }
PG_BACKUP_IMAGE="${PG_BACKUP_IMAGE:-postgis/postgis:17-3.5}"
[[ "$PG_BACKUP_IMAGE" =~ ^postgis/postgis:17-3\.5(@sha256:[a-f0-9]{64})?$ ]] || { echo 'Use the verified PostgreSQL17/PostGIS image'; exit 1; }
for command_name in docker age openssl awk; do command -v "$command_name" >/dev/null; done
network_args=()
if [[ -n "${BACKUP_DOCKER_NETWORK:-}" ]]; then
  [[ "$BACKUP_DOCKER_NETWORK" =~ ^[a-zA-Z0-9_.-]{1,128}$ ]] || { echo 'Invalid local Docker network'; exit 1; }
  network_args=(--network "$BACKUP_DOCKER_NETWORK")
  [[ "$DATABASE_URL" =~ ^postgres(ql)?://postgres:synthetic-local-only@([a-z0-9-]+):5432/postgres$ ]] || { echo 'Docker network override is restricted to synthetic fixtures'; exit 1; }
  source_container="${BASH_REMATCH[2]}"
  [[ "$(docker network inspect --format '{{ index .Labels "io.sites.backup.synthetic" }}' "$BACKUP_DOCKER_NETWORK")" == true ]] || { echo 'Synthetic network label required'; exit 1; }
  [[ "$(docker inspect --format '{{ index .Config.Labels "io.sites.backup.fixture" }}' "$source_container")" == "$BACKUP_DOCKER_NETWORK" ]] || { echo 'Owned synthetic source label required'; exit 1; }
fi
source_psql() {
  docker run --rm "${network_args[@]}" --env PGCONNECT_TIMEOUT=15 "$PG_BACKUP_IMAGE" psql --dbname="$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 "$@"
}
client_major=$(docker run --rm "$PG_BACKUP_IMAGE" pg_dump --version | awk '{split($3,v,".");print v[1]}')
source_version=$(source_psql -c 'show server_version_num')
[[ "$source_version" =~ ^[0-9]+$ ]] || { echo 'Could not verify source PostgreSQL version'; exit 1; }
source_major=$((source_version / 10000))
[[ "$client_major" == 17 && "$source_major" == "$client_major" ]] || { echo 'Source/client major mismatch: no dump or restore reset performed'; exit 1; }
# Require TLS for real sources; only an explicitly isolated synthetic Docker network may omit it.
if [[ -z "${BACKUP_DOCKER_NETWORK:-}" ]]; then
  [[ "$(source_psql -c 'select ssl from pg_stat_ssl where pid=pg_backend_pid()')" == t ]] || { echo 'Source database TLS required'; exit 1; }
fi
dump_schemas=(--schema=public --schema=extensions --schema=auth)
if [[ "$(source_psql -c "select exists(select 1 from pg_namespace where nspname='private')")" == t ]]; then dump_schemas+=(--schema=private); fi
source_identity=$(source_psql -c "select current_database() || ':' || coalesce(inet_server_addr()::text,'local') || ':' || coalesce(inet_server_port()::text,'5432')")
owner_token="backup-$(openssl rand -hex 12)"
restore_container="$owner_token"
restore_list=$(mktemp)
partial_file=''
owned_restore() {
  [[ "$(docker inspect --format '{{ index .Config.Labels "io.sites.backup.owner" }}' "$restore_container" 2>/dev/null)" == "$owner_token" ]]
}
cleanup() {
  rm -f "$restore_list"
  [[ -z "$partial_file" ]] || rm -f "$partial_file"
  if owned_restore; then docker rm -fv "$restore_container" >/dev/null; fi
}
trap cleanup EXIT
POSTGRES_PASSWORD=$(openssl rand -hex 24)
export POSTGRES_PASSWORD
docker run -d --name "$restore_container" --label "io.sites.backup.owner=$owner_token" "${network_args[@]}" --env POSTGRES_PASSWORD "$PG_BACKUP_IMAGE" >/dev/null
unset POSTGRES_PASSWORD
ready=false
for attempt in $(seq 1 90); do
  if docker exec "$restore_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Owned restore target did not become TCP-ready'; exit 1; }
restore_psql() { docker exec -i "$restore_container" psql -X -U postgres -At -v ON_ERROR_STOP=1 "$@"; }
restore_version=$(restore_psql -c 'show server_version_num')
[[ "$restore_version" =~ ^[0-9]+$ ]] || { echo 'Could not verify restore version'; exit 1; }
[[ "$((restore_version / 10000))" == "$source_major" ]] || { echo 'Restore/source major mismatch: no dump or restore reset performed'; exit 1; }
restore_identity=$(restore_psql -c "select current_database() || ':' || coalesce(inet_server_addr()::text,'local') || ':' || coalesce(inet_server_port()::text,'5432')")
[[ "$source_identity" != "$restore_identity" ]] || { echo 'Restore identity matches source'; exit 1; }
mkdir -p scripts/output/backups
backup_file="scripts/output/backups/db-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
partial_file="$backup_file.partial"
docker run --rm "${network_args[@]}" --env PGCONNECT_TIMEOUT=15 "$PG_BACKUP_IMAGE" pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner "${dump_schemas[@]}" | age -r "$AGE_RECIPIENT" -o "$partial_file"
actual_bytes=$(wc -c < "$partial_file")
(( actual_bytes <= 31457280 )) || { echo 'Encrypted backup exceeds 30 MiB daily budget'; exit 1; }
age -d -i "$AGE_IDENTITY_FILE" "$partial_file" | docker exec -i "$restore_container" pg_restore --list | awk '!/ SCHEMA - extensions / && !/ EXTENSION - (postgis|pgcrypto) / && !/ COMMENT - EXTENSION (postgis|pgcrypto) / && !/ TABLE DATA extensions spatial_ref_sys /' > "$restore_list"
owned_restore || { echo 'Restore ownership label changed; reset forbidden'; exit 1; }
# These NOLOGIN names resolve ACLs; global-role credentials and memberships are excluded.
source_psql -c "select format('DO \$role\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN CREATE ROLE %I NOLOGIN %s; END IF; END \$role\$;',rolname,rolname,case when rolbypassrls then 'BYPASSRLS' else '' end) from pg_roles where rolname !~ '^pg_' and rolname <> 'postgres' order by rolname" | restore_psql >/dev/null
owned_restore || { echo 'Restore ownership label changed; reset forbidden'; exit 1; }
restore_psql -c 'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS extensions CASCADE; DROP SCHEMA IF EXISTS private CASCADE;' >/dev/null
restore_psql -c 'CREATE SCHEMA extensions; CREATE EXTENSION postgis WITH SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;' >/dev/null
docker cp "$restore_list" "$restore_container:/tmp/backup-restore.list"
age -d -i "$AGE_IDENTITY_FILE" "$partial_file" | docker exec -i "$restore_container" pg_restore --exit-on-error --no-owner --use-list=/tmp/backup-restore.list --dbname=postgres --username=postgres
if [[ -n "${BACKUP_DOCKER_NETWORK:-}" ]]; then
  test_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../tests/integration" && pwd)"
  for sql_test in database.sql pagination.sql review.sql recovery.sql managed-grants.sql; do
    [[ ! -f "$test_root/$sql_test" ]] || restore_psql < "$test_root/$sql_test"
  done
fi
mv "$partial_file" "$backup_file"
partial_file=''
printf 'Verified encrypted logical archive restore: PostgreSQL %s, %s bytes; hosted Auth/Storage operation excluded\n' "$source_major" "$actual_bytes"
