#!/usr/bin/env bash

set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
example_root="$repository_root/examples/chapter04-ecommerce"
project_id="chapter04-ecommerce"
function_pid=""
start_attempted=0
log_dir="$repository_root/.codex-local/tmp/chapter04-smoke"

supabase() {
  mise exec node@24 -- npx --no-install supabase --workdir "$example_root" "$@"
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [[ -n "$function_pid" ]] && kill -0 "$function_pid" 2>/dev/null; then
    kill "$function_pid" 2>/dev/null || true
    wait "$function_pid" 2>/dev/null || true
  fi
  if [[ "$start_attempted" -eq 1 ]]; then
    supabase stop --project-id "$project_id" --no-backup || true
  fi
  exit "$exit_code"
}

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "SKIP: Docker-compatible runtime is unavailable; Chapter 4 local-stack smoke was not run."
  exit 0
fi

if [[ -n "$(docker ps -aq --filter "label=com.supabase.cli.project=$project_id")" ]]; then
  echo "SKIP: containers already exist for $project_id; ownership is unknown, so they were not modified."
  exit 0
fi

if command -v ss >/dev/null 2>&1 && ss -H -ltn | awk '{print $4}' | grep -Eq ':(54320|54321|54322|8083)$'; then
  echo "SKIP: one or more Chapter 4 local-stack ports are already in use."
  exit 0
fi

mkdir -p "$log_dir"
trap cleanup EXIT INT TERM
start_attempted=1

supabase start
supabase db reset
supabase functions serve process-order >"$log_dir/functions.log" 2>&1 &
function_pid=$!

response_file="$log_dir/response.json"
for _ in $(seq 1 30); do
  if curl --silent --show-error --fail-with-body \
    --request POST \
    --header 'Content-Type: application/json' \
    --data '{"items":[{"product_id":1,"quantity":2}]}' \
    --output "$response_file" \
    http://127.0.0.1:54321/functions/v1/process-order; then
    break
  fi
  sleep 1
done

python3 - "$response_file" <<'PY'
import json
import sys

with open(sys.argv[1]) as response_file:
    response = json.load(response_file)

assert response["status"] == "validated", response
assert response["total_amount_yen"] == 1160, response
assert response["items"][0]["unit_price_yen"] == 580, response
assert response["persistence"] == "not_performed", response
PY

echo "PASS: Chapter 4 local-stack start/reset/serve/request smoke completed."
