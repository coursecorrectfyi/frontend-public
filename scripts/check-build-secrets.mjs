#!/usr/bin/env node
/**
 * Fails if a secret value appears anywhere in the Next.js build output (.next/, including the standalone server
 * and the browser bundles in .next/static).
 *
 *   node scripts/check-build-secrets.mjs <value> [<value> ...]
 *
 * scripts/verify.sh builds with API_RELAY_SECRET set to a random canary and runs this with the canary. Server-only
 * secrets are read from process.env at runtime, so no build artefact should ever contain them. A hit means the
 * secret was inlined somewhere (a NEXT_PUBLIC_* name, next.config.ts `env`, a client component reading it, a
 * prerendered page or a cached fetch that included it).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const values = process.argv.slice(2).filter(Boolean)
if (values.length === 0) {
  console.error('usage: node scripts/check-build-secrets.mjs <secret value> [...]')
  process.exit(2)
}
const root = '.next'
if (!existsSync(root)) {
  console.error(`${root}/ not found: run the build first.`)
  process.exit(2)
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

const needles = values.map(v => Buffer.from(v))
const hits = []
let scanned = 0
for (const file of walk(root)) {
  scanned++
  const content = readFileSync(file) // raw bytes: catches text and binary (e.g. cache) files alike
  for (const [i, needle] of needles.entries()) {
    if (content.includes(needle)) hits.push(`${relative('.', file)} (value #${i + 1})`)
  }
}

if (hits.length > 0) {
  console.error(`Secret found in the build output (${hits.length} file(s)):\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`No secret in the build output (${scanned} files scanned under ${root}/).`)
