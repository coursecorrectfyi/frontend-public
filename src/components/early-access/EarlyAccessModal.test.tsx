import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allowConsole } from '@/test/console'
import { router } from '@/test/mocks/next-navigation'
import { createGate, HttpResponse, http, mockApi, server } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import EarlyAccessModal from './EarlyAccessModal'

// The early-access signup for the learning path: intent → email → confirmation, submitted to a Google Form.

const FORM_URL = 'https://docs.google.com/forms/d/e/TEST/formResponse'

function configureForm() {
  vi.stubEnv('NEXT_PUBLIC_EARLY_ACCESS_FORM_URL', FORM_URL)
  vi.stubEnv('NEXT_PUBLIC_EARLY_ACCESS_INTENT_ENTRY_ID', 'entry.111')
  vi.stubEnv('NEXT_PUBLIC_EARLY_ACCESS_EMAIL_ENTRY_ID', 'entry.222')
}

/** Mocks the Google Form endpoint and records the submitted fields. */
function mockForm(respond: () => Promise<Response> | Response = () => new Response(null)) {
  const submissions: Array<Record<string, string>> = []
  server.use(
    http.post(FORM_URL, async ({ request }) => {
      submissions.push(Object.fromEntries((await request.formData()).entries()) as Record<string, string>)
      return respond()
    }),
  )
  return submissions
}

function renderModal(onClose = vi.fn(), open = true) {
  const utils = renderWithProviders(<EarlyAccessModal open={open} onClose={onClose} />)
  return { ...utils, onClose }
}

async function toEmailStep(user: ReturnType<typeof renderModal>['user'], intent = 'Switch careers') {
  await user.click(screen.getByRole('radio', { name: intent }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return screen.getByRole('textbox', { name: 'Email address' })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('EarlyAccessModal', () => {
  it('tracks that it was opened', () => {
    renderModal()
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'early_access_modal_open', source: 'get-learning-path' })])
  })

  it('offers four intents and continues only once one is chosen (tracked)', async () => {
    const { user } = renderModal()
    expect(screen.getAllByRole('radio').map(r => r.closest('label')?.textContent)).toEqual([
      'Grow in my current role or get better at what I do',
      'Switch careers',
      'Start something of my own (freelancer / founder)',
      "Explore options (I'm not sure yet)",
    ])
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await toEmailStep(user, 'Start something of my own (freelancer / founder)')
    expect(window.dataLayer.at(-1)).toMatchObject({ event: 'early_access_intent_selected', intent: 'start' })
  })

  describe('email validation', () => {
    it('asks for an email address', async () => {
      const { user } = renderModal()
      await toEmailStep(user)
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      expect(screen.getByText('Please enter your email address')).toBeInTheDocument()
    })

    it.each(['ada', 'ada@', 'ada@example', 'a da@example.com'])('rejects "%s"', async email => {
      const { user } = renderModal()
      const input = await toEmailStep(user)
      await user.type(input, email)
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })

    it('clears the error as soon as the user types', async () => {
      const { user } = renderModal()
      const input = await toEmailStep(user)
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      await user.type(input, 'a')
      expect(screen.queryByText('Please enter your email address')).toBeNull()
      expect(screen.getByText('No spam. Only updates about this feature.')).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('submits the intent and email to the configured form, tracks it and confirms', async () => {
      configureForm()
      const submissions = mockForm()
      const { user } = renderModal()
      const input = await toEmailStep(user)
      await user.type(input, 'ada@example.com')
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))

      expect(await screen.findByText('Thanks for being part of this!')).toBeInTheDocument()
      expect(submissions).toEqual([{ 'entry.111': 'switch', 'entry.222': 'ada@example.com' }])
      expect(window.dataLayer.at(-1)).toMatchObject({ event: 'early_access_signup', intent: 'switch' })
    })

    it('stays on the email step and explains a network failure', async () => {
      configureForm()
      allowConsole('error', 'Failed to submit early access signup')
      server.use(http.post(FORM_URL, () => HttpResponse.error()))
      const { user } = renderModal()
      await user.type(await toEmailStep(user), 'ada@example.com')
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))

      expect(await screen.findByText('Network error. Please check your connection and try again.')).toBeInTheDocument()
      expect(screen.queryByText('Thanks for being part of this!')).toBeNull()
      expect(window.dataLayer.map((e: { event: string }) => e.event)).not.toContain('early_access_signup')
    })

    it('submits an email pasted with surrounding spaces without them (email inputs are trimmed by the browser)', async () => {
      configureForm()
      const submissions = mockForm()
      const { user } = renderModal()
      await user.type(await toEmailStep(user), ' ada@example.com ')
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      await waitFor(() => expect(submissions).toEqual([{ 'entry.111': 'switch', 'entry.222': 'ada@example.com' }]))
    })

    it('confirms without submitting (and warns) when no form is configured', async () => {
      allowConsole('warn', '[EarlyAccess] NEXT_PUBLIC_EARLY_ACCESS_* is not set')
      const { user } = renderModal() // no form handler: a request would fail the test
      await user.type(await toEmailStep(user), 'ada@example.com')
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      expect(await screen.findByText('Thanks for being part of this!')).toBeInTheDocument()
    })

    it.fails('KNOWN BUG (B19): submits once even if "Join Early Access" is clicked twice', async () => {
      configureForm()
      const gate = createGate()
      const submissions = mockForm(async () => {
        await gate.wait()
        return new Response(null)
      })
      const { user } = renderModal()
      await user.type(await toEmailStep(user), 'ada@example.com')
      const join = screen.getByRole('button', { name: 'Join Early Access' })
      await user.click(join)
      await user.click(join)
      gate.open()
      await screen.findByText('Thanks for being part of this!')
      expect(submissions).toHaveLength(1)
    })
  })

  describe('after confirming', () => {
    it('closes and returns to the home page after 4 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      allowConsole('warn', '[EarlyAccess] NEXT_PUBLIC_EARLY_ACCESS_* is not set')
      const onClose = vi.fn()
      const { user } = renderWithProviders(<EarlyAccessModal open onClose={onClose} />, {
        userEventOptions: { advanceTimers: vi.advanceTimersByTime },
      })
      await user.type(await toEmailStep(user), 'ada@example.com')
      await user.click(screen.getByRole('button', { name: 'Join Early Access' }))
      await screen.findByText('Thanks for being part of this!')
      expect(screen.getByText('Redirecting to home page...')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(3_900)
      })
      expect(onClose).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(router.push).toHaveBeenCalledWith('/')
    })

    it('starts over when reopened', async () => {
      const onClose = vi.fn()
      const { user, rerender } = renderModal(onClose)
      await user.type(await toEmailStep(user), 'ada@example.com')

      rerender(<EarlyAccessModal open={false} onClose={onClose} />)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350)) // state resets after the close animation
      })
      rerender(<EarlyAccessModal open onClose={onClose} />)

      expect(await screen.findByText('What best describes your next step?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
      screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeChecked())
    })
  })
})
