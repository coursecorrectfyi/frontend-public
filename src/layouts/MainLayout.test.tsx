import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockSignedIn } from '@/test/mocks/next-auth'
import { expectMainLayout, iconButton, renderPage, settle } from '@/test/pages'
import MainLayout from './MainLayout'

// UI inventory: the header, footer and floating badge shared by every page.

afterEach(() => {
  vi.useRealTimers()
})

describe('MainLayout', () => {
  it('renders the page content between the shared header and footer', async () => {
    await renderPage(
      <MainLayout>
        <p>page content</p>
      </MainLayout>,
    )
    expect(screen.getByText('page content')).toBeInTheDocument()
    expectMainLayout()
  })

  describe('header', () => {
    it('shows the logo linking home', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      const logo = within(screen.getByRole('banner')).getByRole('img', { name: 'CourseCorrect Logo' })
      expect(logo.closest('a')).toHaveAttribute('href', '/')
    })

    it('links the blog in a new tab without dropping the referrer (for blog analytics)', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      const blog = within(screen.getByRole('banner')).getByRole('link', { name: 'Blog' })
      expect(blog).toHaveAttribute('target', '_blank')
      expect(blog).toHaveAttribute('rel', 'noopener')
    })

    it('marks the learning path link as NEW', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      const link = within(screen.getByRole('banner')).getByRole('link', { name: /Learning Path/ })
      expect(within(link).getByText('NEW')).toBeInTheDocument()
    })

    it('offers a search button with a keyboard shortcut on inner pages', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      const search = within(screen.getByRole('banner')).getByRole('button', { name: /Try a new topic/ })
      expect(search).toHaveTextContent(/Ctrl\+K|⌘K/)
    })

    it('does not show the header search on the home page (the hero has its own)', async () => {
      await renderPage(<MainLayout isHomePage>x</MainLayout>)
      expect(within(screen.getByRole('banner')).queryByRole('button', { name: /Try a new topic/ })).toBeNull()
    })

    it('shows a Google sign-in button when signed out', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      expect(iconButton('Google', screen.getByRole('banner'))).toBeEnabled()
    })

    it('shows the account menu (Saved Items, Logout) when signed in', async () => {
      mockSignedIn()
      const { user } = await renderPage(<MainLayout>x</MainLayout>)
      expect(within(screen.getByRole('banner')).queryByTestId('GoogleIcon')).toBeNull()

      await user.click(iconButton('Person', screen.getByRole('banner'))) // avatar fallback icon (no photo in session)
      const menu = screen.getByRole('menu')
      expect(within(menu).getByRole('menuitem', { name: 'Saved Items' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument()
    })

    it('has a light/dark mode toggle', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      expect(
        within(screen.getByRole('banner')).getByRole('button', { name: /Turn (on|off) the light/ }),
      ).toBeInTheDocument()
    })

    it('has a mobile menu that reveals the same navigation', async () => {
      const { user } = await renderPage(<MainLayout>x</MainLayout>)
      const menuButton = screen.getByRole('button', { name: 'Menu' })
      await user.click(menuButton)
      // The mobile list is a second copy of the nav links (the desktop bar is hidden by CSS on small screens).
      await waitFor(() => expect(screen.getAllByRole('link', { name: 'About Us' })).toHaveLength(2))
      expect(screen.getAllByRole('link', { name: 'Blog' })).toHaveLength(2)
      expect(screen.getAllByRole('link', { name: /Learning Path/ })).toHaveLength(2)
    })
  })

  describe('footer', () => {
    it('links the company and legal pages', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      expect(screen.getByRole('link', { name: 'About us' })).toHaveAttribute('href', '/about-us')
      expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact-us')
      expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
      expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy-policy')
      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
      expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    })

    it('credits the O*NET and BLS data sources', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      expect(screen.getByRole('link', { name: 'O*NET' })).toHaveAttribute('href', 'https://www.onetonline.org')
      expect(screen.getByRole('link', { name: 'BLS' })).toHaveAttribute('href', 'https://www.bls.gov/ooh/')
    })

    it('links every social profile in a new tab', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      for (const [name, href] of [
        ['YouTube', 'https://www.youtube.com/@CourseCorrectfyi'],
        ['LinkedIn', 'https://www.linkedin.com/company/coursecorrectfyi'],
        ['X', 'https://x.com/CoursecorrectX'],
        ['Pinterest', 'https://ca.pinterest.com/coursecorrectfyi'],
      ]) {
        const link = screen.getByRole('link', { name })
        expect(link).toHaveAttribute('href', href)
        expect(link).toHaveAttribute('target', '_blank')
      }
    })

    it('shows the copyright with the current year', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      expect(screen.getByText(new RegExp(`Copyright ©[\\s\\S]*${new Date().getFullYear()}`))).toBeInTheDocument()
    })
  })

  describe('Product Hunt badge', () => {
    it('appears shortly after load and links to the Product Hunt page', async () => {
      await renderPage(<MainLayout>x</MainLayout>)
      const badge = screen.getByRole('img', { name: /Product Hunt/ })
      expect(badge.closest('a')).toHaveAttribute('href', expect.stringContaining('producthunt.com/products/coursecorrect'))
    })

    it('can be hidden, stays hidden on the next visit, and can be shown again', async () => {
      const { user, unmount } = await renderPage(<MainLayout>x</MainLayout>)
      await user.click(iconButton('Close'))
      expect(screen.queryByRole('img', { name: /Product Hunt/ })).toBeNull()
      expect(localStorage.getItem('ph-badge-hidden')).toBe('true')

      unmount()
      await renderPage(<MainLayout>x</MainLayout>)
      expect(screen.queryByRole('img', { name: /Product Hunt/ })).toBeNull()

      await user.click(screen.getByText('P').closest('button')!)
      await settle()
      expect(screen.getByRole('img', { name: /Product Hunt/ })).toBeInTheDocument()
      expect(localStorage.getItem('ph-badge-hidden')).toBe('false')
    })
  })
})
