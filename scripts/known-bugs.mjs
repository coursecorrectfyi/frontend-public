#!/usr/bin/env node
/**
 * Verifies the known-bug tests (`it.fails('KNOWN BUG (Bxx): ...')`).
 *
 * `it.fails` passes whenever the test throws, for any reason. This script runs those tests as normal tests
 * (vitest.known-bugs.config.mts) and checks each one:
 *   - fails with an assertion error  → OK: the bug is still there and the test detects it
 *   - passes                         → the bug looks FIXED: change it.fails to it and update docs/testing.md
 *   - fails with any other error     → the TEST is broken (it would hide the bug): fix the test
 *   - leaves a harness problem       → HARNESS: it makes an unhandled request or logs unexpectedly: fix the test
 * It also checks that the registry table in docs/testing.md lists exactly the IDs that have known-bug tests.
 * Exit code 1 if anything is not OK.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const out = join(mkdtempSync(join(tmpdir(), 'known-bugs-')), 'report.json')
spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vitest.known-bugs.config.mts', '--reporter=json', `--outputFile=${out}`],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)

const report = JSON.parse(readFileSync(out, 'utf8'))
const rows = []
for (const file of report.testResults) {
  for (const t of file.assertionResults) {
    if (!t.title.includes('KNOWN BUG') || t.status === 'skipped' || t.status === 'pending') continue
    // eslint-disable-next-line no-control-regex -- strip ANSI colours (jest-dom matchers colour their messages)
    const message = (t.failureMessages?.[0] ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]
    const isAssertion = /^(AssertionError|Error: expect)|expected .* to |toHaveBeenCalled|Expected/.test(message)
    // A harness violation (unhandled request, unexpected console output) anywhere in the failures means the test
    // also does something it should not, even if its assertion detects the bug.
    const harness = (t.failureMessages ?? []).some(m => m.includes('Test left problems behind'))
    const state = t.status === 'passed' ? 'FIXED?' : harness ? 'HARNESS' : isAssertion ? 'OK' : 'BROKEN TEST'
    rows.push({ state, id: t.title.match(/KNOWN BUG \(([^)]+)\)/)?.[1] ?? '?', file: relative(process.cwd(), file.name), title: t.title, message })
  }
}

rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
for (const r of rows) {
  console.log(`${r.state.padEnd(11)} ${r.id.padEnd(5)} ${r.file}\n            ${r.title}\n            ↳ ${r.message || '(passed)'}`)
}
const bad = rows.filter(r => r.state !== 'OK')
console.log(`\n${rows.length} known-bug tests: ${rows.length - bad.length} OK, ${bad.length} need attention`)

// The registry in docs/testing.md must list exactly the IDs that have known-bug tests.
const docs = readFileSync('docs/testing.md', 'utf8')
const registry = docs.slice(docs.indexOf('## Known bugs'), docs.indexOf('## Coverage'))
const documented = new Set([...registry.matchAll(/^\| ([A-Z]\d+) \|/gm)].map(m => m[1]))
const tested = new Set(rows.map(r => r.id))
const undocumented = [...tested].filter(id => !documented.has(id))
const stale = [...documented].filter(id => !tested.has(id))
if (undocumented.length) console.log(`Missing from the registry in docs/testing.md: ${undocumented.join(', ')}`)
if (stale.length) console.log(`In docs/testing.md but no KNOWN BUG test left (fixed? remove the row): ${stale.join(', ')}`)

process.exit(bad.length > 0 || undocumented.length > 0 || stale.length > 0 ? 1 : 0)
