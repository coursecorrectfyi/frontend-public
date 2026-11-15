import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COURSE_PROVIDERS } from '@/utils/courseProviders'
import { getBaseUrl } from '@/utils/utils'
import { socialLinks, socialLinksOrdered } from './content/social'
import { SITE_URL } from './siteConfig'

const publicDir = join(process.cwd(), 'public')

describe('site URL', () => {
  it('is the canonical https apex domain without a trailing slash', () => {
    expect(SITE_URL).toBe('https://coursecorrect.fyi')
  })

  it('is the same value sitemaps use (the two constants must not drift apart)', () => {
    expect(getBaseUrl()).toBe(SITE_URL)
  })
})

describe('COURSE_PROVIDERS (home page logo strip)', () => {
  it('lists the five active providers once each', () => {
    expect(COURSE_PROVIDERS.map(p => p.name)).toEqual(['Coursera', 'edX', 'DataCamp', 'Udemy', 'Pluralsight'])
  })

  it.each(COURSE_PROVIDERS.flatMap(p =>
    [p.lightImage, p.darkImage, p.white].filter(Boolean).map(path => [p.name, path!] as const),
  ))('%s logo exists in public/: %s', (_name, path) => {
    expect(existsSync(join(publicDir, path))).toBe(true)
  })
})

describe('social links', () => {
  it('are https links, listed once each in display order', () => {
    expect(socialLinksOrdered).toEqual([socialLinks.youtube, socialLinks.linkedin, socialLinks.x, socialLinks.pinterest])
    for (const link of socialLinksOrdered) {
      expect(link.href).toMatch(/^https:\/\//)
      expect(link.label).toBeTruthy()
    }
  })
})
