#!/usr/bin/env bash
set -euo pipefail
site="$(basename "$PWD")"
container="sites-${GITHUB_RUN_ID:-local}-$site-test-pg-$RANDOM"
cleanup(){
 if [[ "$(docker inspect --format '{{index .Config.Labels "site-test-owner"}}' "$container" 2>/dev/null)" == "$site" ]]; then docker rm -f "$container" >/dev/null; fi
}
trap cleanup EXIT
docker run -d --name "$container" --label "site-test-owner=$site" -e POSTGRES_PASSWORD=local-test-only public.ecr.aws/supabase/postgres:15.8.1.085 >/dev/null
for attempt in $(seq 1 60); do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c 'create database site_test' >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/local-bootstrap.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/storage-bootstrap.sql
for migration in supabase/migrations/*.sql; do docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < "$migration"; done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/database.sql
for test in pagination review storage trigger-acl managed-grants; do
 if [[ -f "tests/integration/$test.sql" ]]; then docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < "tests/integration/$test.sql"; fi
done
