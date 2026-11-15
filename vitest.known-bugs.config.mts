import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.mts'

/**
 * Runs only the `it.fails('KNOWN BUG ...')` tests, as ordinary tests, so their real failure is visible.
 * Used by scripts/known-bugs.mjs (`npm run test:known-bugs`) to check that every known-bug test fails
 * because of the bug (an assertion), not because the test itself is broken.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      {
        name: 'known-bugs-as-regular-tests',
        enforce: 'pre',
        transform(code, id) {
          if (!/\.test\.tsx?$/.test(id)) return null
          return { code: code.replace(/\bit\.fails\(/g, 'it('), map: null }
        },
      },
    ],
    test: { testNamePattern: 'KNOWN BUG' },
  }),
)
