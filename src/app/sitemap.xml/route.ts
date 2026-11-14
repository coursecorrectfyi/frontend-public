import { getBaseUrl } from "@/utils/utils"

export async function GET() {
  const baseUrl = getBaseUrl()

  // TODO: Add sitemap/resources.xml?p=1..n entries here once the resources sitemap endpoint is built.
  // Each page covers up to 5,000 resources; page count should be fetched from GET /api/v1/resources/sitemap/meta.
  // See F11.3 in IMPLEMENTATION.md.

  const sitemapUrls = [
    {
      loc: `${baseUrl}/sitemap/static.xml`,
      lastmod: '2026-04-05' // update when static pages change
    },
    {
      loc: `${baseUrl}/sitemap/subjects.xml`,
      lastmod: new Date().toISOString() // dynamic: reflects current subject catalogue
    },
    {
      loc: `${baseUrl}/blog/sitemap.xml`,
      lastmod: new Date().toISOString() // managed by WordPress
    }
  ]

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${sitemapUrls.map(sitemap => `
        <sitemap>
          <loc>${sitemap.loc}</loc>
          <lastmod>${sitemap.lastmod}</lastmod>
        </sitemap>
      `).join('')}
    </sitemapindex>`,
    {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400' // Cache the index for 24 hours
      },
    }
  )
}