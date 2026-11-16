import { describe, expect, it, vi } from 'vitest'
import { getOrCreateSessionId, isUuid, randomUuid } from './session'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Contract (docs/backend-api.md, Chat → Identity): X-Session-ID is one crypto.randomUUID(), kept in
// localStorage under `cc_session_id` and reused; any non-UUID value is rejected with 400.
describe('getOrCreateSessionId', () => {
  it('creates a UUID v4 and stores it under cc_session_id', () => {
    const id = getOrCreateSessionId()
    expect(id).toMatch(UUID_V4)
    expect(localStorage.getItem('cc_session_id')).toBe(id)
  })

  it('reuses the stored id on later calls instead of generating a new one', () => {
    const first = getOrCreateSessionId()
    const spy = vi.spyOn(crypto, 'randomUUID')
    expect(getOrCreateSessionId()).toBe(first)
    expect(getOrCreateSessionId()).toBe(first)
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps an existing id from a previous visit', () => {
    localStorage.setItem('cc_session_id', '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f')
    expect(getOrCreateSessionId()).toBe('3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f')
  })

  it('returns an empty string during server rendering (no window)', () => {
    vi.stubGlobal('window', undefined)
    expect(getOrCreateSessionId()).toBe('')
  })

  it.each(['not-a-uuid', '', '3f2b8c1e9d4a4e6b8c2d1a2b3c4d5e6f', '3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6fX'])(
    'replaces a stored value that is not a UUID (%j): the backend would answer 400',
    stored => {
      localStorage.setItem('cc_session_id', stored)
      const id = getOrCreateSessionId()
      expect(id).toMatch(UUID_V4)
      expect(localStorage.getItem('cc_session_id')).toBe(id)
      expect(getOrCreateSessionId()).toBe(id) // and then keeps the new one
    },
  )

  it('keeps a stored UUID in any case, ignoring surrounding whitespace (as the backend does)', () => {
    localStorage.setItem('cc_session_id', '  3F2B8C1E-9D4A-4E6B-8C2D-1A2B3C4D5E6F\n')
    expect(getOrCreateSessionId()).toBe('3F2B8C1E-9D4A-4E6B-8C2D-1A2B3C4D5E6F')
  })

  it('still creates a UUID v4 where crypto.randomUUID is missing (pages served over plain http)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const id = getOrCreateSessionId()
    expect(id).toMatch(UUID_V4)
    expect(localStorage.getItem('cc_session_id')).toBe(id)
  })

  it('keeps one id for the page when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const id = getOrCreateSessionId()
    expect(id).toMatch(UUID_V4)
    expect(getOrCreateSessionId()).toBe(id)
  })
})

describe('randomUuid / isUuid', () => {
  it('produces distinct UUID v4s with and without crypto.randomUUID', () => {
    const native = new Set(Array.from({ length: 50 }, randomUuid))
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const fallback = new Set(Array.from({ length: 50 }, randomUuid))
    for (const id of [...native, ...fallback]) expect(id).toMatch(UUID_V4)
    expect(native.size).toBe(50)
    expect(fallback.size).toBe(50)
  })

  it.each([
    ['3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f', true],
    ['3F2B8C1E-9D4A-4E6B-8C2D-1A2B3C4D5E6F', true],
    ['00000000-0000-4000-8000-000000000001', true],
    ['3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6', false],
    ['g f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f', false],
    ['', false],
  ])('isUuid(%j) → %s', (value, expected) => {
    expect(isUuid(value)).toBe(expected)
  })
})
