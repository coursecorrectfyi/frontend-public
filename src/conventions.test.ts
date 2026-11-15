import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Codebase conventions that keep the app (and the test suite) working. Each rule says why it exists.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

const files = sourceFiles(join(process.cwd(), 'src')).map(path => ({
  path: path.slice(process.cwd().length + 1),
  code: readFileSync(path, 'utf8'),
}))

describe('conventions', () => {
  it('imports MUI icons by path, never from the @mui/icons-material barrel', () => {
    // The barrel re-exports ~2,000 icons as non-native ESM. Next.js rewrites it at build time, but every other
    // tool must load all of them: importing it once made a single test file take over 3 minutes (vs 25 ms).
    // Use `import SearchIcon from '@mui/icons-material/Search'`.
    const offenders = files
      .filter(f => /from\s+['"]@mui\/icons-material['"]/.test(f.code))
      .map(f => f.path)
    expect(offenders).toEqual([])
  })
})
