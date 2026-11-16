import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Test configuration. See docs/testing.md for conventions.
 *
 * - No network: every HTTP request must be answered by an MSW handler (src/test/msw.ts);
 *   an unhandled request fails the test that made it.
 * - No env files: the NEXT_PUBLIC_* values the app reads are fixed below.
 * - Default environment is jsdom; server-only files opt into Node with
 *   a `// @vitest-environment node` docblock at the top of the test file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `import 'server-only'` (src/lib/server/*): Next.js maps it to an empty module for server code and to a
      // throwing one for client bundles. Tests run the server code, so they get the empty one.
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)),
    },
  },
  // tsconfig.json has "jsx": "preserve" (Next.js compiles JSX itself); tests need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // The timeout only catches hangs; slowness is reported separately (slowTestThreshold). Page-level tests render
    // the whole page and click through real MUI components: ~4 s on an idle 4-core machine, but ~19 s when the CPU
    // is oversubscribed (measured: 12 parallel runs on 4 cores, `bash scripts/flaky-check.sh`). 20 s timed out under
    // `npm run verify` on a busy machine, so 60 s leaves ~3x headroom over that worst case.
    testTimeout: 60_000,
    // Durations over this are highlighted in the output: a test that is slow even when the machine is idle deserves a
    // look (see docs/testing.md → Troubleshooting).
    slowTestThreshold: 5_000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://api.test',
      NEXT_PUBLIC_GTM_ID: 'GTM-TEST',
      NEXT_PUBLIC_HOSTINGER_IP: '',
      NEXT_PUBLIC_EARLY_ACCESS_FORM_URL: '',
      NEXT_PUBLIC_EARLY_ACCESS_INTENT_ENTRY_ID: '',
      NEXT_PUBLIC_EARLY_ACCESS_EMAIL_ENTRY_ID: '',
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3001',
    },
    // Undo vi.spyOn / vi.stubEnv / vi.stubGlobal after every test.
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Thresholds are added (and ratcheted up) as the suite grows; see docs/testing.md.
    },
  },
})
