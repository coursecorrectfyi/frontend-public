import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import GoogleTagManager from '@/components/analytics/GoogleTagManager'
import PageViewTracker from '@/components/analytics/PageViewTracker'
import { setPathname, setSearchParams } from '@/test/mocks/next-navigation'
import RootLayout, { metadata } from './layout'

// The root layout: site-wide metadata, providers, analytics.

describe('root layout', () => {
  it('declares the site title, description and canonical URL', () => {
    expect(metadata.title).toBe('CourseCorrect — Find the Right Course, Not Just Any Course')
    expect(metadata.description).toMatch(/Coursera, edX, DataCamp, Udemy, and Pluralsight/)
    expect(metadata.metadataBase?.toString()).toBe('https://coursecorrect.fyi/')
    expect(metadata.alternates?.canonical).toBe('https://coursecorrect.fyi')
  })

  it('declares Open Graph and Twitter cards with the share image', () => {
    expect(metadata.openGraph).toMatchObject({ type: 'website', siteName: 'coursecorrect.fyi', url: 'https://coursecorrect.fyi' })
    expect(metadata.openGraph?.images).toEqual([expect.objectContaining({ url: '/images/og-image-light.jpg', width: 1200, height: 630 })])
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: ['/images/og-image-light.jpg'] })
  })

  it('renders an English document with the page inside the providers', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>page body</main>
      </RootLayout>,
    )
    expect(html).toMatch(/^<html lang="en"/)
    expect(html).toContain('<meta name="viewport" content="initial-scale=1, width=device-width"/>')
    expect(html).toContain('<main>page body</main>')
    // Dark mode by default, applied before hydration to avoid a flash.
    expect(html).toContain('data-mui-color-scheme')
  })

})

describe('GoogleTagManager', () => {
  it('loads nothing outside production', () => {
    const { container } = render(<GoogleTagManager />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads the GTM container in production, with a no-script fallback', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_GTM_ID', 'GTM-PROD1')
    vi.resetModules()
    const { default: ProductionGtm } = await import('@/components/analytics/GoogleTagManager')
    const { container } = render(<ProductionGtm />)
    const script = container.querySelector('script#gtm-script')!
    expect(script.innerHTML).toContain("'dataLayer','GTM-PROD1'")
    expect(script.innerHTML).toContain('https://www.googletagmanager.com/gtm.js?id=')
    expect(container.querySelector('noscript')).not.toBeNull()
  })
})

describe('PageViewTracker', () => {
  it('reports a page view for the home page', () => {
    setPathname('/')
    render(<PageViewTracker />)
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'page_view', page_name: 'home' })])
  })

  it('names other pages by their path and includes the search query', () => {
    setPathname('/search')
    setSearchParams({ q: 'sql' })
    render(<PageViewTracker />)
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: 'page_view', page_name: 'search', search_query: 'sql' })])
  })

  it('reports again when the user navigates', () => {
    setPathname('/about-us')
    const { rerender } = render(<PageViewTracker />)
    setPathname('/terms')
    rerender(<PageViewTracker />)
    expect(window.dataLayer.map((e: { page_name: string }) => e.page_name)).toEqual(['about-us', 'terms'])
  })
})
