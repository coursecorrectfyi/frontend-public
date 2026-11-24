import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL } from '@/config/content/contact'
import { expectMainLayout, renderPage } from '@/test/pages'
import { metadata } from './layout'
import Terms from './page'

// UI inventory: /terms.

describe('terms page', () => {
  it('has its own title, description and canonical URL', () => {
    expect(metadata.title).toBe('Terms of Use | CourseCorrect')
    expect(metadata.description).toBeTruthy()
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi/terms')
  })

  it('has every section of the terms', async () => {
    await renderPage(<Terms />)
    expectMainLayout()
    expect(screen.getByRole('heading', { name: 'Terms of Use' })).toBeInTheDocument()
    for (const section of [
      'Acceptance of Terms', 'Changes to These Terms', 'Use of Our Services', 'AI-Generated Content',
      'Affiliate Relationships', 'Third-Party Courses and Providers', 'User Accounts', 'Intellectual Property',
      'Disclaimer of Warranties', 'Limitation of Liability', 'Indemnification', 'Termination', 'Governing Law',
      'Contact Us', 'Entire Agreement',
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument()
    }
  })

  it('gives the contact email for questions about the terms (src/config/content/contact.ts)', async () => {
    await renderPage(<Terms />)
    expect(screen.getAllByText(new RegExp(CONTACT_EMAIL.replace('.', '\\.'))).length).toBeGreaterThan(0)
  })
})
