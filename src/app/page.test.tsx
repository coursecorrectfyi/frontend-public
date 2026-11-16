import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectMainLayout, renderPage } from '@/test/pages'
import Home from './page'

// UI inventory: the home page (/).

/** Videos the home page plays, in page order (README → "Static assets"). */
const DEMO_VIDEOS = ['/bg-video.mp4', '/search-a-topic.mp4', '/real-outcomes.mp4', '/overthinking-it.mp4']

describe('home page', () => {
  it('uses the main layout in home mode (no header search)', async () => {
    await renderPage(<Home />)
    expectMainLayout()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: /Try a new topic/ })).toBeNull()
  })

  it('leads with the value proposition and the search button', async () => {
    await renderPage(<Home />)
    expect(screen.getByRole('heading', { level: 2, name: 'Find the right course. Not just any course.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /compared and ranked for you/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Find your perfect course in 2 minutes/ })).toBeInTheDocument()
  })

  it('shows the logo of every supported provider', async () => {
    await renderPage(<Home />)
    for (const provider of ['Coursera', 'edX', 'DataCamp', 'Udemy', 'Pluralsight']) {
      expect(screen.getByRole('img', { name: `${provider} logo` })).toBeInTheDocument()
    }
  })

  it('links to the personalised learning path', async () => {
    await renderPage(<Home />)
    expect(screen.getByRole('link', { name: 'Get a personalized learning path' })).toHaveAttribute('href', '/get-learning-path')
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', '/get-learning-path')
  })

  it('explains how it works, with a demo video per step', async () => {
    const { container } = await renderPage(<Home />)
    for (const step of ['Search any topic, get the good stuff', 'Get verified data, not AI guesswork', 'Still unsure? Ask Cora.']) {
      expect(screen.getByRole('heading', { name: step })).toBeInTheDocument()
    }

    // The hero background video, then one demo video per step. This checks the markup that serves them, not that
    // the files exist, so the suite also runs on a copy without the large .mp4 files (README → "Static assets").
    const videos = [...container.querySelectorAll('video')] as HTMLVideoElement[]
    const sources = videos.map(video => [...video.querySelectorAll('source')].map(s => [s.getAttribute('src'), s.getAttribute('type')]))
    expect(sources).toEqual(
      DEMO_VIDEOS.map(src => [[src, 'video/mp4']]), // exactly one MP4 source each, served from the site root
    )
    for (const video of videos) {
      // Browsers only autoplay inline, muted videos (iOS Safari needs playsinline); all of them loop silently.
      expect(video.autoplay, 'autoplay').toBe(true)
      expect(video.muted, 'muted').toBe(true)
      expect(video.loop, 'loop').toBe(true)
      expect(video.hasAttribute('playsinline'), 'playsinline').toBe(true)
      expect(video.hasAttribute('controls'), 'controls').toBe(false)
    }
  })

  it('has the AI insights, ChatGPT comparison, testimonials and FAQ sections', async () => {
    await renderPage(<Home />)
    expect(screen.getByRole('heading', { name: /We show you what\s*most platforms don't/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'O*NET' }).length).toBeGreaterThanOrEqual(2) // callout + footer
    expect(screen.getByRole('heading', { name: /ChatGPT can name courses/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Real learners. Real decisions made.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Common Questions' })).toBeInTheDocument()
  })

  it('has an expandable FAQ linking to the full FAQ', async () => {
    const { user } = await renderPage(<Home />)
    const questions = ['Is CourseCorrect free?', 'Where does your course data come from?', "Can't I just ask ChatGPT or Copilot?", 'What is Cora?']
    for (const q of questions) expect(screen.getByRole('button', { name: q })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: 'What is Cora?' }))
    expect(screen.getByRole('button', { name: 'What is Cora?' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Visit our full FAQ/ })).toHaveAttribute('href', '/contact-us')
  })
})
