#!/usr/bin/env bash
# Runs the acceptance checks for this repo and prints a summary:
#   npm ci, npm run typecheck, npm test, npm run test:coverage, npm run test:known-bugs, npm run build
#
# Usage:
#   scripts/verify.sh            # all checks
#   scripts/verify.sh --no-ci    # skip `npm ci` (reuse node_modules; much faster)
#   scripts/verify.sh --clean    # delete node_modules, .next and coverage first (fresh-checkout run)
#   scripts/verify.sh --mutations  # also run the mutation check (slow)
#
# `npm run build` needs NEXT_PUBLIC_API_URL and NEXT_PUBLIC_GTM_ID (see README). If they are not
# set (and there is no .env.local), placeholder values are used for this check only; the build
# output is not meant to be deployed.
set -uo pipefail
cd "$(dirname "$0")/.."

run_ci=1
clean=0
mutations=0
for arg in "$@"; do
  case "$arg" in
    --no-ci) run_ci=0 ;;
    --clean) clean=1 ;;
    --mutations) mutations=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ $clean -eq 1 ]]; then
  echo "==> removing node_modules, .next, coverage, next-env.d.ts, tsconfig.tsbuildinfo"
  rm -rf node_modules .next coverage next-env.d.ts tsconfig.tsbuildinfo
  run_ci=1
fi

build_env=()
if [[ ! -f .env.local ]]; then
  [[ -z "${NEXT_PUBLIC_API_URL:-}" ]] && build_env+=("NEXT_PUBLIC_API_URL=http://localhost:3000")
  [[ -z "${NEXT_PUBLIC_GTM_ID:-}" ]] && build_env+=("NEXT_PUBLIC_GTM_ID=GTM-PLACEHOLDER")
fi

names=()
results=()
durations=()

step() {
  local name="$1"; shift
  echo
  echo "==> $name"
  local start=$SECONDS
  "$@"
  local status=$?
  names+=("$name")
  results+=("$status")
  durations+=("$((SECONDS - start))s")
}

[[ $run_ci -eq 1 ]] && step "npm ci" npm ci
step "npm run typecheck" npm run typecheck   # fast, so it runs first
step "npm test" npm test
step "npm run test:coverage" npm run test:coverage
step "npm run test:known-bugs" npm run test:known-bugs
[[ $mutations -eq 1 ]] && step "npm run test:mutations" npm run test:mutations
step "npm run build" env NEXT_TELEMETRY_DISABLED=1 "${build_env[@]}" npm run build

echo
echo "==================== verify summary ===================="
failed=0
for i in "${!names[@]}"; do
  if [[ "${results[$i]}" -eq 0 ]]; then mark="PASS"; else mark="FAIL"; failed=1; fi
  printf '  %-4s  %-24s %6s\n' "$mark" "${names[$i]}" "${durations[$i]}"
done
[[ ${#build_env[@]} -gt 0 ]] && echo "  (build used placeholder env: ${build_env[*]})"
echo "========================================================"
exit $failed
