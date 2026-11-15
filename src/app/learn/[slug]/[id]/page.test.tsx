import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LearningResourceDetail } from '@/types/resource'
import { makeResourceDetail } from '@/test/fixtures'
import { router } from '@/test/mocks/next-navigation'
import { delay, mockApi } from '@/test/msw'
import { allowKnownPageWarnings, expectMainLayout, iconButton, renderPage } from '@/test/pages'
import { delta, done, sseResponse } from '@/test/sse'
import LearnPage from './page'

// UI inventory: /learn/[slug]/[id] — the resource detail page and its Cora chat panel.

beforeEach(() => {
  allowKnownPageWarnings()
})

const resource: LearningResourceDetail = makeResourceDetail({
  title: 'Machine Learning Specialization',
  provider: 'coursera',
  institution: 'Stanford University',
  resource_type: 'program',
  level: 'intermediate',
  language: 'es',
  is_free: false,
  is_self_paced: true,
  has_certificate: true,
  duration_hours: 150,
  rating: 4.9,
  num_ratings: 25000,
  url: 'https://www.coursera.org/specializations/machine-learning-introduction',
  ai_summary: 'Build ML models with NumPy and scikit-learn.',
  skills: Array.from({ length: 14 }, (_, i) => `Skill ${i + 1}`),
  ai_insights: {
    careerInsights: {
      job_roles: [
        { title: 'Machine Learning Engineer', salary_range: '$120k–$180k', description: 'Builds ML systems.' },
        { title: 'Data Scientist', salary_range: '$100k–$150k', description: 'Analyses data.' },
      ],
      complementary_skills: ['Statistics', 'SQL'],
      growth_potential: 'Roles are projected to grow much faster than average.',
    },
    reviewInsights: {
      sentiment: 'positive',
      pros: ['Clear explanations'],
      cons: ['Math-heavy'],
      representative_quotes: ['Best ML course I have taken.'],
    },
  },
})

const SLUG = 'machine-learning-specialization'

async function renderLearn(slug = SLUG, id = resource.id) {
  return renderPage(await LearnPage({ params: Promise.resolve({ slug, id }) }))
}

