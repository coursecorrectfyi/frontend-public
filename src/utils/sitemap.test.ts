import { describe, expect, it } from 'vitest'
import { parseXml } from '@/test/xml'
import { generateUrlSet } from './sitemap'

/** Parses the sitemap like a crawler would (asserting well-formed XML). */
function parse(xml: string) {
  const doc = parseXml(xml)
  return [...doc.getElementsByTagName('url')].map(url => ({
    loc: url.getElementsByTagName('loc')[0]?.textContent,
    lastmod: url.getElementsByTagName('lastmod')[0]?.textContent,
    changefreq: url.getElementsByTagName('changefreq')[0]?.textContent ?? undefined,
    priority: url.getElementsByTagName('priority')[0]?.textContent ?? undefined,
  }))
}

describe('generateUrlSet', () => {
  it('produces a sitemaps.org urlset with one <url> per entry', () => {
    const xml = generateUrlSet([
      { loc: 'https://coursecorrect.fyi/', lastmod: '2026-04-05', changefreq: 'monthly', priority: 1 },
      { loc: 'https://coursecorrect.fyi/terms', lastmod: '2026-04-05', changefreq: 'yearly', priority: 0.3 },
    ])

    expect(xml.trim().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(parse(xml)).toEqual([
      { loc: 'https://coursecorrect.fyi/', lastmod: '2026-04-05', changefreq: 'monthly', priority: '1' },
      { loc: 'https://coursecorrect.fyi/terms', lastmod: '2026-04-05', changefreq: 'yearly', priority: '0.3' },
    ])
  })

  it('omits optional changefreq and priority when not given', () => {
    const xml = generateUrlSet([{ loc: 'https://coursecorrect.fyi/a', lastmod: '2026-01-01' }])
    expect(parse(xml)).toEqual([
      { loc: 'https://coursecorrect.fyi/a', lastmod: '2026-01-01', changefreq: undefined, priority: undefined },
    ])
  })

  it('produces a valid, empty urlset for no entries', () => {
    expect(parse(generateUrlSet([]))).toEqual([])
  })

  it.fails('KNOWN BUG (B20): escapes XML special characters in URLs', () => {
    // A query string with "&" is legal in a URL but must be written as &amp; in XML.
    const xml = generateUrlSet([{ loc: 'https://coursecorrect.fyi/search?q=a&sort=rating', lastmod: '2026-01-01' }])
    expect(parse(xml)[0].loc).toBe('https://coursecorrect.fyi/search?q=a&sort=rating')
  })

  it.fails('KNOWN BUG (B20): keeps a priority of 0 (a valid value meaning "lowest")', () => {
    const xml = generateUrlSet([{ loc: 'https://coursecorrect.fyi/a', lastmod: '2026-01-01', priority: 0 }])
    expect(parse(xml)[0].priority).toBe('0')
  })
})
