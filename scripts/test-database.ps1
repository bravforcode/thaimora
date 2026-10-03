# Actual SQL checks against a labeled disposable local container.
$ErrorActionPreference = 'Stop'
$taskProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskSite = Split-Path $taskProjectRoot -Leaf
if ($taskSite -notin @('thaimora','taotide')) { throw 'Unexpected project root' }
$taskRunId = [guid]::NewGuid().ToString('N')
$taskContainer = "sites-review-$taskSite-$($taskRunId.Substring(0,8))"
function Run-SqlFile([string]$taskSqlPath) {
  $taskSqlText = Get-Content -LiteralPath $taskSqlPath -Raw -Encoding utf8
  $taskSqlText | docker exec -i $taskContainer psql -q -U postgres -v ON_ERROR_STOP=1 -d site_test
  if ($LASTEXITCODE -ne 0) { throw "SQL failed: $taskSqlPath" }
}
try {
  docker run -d --name $taskContainer --label "sites.review-run=$taskRunId" -e POSTGRES_PASSWORD=local-review-only public.ecr.aws/supabase/postgres:15.8.1.085
  if ($LASTEXITCODE -ne 0) { throw 'Test container creation failed' }
  $taskReady = $false
  for ($taskAttempt=0; $taskAttempt -lt 60; $taskAttempt++) {
    # The image briefly starts a Unix-socket-only server during initialization.
    # Waiting for TCP avoids running migrations against that temporary server.
    docker exec $taskContainer pg_isready -h 127.0.0.1 -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $taskReady=$true; break }
    Start-Sleep -Seconds 1
  }
  if (!$taskReady) { throw 'Local test database did not start' }
  docker exec $taskContainer psql -q -U postgres -v ON_ERROR_STOP=1 -c 'create database site_test'
  if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
  Run-SqlFile (Join-Path $taskProjectRoot 'tests/integration/local-bootstrap.sql')
  Get-ChildItem -LiteralPath (Join-Path $taskProjectRoot 'supabase/migrations') -Filter '*.sql' |
    Sort-Object Name | ForEach-Object { Run-SqlFile $_.FullName }
  foreach ($taskTestFile in @('database.sql','pagination.sql','review.sql')) {
    $taskSqlPath=Join-Path $taskProjectRoot "tests/integration/$taskTestFile"
    if (Test-Path -LiteralPath $taskSqlPath) { Run-SqlFile $taskSqlPath }
  }
  Write-Output "PASS: $taskSite actual migrations, RLS and review regression SQL"
} finally {
  $taskInspection = docker inspect $taskContainer 2>$null | ConvertFrom-Json
  if ($taskInspection -and $taskInspection[0].Config.Labels.'sites.review-run' -eq $taskRunId) {
    docker rm -f $taskContainer
  } elseif ($taskInspection) {
    throw 'Container identity did not match; cleanup stopped'
  }
}
