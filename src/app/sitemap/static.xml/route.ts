import { generateUrlSet } from "@/utils/sitemap"
import { getBaseUrl } from "@/utils/utils"

export async function GET() {
  const baseUrl = getBaseUrl()
  const staticPages = [
    { path: '', priority: 1.0, changefreq: 'monthly', lastmod: '2026-04-05' },
    { path: 'get-learning-path', priority: 0.7, changefreq: 'monthly', lastmod: '2026-04-05' },
    { path: 'about-us', priority: 0.6, changefreq: 'monthly', lastmod: '2026-04-05' },
    { path: 'contact-us', priority: 0.5, changefreq: 'monthly', lastmod: '2026-04-05' },
    { path: 'privacy-policy', priority: 0.3, changefreq: 'yearly', lastmod: '2026-04-05' },
    { path: 'terms', priority: 0.3, changefreq: 'yearly', lastmod: '2026-04-05' },
  ]

  return new Response(
    generateUrlSet(staticPages.map(page => ({
      loc: `${baseUrl}/${page.path}`,
      lastmod: page.lastmod,
      changefreq: page.changefreq,
      priority: page.priority
    }))),
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      },
    }
  )
}