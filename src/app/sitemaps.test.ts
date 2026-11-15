import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allowConsole } from '@/test/console'
import { makeTopic } from '@/test/fixtures'
import { mockApi } from '@/test/msw'
import { parseXml, textOf } from '@/test/xml'
import { GET as sitemapIndex } from './sitemap.xml/route'
import { GET as staticSitemap } from './sitemap/static.xml/route'
import { GET as subjectsSitemap } from './sitemap/subjects.xml/route'

const NOW = new Date('2026-03-01T12:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('/sitemap.xml (index)', () => {
  it('lists the static, subjects and blog sitemaps on the canonical domain', async () => {
    const res = await sitemapIndex()
    expect(res.headers.get('content-type')).toBe('application/xml')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')

    const doc = parseXml(await res.text())
    expect(doc.documentElement.tagName).toBe('sitemapindex')
    expect(textOf(doc, 'loc')).toEqual([
      'https://coursecorrect.fyi/sitemap/static.xml',
      'https://coursecorrect.fyi/sitemap/subjects.xml',
      'https://coursecorrect.fyi/blog/sitemap.xml',
    ])
  })
})

describe('/sitemap/static.xml', () => {
  it('lists every static page with its priority', async () => {
    const res = await staticSitemap()
    expect(res.headers.get('content-type')).toBe('application/xml')

    const doc = parseXml(await res.text())
    expect(textOf(doc, 'loc')).toEqual([
      'https://coursecorrect.fyi/',
      'https://coursecorrect.fyi/get-learning-path',
      'https://coursecorrect.fyi/about-us',
      'https://coursecorrect.fyi/contact-us',
      'https://coursecorrect.fyi/privacy-policy',
      'https://coursecorrect.fyi/terms',
    ])
    expect(textOf(doc, 'priority')).toEqual(['1', '0.7', '0.6', '0.5', '0.3', '0.3'])
  })

  it('only lists pages that exist in the app', async () => {
    const doc = parseXml(await (await staticSitemap()).text())
    for (const loc of textOf(doc, 'loc')) {
      const path = new URL(loc).pathname.replace(/^\//, '')
      expect(existsSync(join(process.cwd(), 'src/app', path, 'page.tsx')), `page for ${loc}`).toBe(true)
    }
  })
})

describe('/sitemap/subjects.xml', () => {
  it('lists one URL per subject, dated now, cached for a week', async () => {
    mockApi('get', '/api/v1/subjects', [
      makeTopic({ name: 'Data Science', slug: 'data-science' }),
      makeTopic({ name: 'Python', slug: 'python' }),
    ])

    const res = await subjectsSitemap()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=604800')
    const doc = parseXml(await res.text())
    expect(textOf(doc, 'loc')).toEqual([
      'https://coursecorrect.fyi/subjects/data-science',
      'https://coursecorrect.fyi/subjects/python',
    ])
    expect(textOf(doc, 'lastmod')).toEqual([NOW.toISOString(), NOW.toISOString()])
  })

  it('answers 500 when the backend is unavailable (rather than an empty sitemap)', async () => {
    allowConsole('error', 'Error generating subjects sitemap')
    mockApi('get', '/api/v1/subjects', { error: 'x' }, { status: 503 })
    const res = await subjectsSitemap()
    expect(res.status).toBe(500)
  })

  // Subtopics in different domains can share a display name; each has its own page.
  it.fails('KNOWN BUG (B20): lists every subject slug, even when two subjects share a name', async () => {
    mockApi('get', '/api/v1/subjects', [
      makeTopic({ name: 'Fundamentals', slug: 'data-science-fundamentals' }),
      makeTopic({ name: 'Fundamentals', slug: 'marketing-fundamentals' }),
    ])
    const doc = parseXml(await (await subjectsSitemap()).text())
    expect(textOf(doc, 'loc')).toEqual([
      'https://coursecorrect.fyi/subjects/data-science-fundamentals',
      'https://coursecorrect.fyi/subjects/marketing-fundamentals',
    ])
  })
})
