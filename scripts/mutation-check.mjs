#!/usr/bin/env node
/**
 * Mutation check: proves the tests notice when the code they cover breaks.
 *
 * Each entry in scripts/mutations.mjs makes ONE deliberate, realistic break in app code (e.g. "stop sending the
 * session header"), runs the tests that should catch it, and restores the file. Results:
 *   KILLED    the tests failed → good, the behaviour is protected
 *   SURVIVED  the tests still passed → a gap: add or strengthen a test (or, rarely, the mutation is harmless)
 *
 * Usage:
 *   npm run test:mutations                 # all mutations
 *   npm run test:mutations -- chat         # only mutations whose id contains "chat"
 *   npm run test:mutations -- chat/ saved/ # ...or any of several substrings
 *
 * Safety: the original file is restored after every mutation and on Ctrl+C / SIGTERM / SIGHUP. Before a file is
 * mutated, its original content is also written to .mutation-backup.json; if the process is killed hard
 * (SIGKILL, power loss), the next run restores it first and says so.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import mutations from './mutations.mjs'

const BACKUP = '.mutation-backup.json'

// 0. Recover from a previous run that was killed while a file was mutated.
if (existsSync(BACKUP)) {
  const { file, content } = JSON.parse(readFileSync(BACKUP, 'utf8'))
  writeFileSync(file, content)
  rmSync(BACKUP)
  console.warn(`Restored ${file} from ${BACKUP} (a previous mutation run was interrupted).`)
}

const filters = process.argv.slice(2)
const selected = filters.length ? mutations.filter(m => filters.some(f => m.id.includes(f))) : mutations
if (selected.length === 0) {
  console.error(`No mutation id contains any of: ${filters.join(', ')}`)
  process.exit(2)
}

let mutated = null // { file, content } while a file is mutated
let child = null

function restore() {
  if (!mutated) return
  writeFileSync(mutated.file, mutated.content)
  rmSync(BACKUP, { force: true })
  mutated = null
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    child?.kill('SIGTERM')
    restore()
    console.error(`\nInterrupted (${signal}); files restored.`)
    process.exit(130)
  })
}

function runTests(tests) {
  return new Promise(resolve => {
    child = spawn('npx', ['vitest', 'run', '--bail=1', ...tests], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', d => (output += d))
    child.stderr.on('data', d => (output += d))
    child.on('close', code => {
      child = null
      resolve({ status: code, output })
    })
  })
}

// A mutation is either { find, replace } or { edits: [{ find, replace }, ...] } (all in the same file), for
// behaviour guarded in more than one place (e.g. a limit checked twice: removing one check changes nothing).
const editsOf = m => m.edits ?? [{ find: m.find, replace: m.replace }]

// 1. Every edit must still apply exactly once (the code may have changed since it was written).
const invalid = selected.filter(m => {
  const code = readFileSync(m.file, 'utf8')
  const bad = editsOf(m).filter(e => code.split(e.find).length - 1 !== 1)
  for (const e of bad) console.error(`INVALID  ${m.id}: "find" occurs ${code.split(e.find).length - 1} times in ${m.file}: ${e.find.slice(0, 60)}`)
  return bad.length > 0
})
if (invalid.length) process.exit(2)

// 2. The tests must pass before anything is mutated.
const allTests = [...new Set(selected.flatMap(m => m.tests))]
const baseline = await runTests(allTests)
if (baseline.status !== 0) {
  console.error('Baseline failed: the tests must pass before mutating.\n' + baseline.output.slice(-3000))
  process.exit(2)
}

// 3. Apply each mutation, run its tests, restore.
const results = []
for (const m of selected) {
  const original = readFileSync(m.file, 'utf8')
  writeFileSync(BACKUP, JSON.stringify({ file: m.file, content: original }))
  mutated = { file: m.file, content: original }
  writeFileSync(m.file, editsOf(m).reduce((code, e) => code.replace(e.find, e.replace), original))
  const start = Date.now()
  const run = await runTests(m.tests)
  restore()
  const killed = run.status !== 0
  results.push({ ...m, killed })
  console.log(`${killed ? 'KILLED  ' : 'SURVIVED'}  ${m.id.padEnd(44)} ${((Date.now() - start) / 1000).toFixed(1)}s  ${m.description}`)
}

const survived = results.filter(r => !r.killed)
console.log(`\n${results.length} mutations: ${results.length - survived.length} killed, ${survived.length} survived`)
process.exit(survived.length > 0 ? 1 : 0)
