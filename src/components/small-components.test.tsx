import { act, screen, within } from '@testing-library/react'
import { useColorScheme } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import SplitViewLayout from '@/layouts/SplitViewLayout'
import { setMediaQueryMatcher } from '@/test/browser'
import { renderWithProviders } from '@/test/render'
import CCLogo from './CCLogo'
import TwoToneHeading from './DualToneHeading'
import { FilterGroup } from './filters/FilterGroup'
import { SearchableFilterGroup } from './filters/SearchableFilterGroup'
import OptimizedVideo from './OptimizedVideo'
import GradientText from './typography/GradientText'
import YouTubeEmbed from './YouTubeEmbed'

describe('FilterGroup', () => {
  it('shows a titled checkbox per option, ticking the selected ones, and reports toggles', async () => {
    const onToggle = vi.fn()
    const { user } = renderWithProviders(<FilterGroup title="Level" options={['Beginner', 'Advanced']} selected={['Advanced']} onToggle={onToggle} />)
    expect(screen.getByText('Level')).toBeInTheDocument()
    expect(screen.getByLabelText('Beginner')).not.toBeChecked()
    expect(screen.getByLabelText('Advanced')).toBeChecked()
    await user.click(screen.getByLabelText('Beginner'))
    expect(onToggle).toHaveBeenCalledWith('Beginner')
  })
})

describe('SearchableFilterGroup', () => {
  it('narrows options case-insensitively and keeps selections while filtered', async () => {
    const { user } = renderWithProviders(
      <SearchableFilterGroup title="Provider" options={['Coursera', 'edX', 'DataCamp']} selected={['edX']} onToggle={vi.fn()} searchPlaceholder="Search providers..." />,
    )
    await user.type(screen.getByPlaceholderText('Search providers...'), 'EDX')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByLabelText('edX')).toBeChecked()
    await user.clear(screen.getByPlaceholderText('Search providers...'))
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('uses a default placeholder', () => {
    renderWithProviders(<SearchableFilterGroup title="T" options={[]} selected={[]} onToggle={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })
})

describe('SplitViewLayout', () => {
  it('shows chat and content side by side on desktop, with a resize handle', () => {
    const { container } = renderWithProviders(<SplitViewLayout leftContent={<p>chat</p>} rightContent={<p>content</p>} />)
    expect(screen.getByText('chat')).toBeVisible()
    expect(screen.getByText('content')).toBeVisible()
    expect(container.querySelector('[data-panel-resize-handle-id]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'chat' })).toBeNull()
  })

  it('on small screens shows the content, with the chat in a drawer behind a floating button', async () => {
    setMediaQueryMatcher(query => query.includes('max-width'))
    const { user } = renderWithProviders(<SplitViewLayout leftContent={<p>chat panel</p>} rightContent={<p>content</p>} />)
    await act(async () => {})
    expect(screen.getByText('content')).toBeVisible()
    const fab = screen.getByRole('button', { name: 'chat' })
    await user.click(fab)
    expect(within(await screen.findByRole('presentation')).getByText('chat panel')).toBeInTheDocument()
    await user.click(fab) // toggles closed
  })
})

describe('CCLogo', () => {
  it('links home and switches to the white logo in dark mode', () => {
    let setMode!: (mode: 'light' | 'dark') => void
    function Probe() {
      setMode = useColorScheme().setMode as never
      return null
    }
    renderWithProviders(<><Probe /><CCLogo /></>)
    const logo = screen.getByRole('img', { name: 'CourseCorrect Logo' })
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(logo.getAttribute('src')).toMatch(/logo-white\.svg$/) // dark by default
    act(() => setMode('light'))
    expect(screen.getByRole('img', { name: 'CourseCorrect Logo' }).getAttribute('src')).toMatch(/logo-original\.svg$/)
  })
})

describe('presentational helpers', () => {
  it('TwoToneHeading renders both parts of the heading', () => {
    renderWithProviders(<TwoToneHeading primary="Learning shouldn't feel" secondary="overwhelming" />)
    expect(screen.getByText(/Learning shouldn't feel/)).toBeInTheDocument()
    expect(screen.getByText('overwhelming')).toBeInTheDocument()
  })

  it('GradientText renders its text', () => {
    renderWithProviders(<GradientText>Not just any course.</GradientText>)
    expect(screen.getByText('Not just any course.')).toBeInTheDocument()
  })

  it('OptimizedVideo autoplays muted, looping and inline (required for mobile autoplay)', () => {
    const { container } = renderWithProviders(<OptimizedVideo src="/search-a-topic.mp4" alt="Searching a topic" />)
    const video = container.querySelector('video')!
    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(container.querySelector('source')).toHaveAttribute('src', '/search-a-topic.mp4')
  })

  it('YouTubeEmbed embeds the video with a title and full-screen allowed', () => {
    const { container } = renderWithProviders(<YouTubeEmbed videoId="abc123" title="A video" />)
    const frame = container.querySelector('iframe')!
    expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/abc123')
    expect(frame).toHaveAttribute('title', 'A video')
    expect(frame).toHaveAttribute('allowfullscreen')
  })
})

