import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AboutLayout from './about-us/layout'
import ContactLayout from './contact-us/layout'
import LearningPathLayout from './get-learning-path/layout'
import PrivacyLayout from './privacy-policy/layout'
import SearchLayout from './search/layout'
import TermsLayout from './terms/layout'

// Route layouts only add <head> metadata (tested per page); they must render the page unchanged.

describe.each([
  ['about-us', AboutLayout],
  ['contact-us', ContactLayout],
  ['get-learning-path', LearningPathLayout],
  ['privacy-policy', PrivacyLayout],
  ['search', SearchLayout],
  ['terms', TermsLayout],
])('%s layout', (_name, Layout) => {
  it('renders the page as is', () => {
    render(<Layout><main>page</main></Layout>)
    expect(screen.getByRole('main')).toHaveTextContent('page')
  })
})
