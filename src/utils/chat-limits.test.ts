import { describe, expect, it, vi } from 'vitest'
import {
  isLimitStorageEvent,
  limitIdentityKey,
  locksUi,
  nextMidnightUtc,
  readLimit,
  saveLimit,
  type StoredLimit,
} from './chat-limits'
import { stableHash } from './hash'

// Daily chat limits remembered per identity (src/utils/chat-limits.ts).

const NOW = Date.parse('2026-03-01T12:00:00Z')
const HOUR = 60 * 60 * 1000
const limit = (overrides: Partial<StoredLimit> = {}): StoredLimit => ({ message: 'limit', scope: 'session', until: NOW + HOUR, ...overrides })
const stored = () => JSON.parse(localStorage.getItem('cora_limits') ?? 'null')

describe('limitIdentityKey', () => {
  it('keys signed-in users by user and anonymous visitors by session, with hashed ids', () => {
    expect(limitIdentityKey({ userId: 'firebase-uid-1', sessionId: 's' })).toBe(`user:${stableHash('firebase-uid-1')}`)
    expect(limitIdentityKey({ userId: null, sessionId: '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f' })).toBe(
      `anon:${stableHash('3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f')}`,
    )
  })

  it('never contains the raw id', () => {
    expect(limitIdentityKey({ userId: 'firebase-uid-1', sessionId: 's' })).not.toContain('firebase-uid-1')
    expect(limitIdentityKey({ sessionId: '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f' })).not.toContain('3f2b8c1e')
  })

  it('gives different users and sessions different keys', () => {
    const keys = new Set([
      limitIdentityKey({ userId: 'u1', sessionId: 's' }),
      limitIdentityKey({ userId: 'u2', sessionId: 's' }),
      limitIdentityKey({ sessionId: 's1' }),
      limitIdentityKey({ sessionId: 's2' }),
    ])
    expect(keys.size).toBe(4)
  })
})

describe('locksUi', () => {
  it.each([
    ['user', true],
    ['session', true],
    [undefined, true], // older responses without a scope were per-identity limits
    ['ip', false], // follows the network, not the browser
    ['global', false], // everyone's total: operators can raise it
    ['signed_in_global', false],
    ['something_new', false], // unknown: don't block, a refused question costs nothing
  ])('scope %s → %s', (scope, expected) => {
    expect(locksUi(scope)).toBe(expected)
  })
})

describe('readLimit / saveLimit', () => {
  it('remembers a limit per identity until it resets', () => {
    saveLimit('anon:a', limit())
    expect(readLimit('anon:a', NOW)).toEqual(limit())
    expect(readLimit('anon:b', NOW)).toBeNull()
    expect(readLimit('anon:a', NOW + HOUR)).toBeNull() // reset
  })

  it('keeps limits of several identities side by side', () => {
    saveLimit('anon:a', limit({ message: 'a' }))
    saveLimit('user:u', limit({ message: 'u', scope: 'user' }))
    expect(readLimit('anon:a', NOW)?.message).toBe('a')
    expect(readLimit('user:u', NOW)?.message).toBe('u')
  })

  it('removes expired limits (of any identity) when reading', () => {
    saveLimit('anon:old', limit({ until: NOW - 1 }))
    saveLimit('anon:live', limit())
    readLimit('anon:other', NOW)
    expect(Object.keys(stored())).toEqual(['anon:live'])
    saveLimit('anon:live', limit({ until: NOW - 1 }))
    readLimit('anon:live', NOW)
    expect(localStorage.getItem('cora_limits')).toBeNull() // nothing left: key removed
  })

  it('stores only what the banner needs, under hashed keys', () => {
    saveLimit(limitIdentityKey({ userId: 'raw-user-id', sessionId: 's' }), limit())
    expect(localStorage.getItem('cora_limits')).not.toContain('raw-user-id')
    expect(Object.values(stored())).toEqual([{ message: 'limit', scope: 'session', until: NOW + HOUR }])
  })

  it.each([['{not json'], ['[1,2]'], ['"text"'], ['{"anon:a":{"message":1,"until":"x"}}']])(
    'ignores unreadable storage (%s)',
    value => {
      localStorage.setItem('cora_limits', value)
      expect(readLimit('anon:a', NOW)).toBeNull()
      saveLimit('anon:a', limit())
      expect(readLimit('anon:a', NOW)).toEqual(limit())
    },
  )

  it('works without storage (the limit then lasts for the page only)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => saveLimit('anon:a', limit())).not.toThrow()
    expect(readLimit('anon:a', NOW)).toBeNull()
  })
})

describe('nextMidnightUtc', () => {
  it.each([
    ['2026-03-01T12:00:00Z', '2026-03-02T00:00:00.000Z'],
    ['2026-03-01T00:00:00Z', '2026-03-02T00:00:00.000Z'],
    ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00.000Z'],
  ])('%s → %s', (now, expected) => {
    expect(new Date(nextMidnightUtc(Date.parse(now))).toISOString()).toBe(expected)
  })
})

describe('isLimitStorageEvent', () => {
  it('recognises changes to the limits, and a cleared storage', () => {
    expect(isLimitStorageEvent(new StorageEvent('storage', { key: 'cora_limits' }))).toBe(true)
    expect(isLimitStorageEvent(new StorageEvent('storage', { key: null }))).toBe(true)
    expect(isLimitStorageEvent(new StorageEvent('storage', { key: 'chat_abc' }))).toBe(false)
  })
})
