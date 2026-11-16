import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allowConsole } from '@/test/console'
import { createGate, mockApi } from '@/test/msw'
import { makeBackendTokens } from '@/test/fixtures'
import { firebase } from '@/test/mocks/firebase'
import { mockSignedIn, nextAuth, setSession } from '@/test/mocks/next-auth'
import { router } from '@/test/mocks/next-navigation'
import { iconButton } from '@/test/pages'
import { renderWithProviders } from '@/test/render'
import AuthButton from './AuthButton'

// The header's sign-in button / account menu.

describe('AuthButton', () => {
  it('signs in with Google and is disabled while signing in', async () => {
    const gate = createGate()
    mockApi('post', '/api/v1/auth/firebase/login', async () => {
      await gate.wait()
      return Response.json(makeBackendTokens())
    })
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Google'))
    await waitFor(() => expect(iconButton('Google')).toBeDisabled())
    gate.open()
    await waitFor(() => expect(nextAuth.signIn).toHaveBeenCalled())
    await waitFor(() => expect(iconButton('Google')).toBeEnabled())
  })

  it('explains a failed sign-in', async () => {
    allowConsole('error', 'Firebase sign-in failed')
    mockApi('post', '/api/v1/auth/firebase/login', { error: 'Verify your email address before signing in', code: 'email_not_verified' }, { status: 403 })
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Google'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please verify your email address first')
  })

  it('offers sign-in for a session that lost its backend tokens (it is ending)', () => {
    setSession({ user: {}, expires: '2999-01-01T00:00:00.000Z' }, 'authenticated')
    renderWithProviders(<AuthButton />)
    expect(iconButton('Google')).toBeInTheDocument()
  })

  it("shows the user's photo when the session has one", () => {
    const session = mockSignedIn()
    session.user = { name: 'Ada', image: 'https://example.com/ada.png' }
    renderWithProviders(<AuthButton />)
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveAttribute('src', 'https://example.com/ada.png')
  })

  it('opens the saved items from the account menu', async () => {
    mockSignedIn()
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Person'))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Saved Items' }))
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/saved/))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('goes straight to /saved (not the legacy /saved-courses, which redirects)', async () => {
    mockSignedIn()
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Person'))
    await user.click(screen.getByRole('menuitem', { name: 'Saved Items' }))
    expect(router.push).toHaveBeenCalledWith('/saved')
  })

  it('logs out of NextAuth', async () => {
    mockSignedIn()
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Person'))
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }))
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalled())
  })

  it('signs out of Firebase for users whose provider is "firebase", and still logs out if that fails', async () => {
    allowConsole('error', 'Firebase signOut')
    mockSignedIn({ user: { provider: 'firebase' } })
    firebase.signOutFirebase.mockRejectedValueOnce(new Error('network'))
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Person'))
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }))
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalled())
    expect(firebase.signOutFirebase).toHaveBeenCalled()
  })

  // The backend sends user.provider "google" (docs/backend-api.md → login response); the code used to check for
  // "firebase" and never signed out of Firebase (B2).
  it('also signs out of Firebase on logout', async () => {
    mockSignedIn() // provider: 'google', as the backend sends it
    const { user } = renderWithProviders(<AuthButton />)
    await user.click(iconButton('Person'))
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }))
    await waitFor(() => expect(nextAuth.signOut).toHaveBeenCalled())
    expect(firebase.signOutFirebase).toHaveBeenCalled()
  })
})
