#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Missing DATABASE_URL}"
: "${AGE_RECIPIENT:?Missing public AGE_RECIPIENT}"
: "${AGE_IDENTITY_FILE:?Missing private AGE_IDENTITY_FILE for restore verification}"
: "${RESTORE_DATABASE_URL:?Missing disposable RESTORE_DATABASE_URL}"
[[ "${RESTORE_TARGET_CONFIRMED:-}" == "disposable" ]] || { echo "Disposable restore target must be confirmed"; exit 1; }
[[ "$DATABASE_URL" != "$RESTORE_DATABASE_URL" ]] || { echo "Restore target must differ from source"; exit 1; }
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v psql >/dev/null
command -v age >/dev/null
source_identity=$(psql "$DATABASE_URL" -Atqc "select current_database() || ':' || coalesce(inet_server_addr()::text,'local') || ':' || coalesce(inet_server_port()::text,'5432')")
restore_identity=$(psql "$RESTORE_DATABASE_URL" -Atqc "select current_database() || ':' || coalesce(inet_server_addr()::text,'local') || ':' || coalesce(inet_server_port()::text,'5432')")
[[ "$source_identity" != "$restore_identity" ]] || { echo "Restore server/database identity matches source"; exit 1; }
mkdir -p scripts/output/backups
backup_file="scripts/output/backups/db-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
pg_dump --format=custom --no-owner --schema=public --schema=extensions --schema=auth "$DATABASE_URL" | age -r "$AGE_RECIPIENT" -o "$backup_file"
actual_bytes=$(wc -c < "$backup_file")
(( actual_bytes <= 31457280 )) || { echo "Encrypted backup exceeds 30 MiB daily budget"; exit 1; }
age -d -i "$AGE_IDENTITY_FILE" "$backup_file" | pg_restore --list >/dev/null
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS extensions CASCADE;" >/dev/null
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA extensions; CREATE EXTENSION postgis WITH SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;" >/dev/null
restore_list=$(mktemp)
trap 'rm -f "$restore_list"' EXIT
age -d -i "$AGE_IDENTITY_FILE" "$backup_file" | pg_restore --list | awk '!/ SCHEMA - extensions / && !/ EXTENSION - (postgis|pgcrypto) / && !/ COMMENT - EXTENSION (postgis|pgcrypto) / && !/ TABLE DATA extensions spatial_ref_sys /' > "$restore_list"
age -d -i "$AGE_IDENTITY_FILE" "$backup_file" | pg_restore --exit-on-error --no-owner --use-list="$restore_list" --dbname="$RESTORE_DATABASE_URL"
printf 'Verified encrypted logical dump and restore: %s bytes; image objects excluded\n' "$actual_bytes"
