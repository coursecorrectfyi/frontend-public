import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
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

// ── Route files export only what Next.js allows ──────────────────────────────
// Next.js only accepts certain exports from page/layout/route files. `npm run typecheck` doesn't check this (only
// `next build`'s own type check does, and it is off: `ignoreBuildErrors`), so a helper exported from a route
// file went unnoticed once. Shared constants and helpers go in a sibling module instead.

const SEGMENT_CONFIG = ['dynamic', 'dynamicParams', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion', 'maxDuration', 'experimental_ppr']
const ALLOWED_EXPORTS: Record<string, string[]> = {
  'route.ts': ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'generateStaticParams', ...SEGMENT_CONFIG],
  'page.tsx': ['default', 'metadata', 'generateMetadata', 'viewport', 'generateViewport', 'generateStaticParams', ...SEGMENT_CONFIG],
  'layout.tsx': ['default', 'metadata', 'generateMetadata', 'viewport', 'generateViewport', 'generateStaticParams', ...SEGMENT_CONFIG],
}

/** Names a module exports: declarations, `export default`, and `export { a as b }` lists. */
function exportedNames(code: string): string[] {
  const names = [...code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])
  if (/^export\s+default\b/m.test(code)) names.push('default')
  for (const list of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const item of list[1].split(',').map(x => x.trim()).filter(Boolean)) names.push(item.split(/\s+as\s+/).at(-1)!)
  }
  return names
}

describe('Next.js route files', () => {
  const routeFiles = files.filter(f => f.path.startsWith('src/app/') && Object.keys(ALLOWED_EXPORTS).some(n => f.path.endsWith(`/${n}`)))

  it('finds the route files (sanity check of the walk)', () => {
    expect(routeFiles.map(f => f.path)).toEqual(expect.arrayContaining(['src/app/page.tsx', 'src/app/blog/[[...slug]]/route.ts']))
  })

  it('export only names Next.js allows in page, layout and route files', () => {
    const invalid = routeFiles.flatMap(f => {
      const allowed = ALLOWED_EXPORTS[f.path.split('/').at(-1)!]
      return exportedNames(f.code).filter(name => !allowed.includes(name)).map(name => `${f.path}: ${name}`)
    })
    expect(invalid).toEqual([])
  })

  it('reads every kind of export statement', () => {
    expect(
      exportedNames('export const a = 1\nexport async function GET() {}\nexport default function X() {}\nexport { h as POST, j }\nexport { default } from "./x"'),
    ).toEqual(['a', 'GET', 'default', 'POST', 'j', 'default'])
  })
})

// ── The relay secret never reaches the browser ────────────────────────────────
// API_RELAY_SECRET lets whoever has it claim any visitor IP and get around every per-visitor limit of the backend
// (docs/backend-api.md → "Calls from a server on a visitor's behalf"). Layers, from fastest to last resort:
//   1. these tests (source rules, including the import graph);
//   2. `import 'server-only'` in the relay module: Next.js fails any client bundle that imports it;
//   3. scripts/verify.sh builds with a random secret and fails if it shows up anywhere in the build output.

const RELAY_MODULE = 'src/lib/server/relay.ts'

/** Server files allowed to import the relay module. Add a file here only if it runs on the server for a visitor. */
const RELAY_IMPORTERS = [
  'src/app/learn/[slug]/[id]/page.tsx',
  'src/app/sitemap/subjects.xml/route.ts',
  'src/app/subjects/[slug]/page.tsx',
  'src/lib/auth-options.ts',
]

const appCode = files.filter(f => !/\.test\.tsx?$/.test(f.path) && !f.path.startsWith('src/test/'))

/** Resolves an import specifier to a file in src/, or undefined for packages. */
function resolveImport(from: string, specifier: string): string | undefined {
  let base: string
  if (specifier.startsWith('@/')) base = join('src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = normalize(join(dirname(from), specifier))
  else return undefined
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => base + ext).find(p => existsSync(join(process.cwd(), p)) && /\.tsx?$/.test(p))
}

/** Static imports, re-exports and dynamic imports of a file, resolved to src/ paths. */
function importsOf(file: { path: string; code: string }): string[] {
  const specifiers = [...file.code.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map(m => m[1])
  return specifiers.map(s => resolveImport(file.path, s)).filter((p): p is string => p !== undefined)
}

const isClientModule = (code: string) => /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(code)

describe('relay secret stays on the server', () => {
  const relay = files.find(f => f.path === RELAY_MODULE)

  it("the relay module starts with import 'server-only' (client bundles that import it fail to build)", () => {
    expect(relay, `${RELAY_MODULE} exists`).toBeDefined()
    const firstStatement = relay!.code.replace(/^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, '').split('\n')[0]
    expect(firstStatement).toMatch(/^import ['"]server-only['"];?$/)
  })

  it('only the relay module reads API_RELAY_SECRET', () => {
    const readers = appCode.filter(f => f.code.includes('API_RELAY_SECRET')).map(f => f.path)
    expect(readers).toEqual([RELAY_MODULE])
  })

  it('only the allowed server files import the relay module', () => {
    const importers = appCode.filter(f => importsOf(f).includes(RELAY_MODULE)).map(f => f.path).sort()
    expect(importers).toEqual([...RELAY_IMPORTERS].sort())
  })

  it("no 'use client' module imports the relay module, directly or through other modules", () => {
    // Everything that (transitively) imports the relay module ends up in the same bundle as it.
    const tainted = new Set([RELAY_MODULE])
    for (let grew = true; grew; ) {
      grew = false
      for (const f of appCode) {
        if (!tainted.has(f.path) && importsOf(f).some(p => tainted.has(p))) {
          tainted.add(f.path)
          grew = true
        }
      }
    }
    const clientModules = appCode.filter(f => tainted.has(f.path) && isClientModule(f.code)).map(f => f.path)
    expect(clientModules).toEqual([])
    // Sanity check of the walk itself: it found the route that pulls in auth-options.
    expect(tainted.has('src/app/api/auth/[...nextauth]/route.ts')).toBe(true)
  })

  it('the secret is never a public (NEXT_PUBLIC_*) variable, a next.config.ts env entry or a Docker build arg', () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
    const config = ['next.config.ts', 'Dockerfile', 'cloudbuild.yaml', '.env.example', ...appCode.map(f => f.path)]
    const publicRelayVars = config.filter(path => /NEXT_PUBLIC_\w*RELAY/i.test(read(path)))
    expect(publicRelayVars).toEqual([])
    // next.config.ts `env` values are inlined into every bundle; build args end up in the image history.
    expect(read('next.config.ts')).not.toContain('API_RELAY_SECRET')
    expect(read('Dockerfile')).not.toContain('API_RELAY_SECRET')
    // In Cloud Build it may only be attached to the Cloud Run service as a Secret Manager secret (`--set-secrets`),
    // never as a build arg or a plain env var.
    const lines = read('cloudbuild.yaml').split('\n')
    const assignments = lines.flatMap((line, i) => (/\bAPI_RELAY_SECRET=/.test(line) ? [i] : []))
    expect(assignments.length, 'cloudbuild.yaml attaches API_RELAY_SECRET to the service').toBeGreaterThan(0)
    for (const i of assignments) {
      expect(lines[i]).toMatch(/\bAPI_RELAY_SECRET=\$\{_API_RELAY_SECRET_NAME\}:latest\b/)
      expect(lines[i - 1].trim()).toBe('- "--set-secrets"')
    }
  })
})
