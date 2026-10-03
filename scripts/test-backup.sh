#!/usr/bin/env bash
# Actual PG17 synthetic encrypted recovery; no hosted credentials or published ports.
set -euo pipefail
umask 077
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
site="$(basename "$project_root")"
[[ "$site" == thaimora || "$site" == taotide ]] || exit 1
run_id="$(openssl rand -hex 10)"
network="sites-backup-test-$run_id"
source_container="sites-backup-fixture-$run_id"
identity_file="$(mktemp)"
image="postgis/postgis:17-3.5@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6"
source_image="$image"
if [[ "${1:-}" == --source-pg15 ]]; then source_image=public.ecr.aws/supabase/postgres:15.8.1.085;
elif [[ -n "${1:-}" ]]; then echo 'Unknown synthetic drill option';exit 1;fi
cleanup() {
 if [[ "$(docker inspect --format '{{ index .Config.Labels "io.sites.backup.fixture" }}' "$source_container" 2>/dev/null)" == "$network" ]]; then docker rm -fv "$source_container" >/dev/null; fi
 if [[ "$(docker network inspect --format '{{ index .Labels "io.sites.backup.synthetic" }}' "$network" 2>/dev/null)" == true ]]; then docker network rm "$network" >/dev/null; fi
 rm -f "$identity_file"
}
trap cleanup EXIT
docker network create --label io.sites.backup.synthetic=true "$network" >/dev/null
docker run -d --name "$source_container" --network "$network" --label "io.sites.backup.fixture=$network" -e POSTGRES_PASSWORD=synthetic-local-only "$source_image" >/dev/null
ready=false
for attempt in $(seq 1 90); do
 if docker exec "$source_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[[ "$ready" == true ]] || { echo 'Synthetic source was not ready'; exit 1; }
if [[ "$source_image" == "$image" ]]; then
docker exec -i "$source_container" psql -X -q -U postgres -v ON_ERROR_STOP=1 -c 'DROP EXTENSION postgis_tiger_geocoder CASCADE; DROP EXTENSION postgis_topology CASCADE; DROP EXTENSION postgis CASCADE;'
for sql_file in tests/integration/local-bootstrap.sql tests/integration/storage-bootstrap.sql supabase/migrations/*.sql; do
 [[ ! -f "$sql_file" ]] || docker exec -i "$source_container" psql -X -q -U postgres -v ON_ERROR_STOP=1 < "$sql_file"
done
fi
age-keygen > "$identity_file" 2>/dev/null
export DATABASE_URL="postgresql://postgres:synthetic-local-only@$source_container:5432/postgres"
export AGE_RECIPIENT="$(age-keygen -y "$identity_file")"
export AGE_IDENTITY_FILE="$identity_file"
export PG_BACKUP_IMAGE="$image"
export BACKUP_DOCKER_NETWORK="$network"
if [[ "${1:-}" == --source-pg15 ]]; then
  before=$(docker exec "$source_container" psql -X -At -U postgres -c "select md5(string_agg(nspname,',' order by nspname)) from pg_namespace")
  if result=$(bash scripts/backup-db.sh 2>&1); then echo 'PG15 source was incorrectly accepted';exit 1;fi
  [[ "$result" == *'Source/client major mismatch: no dump or restore reset performed'* ]] || { echo 'Wrong mismatch failure';exit 1; }
  after=$(docker exec "$source_container" psql -X -At -U postgres -c "select md5(string_agg(nspname,',' order by nspname)) from pg_namespace")
  [[ "$before" == "$after" ]] || { echo 'Source schema changed';exit 1; }
  printf 'PASS: %s actual PG17 client rejects PG15 source before dump/restore, source schemas unchanged\n' "$site"
else
  bash scripts/backup-db.sh
printf 'PASS: %s actual PG17 encrypted synthetic recovery and restored SQL/RLS checks\n' "$site"
fi
