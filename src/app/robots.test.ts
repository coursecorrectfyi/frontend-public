// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { SITE_URL } from '@/config/siteConfig'
import robots from './robots'

describe('robots.txt', () => {
  it('allows crawling, but not private or API routes', () => {
    expect(robots().rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/saved', '/api/'],
    })
  })

  it('points crawlers at the sitemap index on the canonical domain', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
