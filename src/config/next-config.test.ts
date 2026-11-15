// @vitest-environment node
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants'
import { describe, expect, it, vi } from 'vitest'
import config, { assertRequiredBuildEnv, nextConfig, REQUIRED_BUILD_ENV, shouldValidateBuildEnv } from '../../next.config'

const validEnv = { NEXT_PUBLIC_API_URL: 'https://api.example.com', NEXT_PUBLIC_GTM_ID: 'GTM-ABC123' }

describe('assertRequiredBuildEnv', () => {
  it('requires the API URL and the GTM id', () => {
    expect(REQUIRED_BUILD_ENV).toEqual(['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_GTM_ID'])
  })

  it('accepts a complete, valid environment', () => {
    expect(() => assertRequiredBuildEnv(validEnv)).not.toThrow()
    expect(() => assertRequiredBuildEnv({ ...validEnv, NEXT_PUBLIC_API_URL: 'http://localhost:3000' })).not.toThrow()
  })

  it('lists every missing variable in one error', () => {
    expect(() => assertRequiredBuildEnv({})).toThrow(
      /NEXT_PUBLIC_API_URL is not set[\s\S]*NEXT_PUBLIC_GTM_ID is not set/,
    )
  })

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    // Docker passes ARGs through as strings; an unset shell variable can arrive as the literal text.
    ['the string "undefined"', 'undefined'],
  ])('treats an %s value as missing', (_label, value) => {
    expect(() => assertRequiredBuildEnv({ ...validEnv, NEXT_PUBLIC_GTM_ID: value })).toThrow(
      'NEXT_PUBLIC_GTM_ID is not set',
    )
  })

  it.each(['localhost:3000', 'api.example.com', '/api', 'ftp://api.example.com'])(
    'rejects an API URL that is not an absolute http(s) URL: %s',
    value => {
      expect(() => assertRequiredBuildEnv({ ...validEnv, NEXT_PUBLIC_API_URL: value })).toThrow(
        `NEXT_PUBLIC_API_URL must be an absolute http(s) URL, got "${value}"`,
      )
    },
  )

  it('points the developer at the docs', () => {
    expect(() => assertRequiredBuildEnv({})).toThrow(/\.env\.example and README\.md/)
  })

  it('reads process.env by default', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')
    expect(() => assertRequiredBuildEnv()).toThrow('NEXT_PUBLIC_API_URL is not set')
  })
})

describe('next.config default export', () => {
  it('validates the environment for the production build', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')
    expect(() => config(PHASE_PRODUCTION_BUILD)).toThrow('NEXT_PUBLIC_API_URL is not set')
  })

  it.each([PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER, 'phase-test'])(
    'does not require build-time variables in %s (dev, start, lint, tests)',
    phase => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', '')
      vi.stubEnv('NEXT_PUBLIC_GTM_ID', '')
      expect(config(phase)).toBe(nextConfig)
    },
  )

  it('returns the same config for a valid production build', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', validEnv.NEXT_PUBLIC_API_URL)
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', validEnv.NEXT_PUBLIC_GTM_ID)
    expect(config(PHASE_PRODUCTION_BUILD)).toBe(nextConfig)
  })
})

describe('shouldValidateBuildEnv', () => {
  const argv = (command?: string) => ['node', '/app/node_modules/.bin/next', ...(command ? [command] : [])]

  it('validates for next build', () => {
    expect(shouldValidateBuildEnv(PHASE_PRODUCTION_BUILD, argv('build'))).toBe(true)
  })

  it.each(['lint', 'typegen'])('skips next %s, which loads the config in the build phase without bundling', command => {
    expect(shouldValidateBuildEnv(PHASE_PRODUCTION_BUILD, argv(command))).toBe(false)
  })

  it('fails closed: validates when the build phase is used by any other or unknown caller', () => {
    expect(shouldValidateBuildEnv(PHASE_PRODUCTION_BUILD, argv())).toBe(true)
    expect(shouldValidateBuildEnv(PHASE_PRODUCTION_BUILD, argv('some-future-command'))).toBe(true)
  })

  it('never validates outside the build phase', () => {
    expect(shouldValidateBuildEnv(PHASE_DEVELOPMENT_SERVER, argv('dev'))).toBe(false)
    expect(shouldValidateBuildEnv(PHASE_PRODUCTION_SERVER, argv('start'))).toBe(false)
  })
})

describe('nextConfig', () => {
  it('permanently redirects legacy URLs', async () => {
    expect(await nextConfig.redirects!()).toEqual([
      { source: '/course/:slug/:id', destination: '/learn/:slug/:id', permanent: true },
      { source: '/saved-courses', destination: '/saved', permanent: true },
    ])
  })

  it('builds a standalone server for the Docker image', () => {
    expect(nextConfig.output).toBe('standalone')
  })
})
