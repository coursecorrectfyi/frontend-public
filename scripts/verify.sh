#!/usr/bin/env bash
# Runs the acceptance checks for this repo and prints a summary:
#   npm ci, npm run typecheck, npm run test:coverage, npm run test:known-bugs, npm run build, secret leak check
# (test:coverage runs the whole suite and fails if any test fails, so plain `npm test` would only repeat it.)
#
# Usage (npm run verify -- <options> calls it through bash, so the file does not need the executable bit):
#   bash scripts/verify.sh              # all checks
#   bash scripts/verify.sh --no-ci      # skip `npm ci` (reuse node_modules; much faster)
#   bash scripts/verify.sh --clean      # delete node_modules, .next and coverage first (fresh-checkout run)
#   bash scripts/verify.sh --mutations  # also run the mutation check (slow)
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
step "npm run test:coverage" npm run test:coverage
step "npm run test:known-bugs" npm run test:known-bugs
[[ $mutations -eq 1 ]] && step "npm run test:mutations" npm run test:mutations
# The build runs with a random API_RELAY_SECRET (it overrides any value in .env.local); the leak check then fails if
# that value appears anywhere in .next/. Server-only secrets must never end up in a build artefact.
relay_canary="relay-canary-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
# ${arr[@]+"${arr[@]}"}: an empty array is "unbound" under `set -u` in bash < 4.4 (macOS ships bash 3.2).
step "npm run build" env NEXT_TELEMETRY_DISABLED=1 API_RELAY_SECRET="$relay_canary" ${build_env[@]+"${build_env[@]}"} npm run build
if [[ "${results[${#results[@]}-1]}" -eq 0 ]]; then
  step "secret leak check" node scripts/check-build-secrets.mjs "$relay_canary"
else
  echo "==> secret leak check skipped: the build failed, so .next/ is stale or partial"
fi

echo
echo "==================== verify summary ===================="
failed=0
for i in "${!names[@]}"; do
  if [[ "${results[$i]}" -eq 0 ]]; then mark="PASS"; else mark="FAIL"; failed=1; fi
  printf '  %-4s  %-24s %6s\n' "$mark" "${names[$i]}" "${durations[$i]}"
done
[[ -n "${build_env[*]+set}" ]] && echo "  (build used placeholder env: ${build_env[*]})"
echo "========================================================"
exit $failed
