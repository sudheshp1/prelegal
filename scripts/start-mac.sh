#!/usr/bin/env bash
# Builds the Prelegal image and starts it at http://localhost:8000.
# The database lives inside the container, so every start begins with a fresh one.
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t prelegal .
if [ -n "$(docker ps -aq --filter 'name=^prelegal$')" ]; then docker rm -f prelegal >/dev/null; fi

env_args=()
if [ -f .env ]; then env_args=(--env-file .env); fi
docker run -d --name prelegal -p 8000:8000 ${env_args[@]+"${env_args[@]}"} prelegal >/dev/null

echo "Prelegal is running at http://localhost:8000"
