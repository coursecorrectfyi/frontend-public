import { describe, expect, it } from 'vitest'
import { makeResource } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import {
  addCourseToShortlist,
  ERR_NO_AUTH_TOKEN,
  ERR_PERMISSION_DENIED,
  ERR_SESSION_EXPIRED,
  getSavedCourses,
  MAX_SAVED_COURSES,
  removeCourseFromShortlist,
} from './courses'

// Saved items (contract: docs/backend-api.md → "Saved courses"). All endpoints need the access token.

describe('getSavedCourses', () => {
  it('fetches the saved items with the access token', async () => {
    const items = [makeResource(), makeResource()]
    const calls = mockApi('get', '/api/v1/saved', { data: items })

    await expect(getSavedCourses('tok')).resolves.toEqual(items)
    expect(calls[0].headers.get('authorization')).toBe('Bearer tok')
  })

  it('keeps the API order (newest first) instead of re-sorting', async () => {
    const newest = makeResource({ title: 'B newest' })
    const oldest = makeResource({ title: 'A oldest' })
    mockApi('get', '/api/v1/saved', { data: [newest, oldest] })
    expect((await getSavedCourses('tok')).map(r => r.title)).toEqual(['B newest', 'A oldest'])
  })

  it('returns an empty list when the response has no data', async () => {
    mockApi('get', '/api/v1/saved', {})
    await expect(getSavedCourses('tok')).resolves.toEqual([])
  })

  it('refuses to call the API without a token', async () => {
    // No handler registered: a request would fail the test.
    await expect(getSavedCourses('')).rejects.toThrow(ERR_NO_AUTH_TOKEN)
  })

  it.each([
    [401, ERR_SESSION_EXPIRED],
    [403, ERR_PERMISSION_DENIED],
    [500, 'Failed to fetch saved items. Please try again.'],
  ])('turns HTTP %i into a readable message', async (status, message) => {
    mockApi('get', '/api/v1/saved', { error: 'x' }, { status })
    await expect(getSavedCourses('tok')).rejects.toThrow(message)
  })
})

describe('addCourseToShortlist', () => {
  it('POSTs the resource id with the access token', async () => {
    const calls = mockApi('post', '/api/v1/saved/:id', { ok: true })
    await expect(addCourseToShortlist('tok', 'res-1')).resolves.toEqual({ ok: true })
    expect(calls[0].params.id).toBe('res-1')
    expect(calls[0].headers.get('authorization')).toBe('Bearer tok')
  })

  it('URL-encodes the id', async () => {
    const calls = mockApi('post', '/api/v1/saved/:id', { ok: true })
    await addCourseToShortlist('tok', 'a/b?c')
    expect(calls[0].url.pathname).toBe('/api/v1/saved/a%2Fb%3Fc')
  })

  it('rejects when the resource does not exist (404)', async () => {
    mockApi('post', '/api/v1/saved/:id', { error: 'Resource not found' }, { status: 404 })
    await expect(addCourseToShortlist('tok', 'x')).rejects.toThrow('Failed to save item')
  })

  it('refuses to call the API without a token', async () => {
    await expect(addCourseToShortlist('', 'x')).rejects.toThrow(ERR_NO_AUTH_TOKEN)
  })
})

describe('removeCourseFromShortlist', () => {
  it('DELETEs the resource id with the access token', async () => {
    const calls = mockApi('delete', '/api/v1/saved/:id', { ok: true })
    await expect(removeCourseFromShortlist('tok', 'res-1')).resolves.toEqual({ ok: true })
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].params.id).toBe('res-1')
    expect(calls[0].headers.get('authorization')).toBe('Bearer tok')
  })

  it('rejects on a server error', async () => {
    mockApi('delete', '/api/v1/saved/:id', { error: 'x' }, { status: 500 })
    await expect(removeCourseFromShortlist('tok', 'x')).rejects.toThrow('Failed to remove item')
  })

  it('refuses to call the API without a token', async () => {
    await expect(removeCourseFromShortlist('', 'x')).rejects.toThrow(ERR_NO_AUTH_TOKEN)
  })
})

describe('MAX_SAVED_COURSES', () => {
  it('is 25', () => {
    expect(MAX_SAVED_COURSES).toBe(25)
  })
})
