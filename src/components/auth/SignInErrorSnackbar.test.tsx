import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import SignInErrorSnackbar from './SignInErrorSnackbar'

describe('SignInErrorSnackbar', () => {
  it('shows nothing without an error', () => {
    renderWithProviders(<SignInErrorSnackbar error={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the error as an alert that can be closed', async () => {
    const onClose = vi.fn()
    const { user } = renderWithProviders(<SignInErrorSnackbar error="Sign-in failed. Please try again." onClose={onClose} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed. Please try again.')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('stays open when the user clicks elsewhere (the message would be missed)', async () => {
    const onClose = vi.fn()
    const { user } = renderWithProviders(
      <>
        <button>elsewhere</button>
        <SignInErrorSnackbar error="Sign-in failed." onClose={onClose} />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
