/**
 * Helpers for page-level (route) tests.
 *
 *   const { user } = await renderPage(<ContactUs />)
 *   expectMainLayout()
 */
import { act, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { expect } from 'vitest'
import { allowConsole } from './console'
import { makeTopic } from './fixtures'
import { mockApi } from './msw'
import { renderWithProviders } from './render'

/** Subjects offered as suggestions by the header/home search box (GET /api/v1/subjects, fetched on mount). */
export const LAYOUT_SUBJECTS = [
  makeTopic({ name: 'Python', slug: 'python' }),
  makeTopic({ name: 'Data Science', slug: 'data-science' }),
]

/** Mocks the requests every page makes regardless of its content. */
export function mockLayoutApis() {
  return { subjects: mockApi('get', '/api/v1/subjects', LAYOUT_SUBJECTS) }
}

/** Lets effects, timers (e.g. the badge's 250 ms delay) and in-flight mocked requests settle. */
export async function settle(ms = 300) {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms))
  })
}

/**
 * Known, registered issues that print console warnings on pages that contain them. Allowing them explicitly (instead
 * of globally) keeps every other warning fatal. Remove an entry when its bug is fixed.
 */
export function allowKnownPageWarnings() {
  // B26: Chat's "New chat" IconButton is disabled inside a Tooltip.
  allowConsole('warn', 'You are providing a disabled `button` child to the Tooltip component')
}

export async function renderPage(ui: ReactElement) {
  const apis = mockLayoutApis()
  const rendered = renderWithProviders(ui)
  await settle()
  return { ...rendered, apis }
}

/** An icon-only button, found through its MUI icon (data-testid="<Name>Icon"). See B27 for why not by name. */
export function iconButton(iconName: string, container: HTMLElement = document.body): HTMLElement {
  const icon = within(container).getByTestId(`${iconName}Icon`)
  const button = icon.closest('button')
  expect(button, `${iconName} icon should be inside a button`).not.toBeNull()
  return button!
}

/** The header and footer every page shares (layouts/MainLayout). */
export function expectMainLayout() {
  const header = screen.getByRole('banner')
  const h = within(header)
  expect(h.getAllByRole('link').find(link => link.getAttribute('href') === '/')).toBeDefined() // logo → home
  expect(h.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about-us')
  expect(h.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', 'https://coursecorrect.fyi/blog')
  expect(h.getByRole('link', { name: /Learning Path/ })).toHaveAttribute('href', '/get-learning-path')

  expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
  expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact-us')
}
