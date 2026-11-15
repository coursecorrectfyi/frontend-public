import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LearningResource, ResourceType } from '@/types/resource'
import { makeResource, makeResourceDetail } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import ResourceCard from './ResourceCard'
import ResourceDetailPanel from './ResourceDetailPanel'

// Edge cases of the resource card and detail panel: missing data, unknown values, analytics.
// (Typical, complete data is covered by the search and learn page tests.)

const bare = (overrides: Partial<LearningResource> = {}) =>
  makeResource({
    institution: null, ai_summary: null, skills: null, career_paths: null, rating: null, num_ratings: null,
    duration_hours: null, level: null, is_free: null, has_certificate: null, is_self_paced: null, language: null,
    ...overrides,
  })

describe('ResourceCard', () => {
  it('renders a resource with only the required fields', () => {
    const resource = bare({ title: 'Bare Course', provider: 'udemy' })
    renderWithProviders(<ResourceCard resource={resource} />)
    expect(screen.getByRole('link', { name: 'Bare Course' })).toBeInTheDocument()
    expect(screen.getByText('udemy')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Stars/ })).toBeNull()
    for (const absent of ['Free', 'Certificate', 'Self-paced', 'Beginner']) expect(screen.queryByText(absent)).toBeNull()
  })

  it('shows the rating without a count when the count is unknown', () => {
    renderWithProviders(<ResourceCard resource={bare({ rating: 4 })} />)
    expect(screen.getByRole('img', { name: '4 Stars' })).toBeInTheDocument()
    expect(screen.queryByText(/^\(/)).toBeNull()
  })

  it('shows an unknown resource type as sent by the API', () => {
    renderWithProviders(<ResourceCard resource={bare({ resource_type: 'bootcamp' as ResourceType })} />)
    expect(screen.getByText('bootcamp')).toBeInTheDocument()
  })

  it('links to a clean, lower-case slug of the title', () => {
    const resource = bare({ title: 'C++ & Data: Analysis 101!' })
    renderWithProviders(<ResourceCard resource={resource} />)
    expect(screen.getByRole('link', { name: resource.title })).toHaveAttribute('href', `/learn/c-and-data-analysis-101/${resource.id}`)
  })

  it('tracks the result click with its position and source', async () => {
    const resource = bare({ title: 'Tracked' })
    const { user } = renderWithProviders(<ResourceCard resource={resource} position={3} clickSource="subject_page" />)
    const link = screen.getByRole('link', { name: 'Tracked' })
    link.addEventListener('click', e => e.preventDefault()) // stay on the page in jsdom
    await user.click(link)
    expect(window.dataLayer).toEqual([
      expect.objectContaining({ event: 'search_result_click', course_id: resource.id, course_name: 'Tracked', position: 3, source: 'subject_page' }),
    ])
  })

  it('tracks Enroll with its source and opens the provider', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const resource = bare({ url: 'https://www.udemy.com/course/x/' })
    const { user } = renderWithProviders(<ResourceCard resource={resource} enrollSource="saved_courses" />)
    await user.click(screen.getByText('Enroll').closest('button')!)
    expect(window.dataLayer).toEqual([
      expect.objectContaining({ event: 'enroll_click', course_id: resource.id, course_url: 'https://www.udemy.com/course/x/', source: 'saved_courses' }),
    ])
    expect(open).toHaveBeenCalledWith('https://www.udemy.com/course/x/', '_blank', 'noopener,noreferrer')
  })
})

describe('ResourceDetailPanel', () => {
  async function renderDetail(overrides: Parameters<typeof makeResourceDetail>[0] = {}) {
    const resource = makeResourceDetail({ title: 'Detail', ...overrides })
    mockApi('get', '/api/v1/resources/:id', resource)
    const utils = renderWithProviders(<ResourceDetailPanel resourceId={resource.id} urlSlug="detail" />)
    await screen.findByRole('heading', { level: 1 })
    return { ...utils, resource }
  }

  it.each([
    ['mixed', 'Mixed overall'],
    ['negative', 'Negative overall'],
  ] as const)('labels %s learner sentiment', async (sentiment, label) => {
    await renderDetail({
      ai_insights: { reviewInsights: { sentiment, pros: [], cons: [], representative_quotes: [] } },
    })
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows provider and language codes it has no label for as they are', async () => {
    await renderDetail({ provider: 'newprovider', institution: 'Acme', language: 'sw' })
    expect(screen.getByText('Acme · newprovider')).toBeInTheDocument()
    expect(screen.getByText('sw')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Enroll on newprovider' })).toBeInTheDocument()
  })

  it('uses the display name of known providers', async () => {
    await renderDetail({ provider: 'edx', institution: 'MIT' })
    expect(screen.getByText('MIT · edX')).toBeInTheDocument()
  })

  it('omits what the resource does not have (institution, rating, summary, skills)', async () => {
    await renderDetail({ institution: null, rating: null, ai_summary: null, skills: [], duration_hours: null, language: null })
    expect(screen.queryByText(/·/)).toBeNull()
    expect(screen.queryByRole('img', { name: /Stars/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: "What you'll learn" })).toBeNull()
    expect(screen.queryByRole('heading', { name: "Skills you'll gain" })).toBeNull()
  })

  it('shows career insights even when no job roles are listed', async () => {
    await renderDetail({
      ai_insights: { careerInsights: { job_roles: [], complementary_skills: ['Git'], growth_potential: 'Growing.' } },
    })
    const section = within(screen.getByRole('heading', { name: 'Where this takes you' }).parentElement!.parentElement!)
    expect(section.getByText('Git')).toBeInTheDocument()
    expect(section.getByText('Growing.')).toBeInTheDocument()
  })

  it('tracks Enroll as a detail-page enroll', async () => {
    const { user, resource } = await renderDetail({ provider: 'coursera' })
    const enroll = screen.getByRole('link', { name: 'Enroll on Coursera' })
    enroll.addEventListener('click', e => e.preventDefault())
    await user.click(enroll)
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'enroll_click', course_id: resource.id, source: 'course_detail' })])
  })
})
