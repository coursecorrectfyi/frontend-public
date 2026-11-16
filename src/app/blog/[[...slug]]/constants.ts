// Kept out of route.ts: a Next.js route file may only export HTTP handlers and route config.

/** Redirects to our own domain that the /blog proxy follows internally before handing the redirect to the browser. */
export const MAX_REDIRECTS = 5;
