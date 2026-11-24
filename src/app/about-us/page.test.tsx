import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEAM_MEMBERS } from '@/config/content/team'
import { expectMainLayout, renderPage } from '@/test/pages'
import { metadata } from './layout'
import AboutUs from './page'

// UI inventory: /about-us.

describe('about us page', () => {
  it('has its own title, description and canonical URL', () => {
    expect(metadata.title).toBe('About Us | CourseCorrect')
    expect(metadata.description).toBeTruthy()
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi/about-us')
  })

  it('uses the main layout and offers a search', async () => {
    await renderPage(<AboutUs />)
    expectMainLayout()
    // Found by its visible text: its accessible name is wrong (B28, below).
    expect(screen.getByText('Find your perfect course in seconds...').closest('button')).toBeInTheDocument()
  })

  it.fails('KNOWN BUG (B28): the hero search button is announced with its own label, not the header one', async () => {
    // AppSearch labels its button via a hard-coded id (aria-labelledby="app-search-label"); with two instances
    // on the page the id is duplicated and both buttons are announced as the first one ("Try a new topic").
    await renderPage(<AboutUs />)
    expect(screen.queryByRole('button', { name: /Find your perfect course in seconds/ })).not.toBeNull()
  })

  it('presents what CourseCorrect offers', async () => {
    await renderPage(<AboutUs />)
    for (const h of ['Smart recommendations', 'In-depth reviews', 'Less searching']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
  })

  it('introduces the team', async () => {
    await renderPage(<AboutUs />)
    for (const { name } of TEAM_MEMBERS) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('has a YouTube carousel that pages through the videos', async () => {
    const { user } = await renderPage(<AboutUs />)
    expect(screen.getByRole('link', { name: 'CourseCorrect on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@CourseCorrectfyi')
    const firstPage = screen.getAllByTitle(/./).filter(el => el.tagName === 'IFRAME').map(el => el.getAttribute('title'))
    expect(firstPage).toHaveLength(3)

    // The carousel has two pairs of arrows (beside the videos on desktop, below them on mobile); use the first.
    const next = () => screen.getAllByTestId('ArrowForwardIosIcon')[0].closest('button')!
    const previous = () => screen.getAllByTestId('ArrowBackIosNewIcon')[0].closest('button')!
    expect(screen.getAllByTestId('ArrowForwardIosIcon')).toHaveLength(2)
    await user.click(next())
    const secondPage = screen.getAllByTitle(/./).filter(el => el.tagName === 'IFRAME').map(el => el.getAttribute('title'))
    expect(secondPage).toHaveLength(3)
    expect(secondPage).not.toEqual(firstPage)

    await user.click(previous())
    expect(screen.getAllByTitle(/./).filter(el => el.tagName === 'IFRAME').map(el => el.getAttribute('title'))).toEqual(firstPage)
  })

  it('shows testimonials', async () => {
    await renderPage(<AboutUs />)
    expect(screen.getByRole('heading', { name: 'Saved me so much time.' })).toBeInTheDocument()
  })
})
