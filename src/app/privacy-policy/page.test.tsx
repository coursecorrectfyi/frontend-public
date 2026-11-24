import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL } from '@/config/content/contact'
import { expectMainLayout, renderPage } from '@/test/pages'
import { metadata } from './layout'
import PrivacyPolicy from './page'

// UI inventory: /privacy-policy.

describe('privacy policy page', () => {
  it('has its own title, description and canonical URL', () => {
    expect(metadata.title).toBe('Privacy Policy | CourseCorrect')
    expect(metadata.description).toBeTruthy()
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi/privacy-policy')
  })

  it('has every section of the policy', async () => {
    await renderPage(<PrivacyPolicy />)
    expectMainLayout()
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    for (const section of [
      'Information We Collect', 'Cora Chat Messages', 'How We Use Your Information', 'Third-Party Data Sharing',
      'Cookies and Tracking', 'GDPR — Rights for Users in the European Union', 'California Privacy Rights (CCPA)',
      'Data Security', "Children's Privacy", 'Changes to This Policy', 'Contact Us',
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument()
    }
  })

  it('gives the contact email for data requests and questions (src/config/content/contact.ts)', async () => {
    await renderPage(<PrivacyPolicy />)
    expect(screen.getAllByText(new RegExp(CONTACT_EMAIL.replace('.', '\\.'))).length).toBeGreaterThan(0)
  })
})
