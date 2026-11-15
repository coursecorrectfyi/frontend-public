import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectMainLayout, renderPage } from '@/test/pages'
import { metadata } from './layout'
import ContactUs from './page'

// UI inventory: /contact-us.

describe('contact us page', () => {
  it('has its own title, description and canonical URL', () => {
    expect(metadata.title).toBe('Contact Us | CourseCorrect')
    expect(metadata.description).toBeTruthy()
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi/contact-us')
  })

  it('uses the main layout', async () => {
    await renderPage(<ContactUs />)
    expectMainLayout()
  })

  it('offers an email address', async () => {
    await renderPage(<ContactUs />)
    expect(screen.getByRole('heading', { name: "Let's Chat!" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'contact@example.com' })).toHaveAttribute('href', 'mailto:contact@example.com')
  })

  it('links the social channels and embeds two YouTube videos', async () => {
    const { container } = await renderPage(<ContactUs />)
    expect(screen.getByRole('heading', { name: 'Social Media' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'YouTube channel' })).toHaveAttribute('href', 'https://www.youtube.com/@CourseCorrectfyi')
    const iframes = [...container.querySelectorAll('iframe')]
    expect(iframes.map(f => f.getAttribute('src'))).toEqual([
      expect.stringMatching(/^https:\/\/www\.youtube\.com\/embed\/Q76b4CYLq5I/),
      expect.stringMatching(/^https:\/\/www\.youtube\.com\/embed\/9x4aD0eBt7A/),
    ])
  })

  it('has an FAQ with seven expandable questions', async () => {
    const { user } = await renderPage(<ContactUs />)
    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    const questions = screen.getAllByRole('button', { name: /CourseCorrect\.fyi/ })
    expect(questions).toHaveLength(7)
    await user.click(screen.getByRole('button', { name: /Is there a cost/ }))
    expect(screen.getByRole('button', { name: /Is there a cost/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/completely free to use/)).toBeVisible()
  })
})
