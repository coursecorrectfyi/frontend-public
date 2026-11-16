import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { firebase } from '@/test/mocks/firebase'
import { mockSessionLoading, mockSignedIn, nextAuth, setSession } from '@/test/mocks/next-auth'
import { renderWithProviders } from '@/test/render'
import SessionGuard, { SESSION_ENDED_MESSAGE } from './SessionGuard'

// A session whose backend tokens were dropped (refresh token rejected, docs/backend-api.md → refresh 401) is ended,
// so the app never looks signed in while every call fails.

describe('SessionGuard', () => {
  it('signs out a session that has lost its backend tokens, and says so', async () => {
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    renderWithProviders(<SessionGuard />)
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalledWith({ redirect: false })) // stay on the page
    expect(firebase.signOutFirebase).toHaveBeenCalled()
    expect(await screen.findByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
  })

  it('lets the user close the message', async () => {
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    const { user } = renderWithProviders(<SessionGuard />)
    await screen.findByText(SESSION_ENDED_MESSAGE)
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText(SESSION_ENDED_MESSAGE)).toBeNull())
  })

  it.each([
    ['a signed-in session', () => mockSignedIn()],
    ['no session', () => {}],
    ['a session still loading', () => mockSessionLoading()],
  ])('leaves %s alone', async (_label, arrange) => {
    arrange()
    renderWithProviders(<SessionGuard />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(nextAuth.signOut).not.toHaveBeenCalled()
    expect(screen.queryByText(SESSION_ENDED_MESSAGE)).toBeNull()
  })

  it('still signs out of the app when the Firebase sign-out fails', async () => {
    firebase.signOutFirebase.mockRejectedValueOnce(new Error('network'))
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    renderWithProviders(<SessionGuard />)
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalled())
  })
})
