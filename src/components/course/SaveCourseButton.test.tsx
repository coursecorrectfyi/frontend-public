import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MAX_SAVED_COURSES } from '@/api/courses'
import { limitResponse, makeBackendTokens, makeRateLimited, makeResource } from '@/test/fixtures'
import { firebase } from '@/test/mocks/firebase'
import { mockSignedIn, nextAuth } from '@/test/mocks/next-auth'
import { createGate, mockApi } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import SaveCourseButton from './SaveCourseButton'

// The bookmark button on cards and the detail page.

const resource = makeResource({ title: 'Python 101' })
const render = () => renderWithProviders(<SaveCourseButton courseId={resource.id} courseName={resource.title} />)

describe('SaveCourseButton', () => {
  it('asks signed-out visitors to sign in (Google) instead of saving', async () => {
    mockApi('post', '/api/v1/auth/firebase/login', makeBackendTokens())
    const { user } = render()
    await user.click(screen.getByRole('button', { name: 'Sign in to save courses' }))
    await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalled())
    expect(firebase.signInWithGoogle).toHaveBeenCalled()
  })

  it('saves an unsaved resource and tracks it', async () => {
    mockSignedIn()
    let saved: typeof resource[] = []
    mockApi('get', '/api/v1/saved', () => Response.json({ data: saved }))
    const posts = mockApi('post', '/api/v1/saved/:id', () => {
      saved = [resource]
      return Response.json({ ok: true })
    })
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))
    expect(await screen.findByRole('button', { name: 'Remove from shortlist' })).toBeInTheDocument()
    expect(posts[0].params.id).toBe(resource.id)
    expect(window.dataLayer).toEqual([
      expect.objectContaining({ event: 'save_course', course_id: resource.id, course_name: 'Python 101', action: 'save' }),
    ])
  })

  it('removes a saved resource and tracks it', async () => {
    mockSignedIn()
    let saved = [resource]
    mockApi('get', '/api/v1/saved', () => Response.json({ data: saved }))
    const deletes = mockApi('delete', '/api/v1/saved/:id', () => {
      saved = []
      return Response.json({ ok: true })
    })
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Remove from shortlist' }))
    expect(await screen.findByRole('button', { name: 'Add to shortlist' })).toBeInTheDocument()
    expect(deletes[0].params.id).toBe(resource.id)
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'save_course', action: 'unsave' })])
  })

  it('is disabled while saving', async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: [] })
    const gate = createGate()
    mockApi('post', '/api/v1/saved/:id', async () => {
      await gate.wait()
      return Response.json({ ok: true })
    })
    const { user } = render()
    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /shortlist/ })).toBeDisabled())
    gate.open()
    await waitFor(() => expect(screen.getByRole('button', { name: /shortlist/ })).toBeEnabled())
  })

  it('explains a failed save in a dismissible message', async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: [] })
    mockApi('post', '/api/v1/saved/:id', { error: 'Resource not found' }, { status: 404 })
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("This item is no longer available, so it can't be saved.")
    await user.click(document.body) // clicking elsewhere keeps it
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it("shows the backend's message when saving is rate limited", async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: [] })
    mockApi('post', '/api/v1/saved/:id', () => limitResponse(makeRateLimited()))
    const { user } = render()
    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment and try again.')
  })

  it(`explains the ${MAX_SAVED_COURSES}-item limit`, async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: Array.from({ length: MAX_SAVED_COURSES }, () => makeResource()) })
    const { user } = render()
    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(`You can shortlist up to ${MAX_SAVED_COURSES} items`)
  })
})
