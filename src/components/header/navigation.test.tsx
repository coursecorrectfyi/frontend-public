import { screen, waitFor, within } from '@testing-library/react'
import { useColorScheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { router } from '@/test/mocks/next-navigation'
import { renderWithProviders } from '@/test/render'
import HeaderNavBar from './HeaderNavBar'
import HeaderNavDropdown from './HeaderNavDropdown'
import { navigationItems } from './navigationItems'
import ThemeModeToggle from './ThemeModeToggle'

describe('navigationItems', () => {
  it('lists About Us, Blog (external) and the new Learning Path page', () => {
    expect(navigationItems).toEqual([
      { title: 'About Us', href: '/about-us' },
      { title: 'Blog', href: 'https://coursecorrect.fyi/blog', isExternal: true, rel: 'noopener' },
      { title: 'Learning Path', href: '/get-learning-path', isNew: true },
    ])
  })
})

describe('HeaderNavBar (desktop)', () => {
  it('navigates to the learning path client-side and tracks the click', async () => {
    const { user } = renderWithProviders(<HeaderNavBar />)
    await user.click(screen.getByRole('link', { name: /Learning Path/ }))
    expect(router.push).toHaveBeenCalledWith('/get-learning-path')
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'learning_path_cta_click', source: 'header' })])
  })

  it('leaves ordinary links alone (no tracking, no client-side push)', async () => {
    const { user } = renderWithProviders(<HeaderNavBar />)
    const about = screen.getByRole('link', { name: 'About Us' })
    expect(about).toHaveAttribute('href', '/about-us')
    expect(about).not.toHaveAttribute('target')
    await user.click(about)
    expect(router.push).not.toHaveBeenCalled()
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('HeaderNavDropdown (mobile)', () => {
  it('opens and closes with the menu button', async () => {
    const { user } = renderWithProviders(<HeaderNavDropdown />)
    const menu = screen.getByRole('button', { name: 'Menu' })
    await user.click(menu)
    await waitFor(() => expect(screen.getByRole('link', { name: 'About Us' })).toBeVisible())
    await user.click(menu)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'About Us' })).toBeNull()) // hidden links are excluded
  })

  it('closes when tapping elsewhere', async () => {
    const { user } = renderWithProviders(
      <>
        <p>elsewhere</p>
        <HeaderNavDropdown />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'About Us' })).toBeVisible())
    await user.click(screen.getByText('elsewhere'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'About Us' })).toBeNull()) // hidden links are excluded
  })

  it('tracks the learning path link with its own source', async () => {
    const { user } = renderWithProviders(<HeaderNavDropdown />)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(await screen.findByRole('link', { name: /Learning Path/ }))
    expect(router.push).toHaveBeenCalledWith('/get-learning-path')
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'learning_path_cta_click', source: 'header-mobile' })])
  })

  it('opens the blog in a new tab', async () => {
    const { user } = renderWithProviders(<HeaderNavDropdown />)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByRole('link', { name: 'Blog' })).toHaveAttribute('target', '_blank')
  })
})

describe('ThemeModeToggle', () => {
  function ModeProbe() {
    return <span data-testid="mode">{useColorScheme().mode}</span>
  }

  it('switches between dark (the default) and light mode', async () => {
    const { user } = renderWithProviders(
      <>
        <ModeProbe />
        <ThemeModeToggle />
      </>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    await user.click(screen.getByRole('button', { name: 'Turn on the light' }))
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    expect(within(screen.getByRole('button', { name: 'Turn off the light' })).getByTestId('DarkModeOutlinedIcon')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Turn off the light' }))
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
  })

  it('remembers the choice for the next visit', async () => {
    const { user } = renderWithProviders(<ThemeModeToggle />)
    await user.click(screen.getByRole('button', { name: 'Turn on the light' }))
    expect(Object.values({ ...localStorage })).toContain('light')
  })
})
