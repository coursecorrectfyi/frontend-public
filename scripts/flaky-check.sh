#!/usr/bin/env bash
# Runs one test file many times, several at once, and reports how often it failed and which tests failed.
# Parallel runs load the machine the way the full suite or the coverage run does: some flaky tests only show then.
#
#   bash scripts/flaky-check.sh src/api/chat.test.ts            # 24 runs, 6 at a time
#   bash scripts/flaky-check.sh src/api/chat.test.ts 48 8       # 48 runs, 8 at a time
#   bash scripts/flaky-check.sh src/api/chat.test.ts 24 6 -t "abort|done"   # extra vitest args (e.g. a name filter)
set -uo pipefail
cd "$(dirname "$0")/.."

file="${1:?usage: bash scripts/flaky-check.sh <test file> [runs=24] [parallel=6] [vitest args...]}"
runs="${2:-24}"
parallel="${3:-6}"
shift $(( $# < 3 ? $# : 3 ))

logs="$(mktemp -d)"
export file logs
seq 1 "$runs" | xargs -P "$parallel" -I{} bash -c 'npx vitest run "$file" "$@" > "$logs/{}.log" 2>&1' _ "$@"

failed=$(grep -l "Tests .*failed\|Test Files .*failed" "$logs"/*.log 2>/dev/null | wc -l | tr -d ' ')
echo "failing runs: $failed / $runs  (logs: $logs)"
# shellcheck disable=SC2046
sed 's/\x1b\[[0-9;]*m//g' "$logs"/*.log | grep -E '^ FAIL ' | sort | uniq -c | sort -rn
[[ "$failed" -eq 0 ]]
