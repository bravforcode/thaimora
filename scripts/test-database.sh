#!/usr/bin/env bash
set -euo pipefail
site="$(basename "$PWD")"
container="sites-${GITHUB_RUN_ID:-local}-$site-test-pg-$RANDOM"
cleanup(){
 if [[ "$(docker inspect --format '{{index .Config.Labels "site-test-owner"}}' "$container" 2>/dev/null)" == "$site" ]]; then docker rm -f "$container" >/dev/null; fi
}
trap cleanup EXIT
image=public.ecr.aws/supabase/postgres:15.8.1.085
# ECR Public can answer "toomanyrequests" on shared runner IPs (run 40468254761); the same SHA passed on retry, so retry with backoff.
pull_image(){
 for attempt in 1 2 3 4; do
  if docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image" >/dev/null; then return 0; fi
  if ((attempt < 4)); then sleep $((attempt * 30)); fi
 done
 return 1
}
pull_image
docker run -d --name "$container" --label "site-test-owner=$site" -e POSTGRES_PASSWORD=local-test-only "$image" >/dev/null
wait_ready(){
 for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then return 0; fi
  sleep 1
 done
 return 1
}
wait_ready
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c 'create database site_test' >/dev/null
# pg_cron installs only in the database named by cron.database_name. Passing it as a postgres argument skips the image's role setup, so set it with ALTER SYSTEM and restart.
docker exec -e PGPASSWORD=local-test-only "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "alter system set cron.database_name = 'site_test'" >/dev/null
docker restart "$container" >/dev/null
wait_ready
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/local-bootstrap.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/storage-bootstrap.sql
for migration in supabase/migrations/*.sql; do docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < "$migration"; done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < tests/integration/database.sql
for test in pagination review storage trigger-acl managed-grants; do
 if [[ -f "tests/integration/$test.sql" ]]; then docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -d site_test < "tests/integration/$test.sql"; fi
done
