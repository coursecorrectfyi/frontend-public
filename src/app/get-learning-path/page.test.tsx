import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allowConsole } from '@/test/console'
import { expectMainLayout, renderPage } from '@/test/pages'
import { metadata } from './layout'
import LearningPathPage from './page'

// UI inventory: /get-learning-path and its early-access modal.

describe('learning path page', () => {
  it('has its own title, description and canonical URL', () => {
    expect(metadata.title).toBe('Get a Personalized Learning Path | CourseCorrect')
    expect(metadata.description).toBeTruthy()
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi/get-learning-path')
  })

  it('pitches the feature with two calls to action', async () => {
    await renderPage(<LearningPathPage />)
    expectMainLayout()
    expect(screen.getByText(/Learning shouldn't feel/)).toBeInTheDocument()
    expect(screen.getByText('overwhelming')).toBeInTheDocument()
    for (const value of [
      'Where you stand today, in practical terms',
      'What skills are actually worth investing in next',
      'How your learning connects to the kind of work or life you want',
      "When taking a course makes sense and when it doesn't",
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Get My Personalized Learning Path' })).toHaveLength(2)
    expect(screen.getByText(/Free during early access/)).toBeInTheDocument()
  })

  it('walks through the early-access signup: intent → email → confirmation', async () => {
    // No Google Form configured in tests: the modal says so and confirms without submitting.
    allowConsole('warn', '[EarlyAccess] NEXT_PUBLIC_EARLY_ACCESS_* is not set')
    const { user } = await renderPage(<LearningPathPage />)

    await user.click(screen.getAllByRole('button', { name: 'Get My Personalized Learning Path' })[0])
    const dialog = await screen.findByRole('presentation')
    const modal = within(dialog)
    expect(modal.getByText('What best describes your next step?')).toBeInTheDocument()
    expect(modal.getAllByRole('radio')).toHaveLength(4)
    expect(modal.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(modal.getByRole('radio', { name: 'Switch careers' }))
    await user.click(modal.getByRole('button', { name: 'Continue' }))

    expect(modal.getByText("You're almost in.")).toBeInTheDocument()
    await user.type(modal.getByRole('textbox', { name: 'Email address' }), 'ada@example.com')
    await user.click(modal.getByRole('button', { name: 'Join Early Access' }))

    expect(await modal.findByText('Thanks for being part of this!')).toBeInTheDocument()
    expect(modal.getByRole('link', { name: 'continue exploring courses' })).toHaveAttribute('href', '/')
  })
})
