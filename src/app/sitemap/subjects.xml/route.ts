import { getSubjects, type Subject } from '@/api/subjects'
import { relayHeaders } from '@/lib/server/relay'
import { getBaseUrl } from '@/utils/utils'

export async function GET() {
  const baseUrl = getBaseUrl()

  try {
    // Relayed for the requester (usually a crawler), like every call the server makes for a visitor.
    const subjects = await getSubjects({ headers: await relayHeaders() })
    const currentDate = new Date().toISOString()

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${subjects.map((subject: Subject) => `
          <url>
            <loc>${baseUrl}/subjects/${subject.slug}</loc>
            <lastmod>${currentDate}</lastmod>
            <changefreq>monthly</changefreq>
            <priority>0.8</priority>
          </url>
        `).join('')}
      </urlset>`,
      {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=604800' // Cache for 7 days
        },
      }
    )
  } catch (error) {
    console.error('Error generating subjects sitemap:', error)
    return new Response('Error generating sitemap', { status: 500 })
  }
}
