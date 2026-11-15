import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import YouTubeChannelCarousel from './YouTubeChannelCarousel'

// Eight videos, shown three at a time.
const shownVideos = () => [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src')!.replace('https://www.youtube.com/embed/', ''))
const next = () => screen.getAllByTestId('ArrowForwardIosIcon')[0].closest('button')!
const previous = () => screen.getAllByTestId('ArrowBackIosNewIcon')[0].closest('button')!

describe('YouTubeChannelCarousel', () => {
  it('pages forward three at a time and wraps around to the start', async () => {
    const { user } = renderWithProviders(<YouTubeChannelCarousel />)
    const first = shownVideos()
    expect(first).toHaveLength(3)
    await user.click(next())
    const second = shownVideos()
    await user.click(next())
    const third = shownVideos()
    expect(third).toHaveLength(2) // the last two of eight
    expect(new Set([...first, ...second, ...third]).size).toBe(8)
    await user.click(next())
    expect(shownVideos()).toEqual(first)
  })

  it('going back from the start shows the last three videos', async () => {
    const { user } = renderWithProviders(<YouTubeChannelCarousel />)
    const all: string[] = []
    for (let i = 0; i < 3; i++) {
      all.push(...shownVideos())
      await user.click(next())
    }
    await user.click(previous())
    expect(shownVideos()).toEqual(all.slice(-3))
  })

  it('shows an optional title linking to the channel', () => {
    renderWithProviders(<YouTubeChannelCarousel title="CourseCorrect on YouTube" />)
    expect(screen.getByRole('link', { name: 'CourseCorrect on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@CourseCorrectfyi')
  })

  it('embeds each video with a descriptive title', () => {
    renderWithProviders(<YouTubeChannelCarousel />)
    for (const frame of document.querySelectorAll('iframe')) expect(frame.getAttribute('title')).toBeTruthy()
  })
})
