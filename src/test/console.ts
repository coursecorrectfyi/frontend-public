/**
 * Fails a test when it produces an unexpected console.error or console.warn.
 *
 * React reports real problems this way (duplicate keys, state updates outside act(), invalid DOM
 * props), and app code logs failures with console.error. A test that triggers either must say so:
 *
 *   allowConsole('error', /Failed to fetch subjects/)
 *
 * Allowed messages are still swallowed (not printed) to keep the output readable.
 * console.log / console.info are left alone.
 */
import { format } from 'node:util'

type Level = 'error' | 'warn'

const allowed: Array<{ level: Level; pattern: RegExp | string }> = []
const unexpected: string[] = []
const originals: Partial<Record<Level, (...args: unknown[]) => void>> = {}

export function allowConsole(level: Level, pattern: RegExp | string) {
  allowed.push({ level, pattern })
}

function matches(message: string, pattern: RegExp | string) {
  return typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)
}

export function installConsoleGuard() {
  for (const level of ['error', 'warn'] as const) {
    originals[level] = console[level]
    console[level] = (...args: unknown[]) => {
      const message = format(...args)
      if (allowed.some(a => a.level === level && matches(message, a.pattern))) return
      unexpected.push(`console.${level}: ${message}`)
      originals[level]!(...args)
    }
  }
}

/** Restores console and returns the unexpected messages logged since install. */
export function uninstallConsoleGuard(): string[] {
  for (const level of ['error', 'warn'] as const) {
    if (originals[level]) console[level] = originals[level]!
  }
  allowed.length = 0
  return unexpected.splice(0)
}
