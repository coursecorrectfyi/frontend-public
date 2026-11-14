export function generateUrlSet(urls: Array<{
  loc: string,
  lastmod: string,
  changefreq?: string,
  priority?: number
}>) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls.map(url => `
        <url>
          <loc>${url.loc}</loc>
          <lastmod>${url.lastmod}</lastmod>
          ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
          ${url.priority ? `<priority>${url.priority}</priority>` : ''}
        </url>
      `).join('')}
    </urlset>`
}