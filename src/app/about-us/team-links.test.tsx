import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderPage } from '@/test/pages'
import AboutUs from './page'

// The public team data has no profile links; production's (src/config/content/team.ts, replaced at deploy) does.
vi.mock('@/config/content/team', () => ({
  TEAM_MEMBERS: [
    { name: 'Linked Member', designation: 'Role A', description: 'd', experience: 'e', image: '/a.png', profileLink: 'https://example.com/linked' },
    { name: 'Unlinked Member', designation: 'Role B', description: 'd', experience: 'e', image: '/b.png' },
  ],
}))

describe('About Us team cards', () => {
  it('links a member who has a profile link, in a new tab', async () => {
    await renderPage(<AboutUs />)
    const link = screen.getByRole('heading', { name: 'Linked Member' }).closest('a')
    expect(link).toHaveAttribute('href', 'https://example.com/linked')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it("doesn't link a member without one", async () => {
    await renderPage(<AboutUs />)
    const card = screen.getByRole('heading', { name: 'Unlinked Member' })
    expect(card.closest('a')).toBeNull()
    expect(within(card.parentElement!).queryByRole('link')).toBeNull()
  })
})
