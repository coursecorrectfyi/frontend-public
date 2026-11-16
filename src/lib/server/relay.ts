import 'server-only';

import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { isIP } from 'node:net';

/**
 * Relay headers for backend calls the Next.js server makes on a visitor's behalf (server rendering, sitemaps,
 * NextAuth token refresh and logout). Contract: docs/backend-api.md → "Calls from a server on a visitor's behalf".
 *
 * With both headers the backend counts the call against the visitor's own limits; without them, against this
 * server's IP, shared by every visitor. Missing headers are never an error: the call still works.
 *
 * SECURITY: `API_RELAY_SECRET` lets whoever has it claim any visitor IP and get around every per-visitor limit.
 * - It is a runtime, server-only variable: never `NEXT_PUBLIC_*`, never in next.config.ts `env`, never a
 *   Docker build arg. This module is the only place that reads it (enforced by src/conventions.test.ts), and
 *   `import 'server-only'` makes any client bundle that imports this module fail.
 * - Only pass the result of `relayHeaders()` straight to `fetch`. Don't log it, return it, or hand it to a
 *   component as a prop (props of client components are serialised into the page).
 * - `scripts/verify.sh` builds with a random secret and fails if it shows up anywhere in the build output.
 */

export const RELAY_SECRET_HEADER = 'X-Relay-Secret';
export const VISITOR_IP_HEADER = 'X-Visitor-IP';

/**
 * The visitor's address: the LAST entry of `X-Forwarded-For`, the one our own platform appended. Earlier entries
 * are whatever the visitor's client sent and must never be trusted.
 *
 * Assumes exactly one trusted proxy appends the client address, as on Cloud Run (Google Front End). Next.js only
 * fills in `x-forwarded-for` when it is missing (with the socket address), so in local development the value is
 * the loopback address. Behind an extra load balancer, the last entry would be the balancer: revisit this then.
 *
 * Returns undefined unless that entry is exactly one valid IPv4 or IPv6 address (no port, brackets or zone).
 */
export function visitorIpFrom(forwardedFor: string | null | undefined): string | undefined {
  if (!forwardedFor) return undefined;
  const last = forwardedFor.split(',').at(-1)?.trim();
  if (!last || last.includes('%')) return undefined; // `%`: IPv6 zone id, not a routable visitor address
  return isIP(last) ? last : undefined;
}

/**
 * `{ 'X-Relay-Secret', 'X-Visitor-IP' }` for the visitor of the current request, or `{}` when the secret is not
 * configured, the visitor address is unusable, or there is no request (e.g. build time).
 */
export async function relayHeaders(): Promise<Record<string, string>> {
  const secret = process.env.API_RELAY_SECRET?.trim();
  if (!secret) return {};

  let forwardedFor: string | null;
  try {
    forwardedFor = (await headers()).get('x-forwarded-for');
  } catch (error) {
    // Let Next.js's own signals through (e.g. "this route is dynamic" during a static prerender), so the route is
    // rendered per request instead of once at build time without the visitor.
    unstable_rethrow(error);
    return {}; // called outside a request: nobody to relay for
  }

  const ip = visitorIpFrom(forwardedFor);
  if (!ip) return {};
  return { [RELAY_SECRET_HEADER]: secret, [VISITOR_IP_HEADER]: ip };
}
