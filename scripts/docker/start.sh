#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/_common.sh"

cd "$REPO_ROOT"
run docker compose up --build -d "$@"
