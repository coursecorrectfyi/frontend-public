import { describe, expect, it, vi } from 'vitest'
import { getOrCreateSessionId } from './session'

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

  it.fails('KNOWN BUG (B25): replaces a stored value that is not a UUID (the backend would answer 400)', () => {
    localStorage.setItem('cc_session_id', 'not-a-uuid')
    const id = getOrCreateSessionId()
    expect(id).toMatch(UUID_V4)
    expect(localStorage.getItem('cc_session_id')).toBe(id)
  })
})
