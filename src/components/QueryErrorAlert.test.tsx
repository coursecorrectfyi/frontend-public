import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { makeRateLimited } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import QueryErrorAlert, { errorText, isRetryable, NETWORK_ERROR_TEXT } from './QueryErrorAlert'

const texts = { notFound: 'Not here.', fallback: 'Something broke.' }
const rateLimited = new ApiError(429, 'Too many requests. Please wait a moment and try again.', makeRateLimited())

describe('errorText', () => {
  it.each<[string, unknown, string]>([
    ['not found', new ApiError(404, 'x'), 'Not here.'],
    ["rate limited: the backend's message", rateLimited, 'Too many requests. Please wait a moment and try again.'],
    ['no connection', new TypeError('Failed to fetch'), NETWORK_ERROR_TEXT],
    ['server error', new ApiError(500, 'x'), 'Something broke.'],
    ['other 4xx', new ApiError(400, 'x'), 'Something broke.'],
    ['not an HTTP error', new Error('bug'), 'Something broke.'],
  ])('%s', (_label, error, expected) => {
    expect(errorText(error, texts)).toBe(expected)
  })

  it('treats a 404 like any other error when there is no not-found text', () => {
    expect(errorText(new ApiError(404, 'x'), { fallback: 'Something broke.' })).toBe('Something broke.')
  })
})

describe('isRetryable', () => {
  it.each<[string, unknown, boolean]>([
    ['network error', new TypeError('Failed to fetch'), true],
    ['429', rateLimited, true],
    ['500', new ApiError(500, 'x'), true],
    ['503', new ApiError(503, 'x'), true],
    ['400', new ApiError(400, 'x'), false],
    ['401', new ApiError(401, 'x'), false],
    ['404', new ApiError(404, 'x'), false],
    ['a bug', new Error('x'), false],
  ])('%s → %s', (_label, error, expected) => {
    expect(isRetryable(error)).toBe(expected)
  })
})

describe('QueryErrorAlert', () => {
  it('offers "Try again" for a retryable error', async () => {
    const onRetry = vi.fn()
    const { user } = renderWithProviders(<QueryErrorAlert error={new ApiError(503, 'x')} {...texts} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('does not offer "Try again" when the same request would fail again', () => {
    renderWithProviders(<QueryErrorAlert error={new ApiError(404, 'x')} {...texts} onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Not here.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not offer "Try again" without a retry action', () => {
    renderWithProviders(<QueryErrorAlert error={new ApiError(503, 'x')} {...texts} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
