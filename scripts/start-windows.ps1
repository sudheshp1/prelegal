# Builds the Prelegal image and starts it at http://localhost:8000.
# The database lives inside the container, so every start begins with a fresh one.
# Docker reports progress on stderr, so failures are detected via $LASTEXITCODE
# rather than $ErrorActionPreference = "Stop".
$root = Split-Path -Parent $PSScriptRoot

docker build -t prelegal $root
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (docker ps -aq --filter "name=^prelegal$") {
    docker rm -f prelegal | Out-Null
}

$envArgs = @()
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) { $envArgs = @("--env-file", $envFile) }
docker run -d --name prelegal -p 8000:8000 @envArgs prelegal | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Prelegal is running at http://localhost:8000"
