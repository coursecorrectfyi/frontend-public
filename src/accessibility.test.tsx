import { screen, within } from '@testing-library/react'
import { computeAccessibleName } from 'dom-accessibility-api'
import { beforeEach, describe, expect, it } from 'vitest'
import AboutUs from '@/app/about-us/page'
import Search from '@/app/search/page'
import SubjectPage from '@/app/subjects/[slug]/page'
import { makeResource, makeSearchResponse, makeSubtopicDetail } from '@/test/fixtures'
import { mockSignedIn } from '@/test/mocks/next-auth'
import { setSearchParams } from '@/test/mocks/next-navigation'
import { mockApi } from '@/test/msw'
import { allowKnownPageWarnings, renderPage } from '@/test/pages'

// Accessibility checks across pages: every control must have an accessible name that matches its visible label.
// (Screen readers announce unnamed icon buttons as just "button".)

beforeEach(() => {
  allowKnownPageWarnings()
})

const unnamedButtons = () =>
  screen.queryAllByRole('button').filter(button => computeAccessibleName(button).trim() === '')
/** Names of the MUI icons inside unnamed buttons, to make failures readable. */
const describeButtons = (buttons: HTMLElement[]) =>
  buttons.map(b => b.querySelector('[data-testid]')?.getAttribute('data-testid') ?? b.outerHTML.slice(0, 60))

async function renderSearch() {
  setSearchParams({ q: 'python' })
  mockApi('get', '/api/v1/resources/search', makeSearchResponse({ data: [makeResource({ title: 'Python A' })] }))
  const page = await renderPage(<Search />)
  await screen.findByText('Python A')
  return page
}

describe('accessible names (B27)', () => {
  it.fails('KNOWN BUG (B27): every button on the search page has an accessible name', async () => {
    // Unnamed today: header sign-in (Google icon), Product Hunt "hide" (Close icon), chat Send.
    await renderSearch()
    expect(describeButtons(unnamedButtons())).toEqual([])
  })

  it.fails('KNOWN BUG (B27): the filters drawer close button has an accessible name', async () => {
    const { user } = await renderSearch()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(describeButtons(within(screen.getByRole('presentation')).getAllByRole('button').filter(b => !computeAccessibleName(b).trim()))).toEqual([])
  })

  it.fails('KNOWN BUG (B27): the Enroll button is announced as "Enroll" (WCAG 2.5.3, label in name)', async () => {
    // MUI's Tooltip replaces the button's name with the tooltip text ("You'll be redirected to ...").
    await renderSearch()
    expect(computeAccessibleName(screen.getByText('Enroll').closest('button')!)).toMatch(/Enroll/)
  })

  it.fails('KNOWN BUG (B27): the YouTube carousel arrows have accessible names', async () => {
    await renderPage(<AboutUs />)
    const arrows = [...screen.getAllByTestId('ArrowForwardIosIcon'), ...screen.getAllByTestId('ArrowBackIosNewIcon')]
      .map(icon => icon.closest('button')!)
    expect(arrows.map(b => computeAccessibleName(b)).filter(name => !name.trim())).toEqual([])
  })

  it.fails('KNOWN BUG (B27): the subject breadcrumb is a labelled navigation landmark', async () => {
    mockApi('get', '/api/v1/subjects/:slug', makeSubtopicDetail({ name: 'Pandas' }, { name: 'Data Science', slug: 'data-science' }))
    mockApi('get', '/api/v1/resources/search', makeSearchResponse())
    await renderPage(await SubjectPage({ params: Promise.resolve({ slug: 'pandas' }) }))
    await screen.findByRole('heading', { level: 1, name: 'Pandas' })
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeNull()
  })

  it.fails('KNOWN BUG (B27): the signed-in account menu button has an accessible name', async () => {
    mockSignedIn()
    mockApi('get', '/api/v1/saved', { data: [] }) // signed-in save buttons load the saved list
    await renderSearch()
    const account = within(screen.getByRole('banner')).getByTestId('PersonIcon').closest('button')!
    expect(computeAccessibleName(account)).not.toBe('')
  })
})
