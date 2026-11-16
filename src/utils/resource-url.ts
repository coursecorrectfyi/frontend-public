import slugify from 'slugify'

/** URL slug of a resource title, e.g. "Python for Everybody" → "python-for-everybody". */
export function resourceSlug(title: string): string {
  return slugify(title, { lower: true, strict: true })
}

/**
 * The one canonical path of a resource detail page: `/learn/<slug of the title>/<UUID>`. Card links, the detail
 * page's redirect (legacy ids, stale slugs) and the canonical `<link>` all use it, so they always agree.
 */
export function resourcePath(resource: { id: string; title: string }): string {
  return `/learn/${resourceSlug(resource.title)}/${resource.id}`
}
