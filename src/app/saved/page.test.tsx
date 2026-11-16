import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { limitResponse, makeBackendTokens, makeRateLimited, makeResource } from '@/test/fixtures'
import { firebase } from '@/test/mocks/firebase'
import { mockSessionLoading, mockSignedIn, nextAuth } from '@/test/mocks/next-auth'
import { mockApi } from '@/test/msw'
import { allowKnownPageWarnings, expectMainLayout, renderPage } from '@/test/pages'
import { delta, done, sseResponse } from '@/test/sse'
import SavedPage from './page'

// UI inventory: /saved — the signed-in user's saved resources and the Cora chat panel.

beforeEach(() => {
  allowKnownPageWarnings()
})

describe('saved page', () => {
  it('asks signed-out visitors to sign in with Google', async () => {
    const tokens = makeBackendTokens()
    const login = mockApi('post', '/api/v1/auth/firebase/login', tokens)
    const { user } = await renderPage(<SavedPage />)
    expectMainLayout()

    expect(screen.getByRole('heading', { name: 'Sign in to save resources' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalled())
    expect(firebase.signInWithGoogle).toHaveBeenCalled()
    expect(JSON.parse(login[0].body)).toEqual({ idToken: 'firebase-id-token' })
  })

  it("lists the user's saved resources, each with Remove and Enroll", async () => {
    mockSignedIn()
    const saved = [makeResource({ title: 'Saved One' }), makeResource({ title: 'Saved Two' })]
    const calls = mockApi('get', '/api/v1/saved', { data: saved })
    await renderPage(<SavedPage />)

    expect(screen.getByRole('heading', { name: /^Your\s+saved items$/ })).toBeInTheDocument()
    const cards = (await screen.findAllByRole('link', { name: /^Saved (One|Two)$/ })).map(l => l.closest('.MuiCard-root') as HTMLElement)
    expect(cards.map(c => within(c).getAllByRole('link')[0].textContent)).toEqual(['Saved One', 'Saved Two'])
    for (const card of cards) {
      expect(within(card).getByRole('button', { name: 'Remove from shortlist' })).toBeInTheDocument()
      expect(within(card).getByText('Enroll')).toBeInTheDocument()
    }
    expect(calls[0].headers.get('authorization')).toBe('Bearer access-token')
  })

  it('invites the user to browse when nothing is saved (opens the search)', async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: [] })
    const { user } = await renderPage(<SavedPage />)
    expect(await screen.findByText('Nothing saved yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Browse resources/ }))
    expect(await screen.findByPlaceholderText('Enter a topic to begin')).toBeInTheDocument()
  })

  it('explains when the saved items cannot be loaded', async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { error: 'x' }, { status: 401 })
    await renderPage(<SavedPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired. Please log in again.')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull() // retrying would not help
  })

  it("shows the backend's message when the saved items are rate limited, and tries again on request", async () => {
    mockSignedIn()
    let attempt = 0
    const saved = makeResource({ title: 'Saved course' })
    mockApi('get', '/api/v1/saved', () => (++attempt === 1 ? limitResponse(makeRateLimited({ retryAfter: 30 })) : Response.json({ data: [saved] })))
    const { user } = await renderPage(<SavedPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please wait a moment and try again.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Saved course' })).toBeInTheDocument()
  })

  it('shows placeholders, not the sign-in prompt, while the session is loading', async () => {
    mockSessionLoading()
    await renderPage(<SavedPage />)
    expect(screen.queryByRole('heading', { name: 'Sign in to save resources' })).toBeNull()
  })

  describe('Cora chat panel', () => {
    it('offers comparison prompts and sends the saved resources as context', async () => {
      mockSignedIn()
      const saved = [makeResource(), makeResource()]
      mockApi('get', '/api/v1/saved', { data: saved })
      const chat = mockApi('post', '/api/v1/chat', () => sseResponse([delta('Do the first one.'), done()]))
      const { user } = await renderPage(<SavedPage />)
      await screen.findByRole('link', { name: saved[0].title })

      expect(screen.getByText(/Looking at a few different directions/)).toBeInTheDocument()
      for (const prompt of ['Compare these and recommend one to start', 'Am I missing anything important?', 'What order should I do these in?']) {
        expect(screen.getByRole('button', { name: prompt })).toBeInTheDocument()
      }
      await user.click(screen.getByRole('button', { name: 'What order should I do these in?' }))

      await waitFor(() => expect(screen.getByText('Do the first one.')).toBeInTheDocument())
      expect(JSON.parse(chat[0].body)).toMatchObject({ currentPage: 'SavedCourses', pageContextIds: saved.map(r => r.id) })
      expect(chat[0].headers.get('authorization')).toBe('Bearer access-token')
    })
  })
})
