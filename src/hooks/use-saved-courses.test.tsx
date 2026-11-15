import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MAX_SAVED_COURSES } from '@/api/courses'
import { makeResource } from '@/test/fixtures'
import { mockSignedIn } from '@/test/mocks/next-auth'
import { createGate, mockApi } from '@/test/msw'
import { createTestQueryClient, renderHookWithProviders } from '@/test/render'
import { useSavedCourses } from './use-saved-courses'

// useSavedCourses: the signed-in user's saved items (shared by every save button and the /saved page),
// with optimistic save/remove and a 25-item cap. Contract: docs/backend-api.md → "Saved courses".

function renderSaved(options?: Parameters<typeof useSavedCourses>[0], queryClient = createTestQueryClient()) {
  return renderHookWithProviders(() => useSavedCourses(options), { queryClient })
}

describe('useSavedCourses', () => {
  it('does not call the API for signed-out visitors', async () => {
    const { result } = renderSaved() // no handler: a request would fail the test
    await act(async () => {})
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.savedItems).toEqual([])
    expect(result.current.fetchStatus).toBe('idle') // not even attempted, so no "no token" error either
    expect(result.current.error).toBeNull()
  })

  it('loads the saved items for a signed-in user', async () => {
    mockSignedIn({ token: 'tok' })
    const items = [makeResource(), makeResource()]
    const calls = mockApi('get', '/api/v1/saved', { data: items })
    const { result } = renderSaved()

    await waitFor(() => expect(result.current.savedItems).toEqual(items))
    expect(result.current.isAuthenticated).toBe(true)
    expect(calls[0].headers.get('authorization')).toBe('Bearer tok')
  })

  it('is shared: every component using it causes a single request', async () => {
    mockSignedIn()
    const calls = mockApi('get', '/api/v1/saved', { data: [] })
    const queryClient = createTestQueryClient()
    renderSaved(undefined, queryClient)
    renderSaved(undefined, queryClient)
    renderSaved(undefined, queryClient)
    await waitFor(() => expect(calls).toHaveLength(1))
  })

  it('exposes the load error (e.g. expired session) without retrying', async () => {
    mockSignedIn()
    const calls = mockApi('get', '/api/v1/saved', { error: 'x' }, { status: 401 })
    const { result } = renderSaved()
    await waitFor(() => expect(result.current.error?.message).toBe('Your session has expired. Please log in again.'))
    expect(calls).toHaveLength(1)
  })

  describe('saving', () => {
    it('shows the item as saved immediately, saves it, then refreshes the list', async () => {
      mockSignedIn()
      const existing = makeResource()
      const added = makeResource()
      let serverList = [existing]
      const reads = mockApi('get', '/api/v1/saved', () => Response.json({ data: serverList }))
      const gate = createGate()
      const writes = mockApi('post', '/api/v1/saved/:id', async () => {
        await gate.wait()
        serverList = [added, existing]
        return Response.json({ ok: true })
      })
      const { result } = renderSaved()
      await waitFor(() => expect(result.current.savedItems).toHaveLength(1))

      act(() => result.current.saveCourse(added.id))
      // Before the server answers: already shown as saved, and the buttons are busy.
      await waitFor(() => expect(result.current.savedItems.map(r => r.id)).toEqual([existing.id, added.id]))
      expect(result.current.isMutating).toBe(true)
      expect(reads).toHaveLength(1)

      gate.open()
      await waitFor(() => expect(result.current.isMutating).toBe(false))
      expect(writes[0].params.id).toBe(added.id)
      await waitFor(() => expect(result.current.savedItems).toEqual([added, existing])) // refetched from the server
      expect(reads).toHaveLength(2)
    })

    it('rolls back and reports the error when saving fails', async () => {
      mockSignedIn()
      const existing = makeResource()
      mockApi('get', '/api/v1/saved', { data: [existing] })
      mockApi('post', '/api/v1/saved/:id', { error: 'Resource not found' }, { status: 404 })
      const onError = vi.fn()
      const { result } = renderSaved({ onError })
      await waitFor(() => expect(result.current.savedItems).toHaveLength(1))

      act(() => result.current.saveCourse('gone'))
      await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to save item' })))
      await waitFor(() => expect(result.current.savedItems).toEqual([existing]))
    })

    it(`refuses to save more than ${MAX_SAVED_COURSES} items, without calling the API`, async () => {
      mockSignedIn()
      const full = Array.from({ length: MAX_SAVED_COURSES }, () => makeResource())
      mockApi('get', '/api/v1/saved', { data: full })
      const onError = vi.fn()
      const { result } = renderSaved({ onError })
      await waitFor(() => expect(result.current.savedItems).toHaveLength(MAX_SAVED_COURSES))
      expect(result.current.canAddMoreCourses).toBe(false)

      act(() => result.current.saveCourse('one-too-many')) // no POST handler: a request would fail the test
      await waitFor(() =>
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: `You can shortlist up to ${MAX_SAVED_COURSES} items. Please remove some before adding more.` }),
        ),
      )
      expect(result.current.savedItems).toHaveLength(MAX_SAVED_COURSES)
    })

    it(`allows saving while under ${MAX_SAVED_COURSES} items`, async () => {
      mockSignedIn()
      mockApi('get', '/api/v1/saved', { data: Array.from({ length: MAX_SAVED_COURSES - 1 }, () => makeResource()) })
      const { result } = renderSaved()
      await waitFor(() => expect(result.current.savedItems).toHaveLength(MAX_SAVED_COURSES - 1))
      expect(result.current.canAddMoreCourses).toBe(true)
    })
  })

  describe('removing', () => {
    it('hides the item immediately, deletes it, then refreshes the list', async () => {
      mockSignedIn()
      const [a, b] = [makeResource(), makeResource()]
      let serverList = [a, b]
      const reads = mockApi('get', '/api/v1/saved', () => Response.json({ data: serverList }))
      const gate = createGate()
      const deletes = mockApi('delete', '/api/v1/saved/:id', async () => {
        await gate.wait()
        serverList = [b]
        return Response.json({ ok: true })
      })
      const { result } = renderSaved()
      await waitFor(() => expect(result.current.savedItems).toHaveLength(2))

      act(() => result.current.removeCourse(a.id))
      // Before the server answers: already hidden.
      await waitFor(() => expect(result.current.savedItems).toEqual([b]))
      expect(result.current.isMutating).toBe(true)

      gate.open()
      await waitFor(() => expect(result.current.isMutating).toBe(false))
      expect(deletes[0].params.id).toBe(a.id)
      await waitFor(() => expect(reads).toHaveLength(2))
      expect(result.current.savedItems).toEqual([b])
    })

    it('rolls back and reports the error when removing fails', async () => {
      mockSignedIn()
      const [a, b] = [makeResource(), makeResource()]
      mockApi('get', '/api/v1/saved', { data: [a, b] })
      mockApi('delete', '/api/v1/saved/:id', { error: 'x' }, { status: 500 })
      const onError = vi.fn()
      const { result } = renderSaved({ onError })
      await waitFor(() => expect(result.current.savedItems).toHaveLength(2))

      act(() => result.current.removeCourse(a.id))
      await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to remove item' })))
      await waitFor(() => expect(result.current.savedItems).toEqual([a, b]))
    })
  })

  it.fails("KNOWN BUG (B15): never shows one user's saved items to the next user signed in on the same page", async () => {
    mockSignedIn({ token: 'token-1', user: { id: 'user-1' } })
    const first = makeResource({ title: 'User 1 item' })
    mockApi('get', '/api/v1/saved', request =>
      Response.json({ data: request.headers.get('authorization') === 'Bearer token-1' ? [first] : [] }),
    )
    const queryClient = createTestQueryClient()
    const one = renderSaved(undefined, queryClient)
    await waitFor(() => expect(one.result.current.savedItems).toEqual([first]))
    one.unmount()

    // A normal sign-out reloads the page (clearing the cache), but sign-in uses signIn(..., { redirect: false }):
    // after a session expires, signing in with another account keeps the page and its query cache.
    mockSignedIn({ token: 'token-2', user: { id: 'user-2' } })
    const two = renderSaved(undefined, queryClient)
    expect(two.result.current.savedItems).toEqual([])
  })
})