describe('resource detail page', () => {
  it('uses the main layout', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    expectMainLayout()
  })

  it('shows a loading skeleton, then the resource', async () => {
    mockApi('get', '/api/v1/resources/:id', async () => {
      await delay(400)
      return Response.json(resource)
    })
    const { container } = await renderLearn()
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { level: 1, name: resource.title })).toBeInTheDocument()
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(0)
  })

  it('shows the header facts: institution, provider, rating and metadata chips', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.getByText('Stanford University · Coursera')).toBeInTheDocument()
    // Stars are drawn to the nearest half (4.9 → 5); the exact value is printed next to them.
    expect(screen.getByRole('img', { name: '5 Stars' })).toBeInTheDocument()
    expect(screen.getByText('4.9 (25,000)')).toBeInTheDocument()
    for (const chip of ['Program', 'Intermediate', 'Self-paced', 'Certificate', '~15 weeks', 'Spanish']) {
      expect(screen.getByText(chip)).toBeInTheDocument()
    }
    expect(screen.queryByText('Free')).toBeNull()
  })

  it('has an Enroll link to the provider (new tab) and a save button', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    const enroll = await screen.findByRole('link', { name: 'Enroll on Coursera' })
    expect(enroll).toHaveAttribute('href', resource.url)
    expect(enroll).toHaveAttribute('target', '_blank')
    expect(enroll).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(/You'll be taken to Coursera's website. CourseCorrect may earn a commission/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to save courses' })).toBeInTheDocument()
  })

  it('shows the AI summary and up to twelve skills', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    await screen.findByRole('heading', { name: "What you'll learn" })
    expect(screen.getByText(resource.ai_summary!)).toBeInTheDocument()
    expect(screen.getByText('AI-generated summary')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Skills you'll gain" })).toBeInTheDocument()
    expect(screen.getByText('Skill 12')).toBeInTheDocument()
    expect(screen.queryByText('Skill 13')).toBeNull()
  })

  it('shows career insights sourced from O*NET / BLS', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    const section = (await screen.findByRole('heading', { name: 'Where this takes you' })).parentElement!.parentElement!
    const s = within(section)
    expect(s.getByText('O*NET / BLS')).toBeInTheDocument()
    expect(s.getByText('Machine Learning Engineer')).toBeInTheDocument()
    expect(s.getByText('$120k–$180k')).toBeInTheDocument()
    expect(s.getByText('Builds ML systems.')).toBeInTheDocument()
    expect(s.getByText('Data Scientist')).toBeInTheDocument()
    expect(s.getByText('Pair with these skills')).toBeInTheDocument()
    expect(s.getByText('Statistics')).toBeInTheDocument()
    expect(s.getByText('Roles are projected to grow much faster than average.')).toBeInTheDocument()
    expect(s.getByText(/Career data is AI-generated/)).toBeInTheDocument()
  })

  it('shows what learners say: sentiment, pros, cons and quotes', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    const section = (await screen.findByRole('heading', { name: 'What learners say' })).parentElement!.parentElement!
    const s = within(section)
    expect(s.getByText('Positive overall')).toBeInTheDocument()
    expect(s.getByText('Pros')).toBeInTheDocument()
    expect(s.getByText('Clear explanations')).toBeInTheDocument()
    expect(s.getByText('Cons')).toBeInTheDocument()
    expect(s.getByText('Math-heavy')).toBeInTheDocument()
    expect(s.getByText('"Best ML course I have taken."')).toBeInTheDocument()
  })

  it('omits the insight sections when there are no AI insights', async () => {
    mockApi('get', '/api/v1/resources/:id', { ...resource, ai_insights: null })
    await renderLearn()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Where this takes you' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'What learners say' })).toBeNull()
  })

  it('shows an error when the resource cannot be loaded', async () => {
    mockApi('get', '/api/v1/resources/:id', { error: 'Not found' }, { status: 404 })
    await renderLearn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch resource')
  })

  it('replaces a legacy id or stale slug in the URL with the canonical one', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn('old-slug', '5f1b2c3d4e5f6a7b8c9d0e1f')
    await screen.findByRole('heading', { level: 1 })
    expect(router.replace).toHaveBeenCalledWith(`/learn/${SLUG}/${resource.id}`)
  })

  it('keeps the URL when it is already canonical', async () => {
    mockApi('get', '/api/v1/resources/:id', resource)
    await renderLearn()
    await screen.findByRole('heading', { level: 1 })
    expect(router.replace).not.toHaveBeenCalled()
  })

  describe('Cora chat panel', () => {
    it('offers resource-specific prompts', async () => {
      mockApi('get', '/api/v1/resources/:id', resource)
      await renderLearn()
      expect(screen.getByText(/Curious if this is the right fit for you/)).toBeInTheDocument()
      for (const prompt of ['Is this right for someone with my background?', 'How long will this realistically take?', 'What could I do after completing this?']) {
        expect(screen.getByRole('button', { name: prompt })).toBeInTheDocument()
      }
    })

    it('asks about this resource when a prompt is clicked', async () => {
      mockApi('get', '/api/v1/resources/:id', resource)
      const chat = mockApi('post', '/api/v1/chat', () => sseResponse([delta('Yes, it suits you.'), done()]))
      const { user } = await renderLearn()
      await user.click(screen.getByRole('button', { name: 'How long will this realistically take?' }))

      // Re-query inside waitFor: the answer is re-rendered (plain text while streaming → Markdown when done).
      await waitFor(() => expect(screen.getByText('Yes, it suits you.')).toBeInTheDocument())
      expect(chat).toHaveLength(1)
      expect(JSON.parse(chat[0].body)).toMatchObject({
        message: 'How long will this realistically take?',
        currentPage: 'CourseDetail',
        pageContextIds: [resource.id],
      })
      expect(iconButton('RestartAlt')).toBeEnabled() // "New chat" once there is a conversation
    })
  })
})
