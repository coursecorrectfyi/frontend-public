import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * NEXT_PUBLIC_* values are inlined into the client bundle by `next build`. A bundle built without
 * them cannot be fixed by setting the variables at runtime (e.g. on Cloud Run): it has to be
 * rebuilt. So the production build refuses to run without them.
 *
 * The check runs only when producing a production bundle. `next dev`, `next start` and the test suite load this
 * file too and do not need the variables. `next lint` and `next typegen` also load it with PHASE_PRODUCTION_BUILD
 * without producing a bundle, so they are exempted by name (fail closed: any other command in that phase validates).
 * Runtime-only variables (NEXTAUTH_SECRET, NEXTAUTH_URL) are not checked here.
 */
export const REQUIRED_BUILD_ENV = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_GTM_ID"] as const;

/** Variables that must also be absolute http(s) URLs. */
const URL_BUILD_ENV: ReadonlyArray<(typeof REQUIRED_BUILD_ENV)[number]> = ["NEXT_PUBLIC_API_URL"];

export function assertRequiredBuildEnv(env: Record<string, string | undefined> = process.env): void {
  const problems: string[] = [];
  for (const name of REQUIRED_BUILD_ENV) {
    const value = env[name]?.trim();
    if (!value || value === "undefined") {
      problems.push(`${name} is not set`);
    } else if (URL_BUILD_ENV.includes(name) && !/^https?:\/\/[^/\s]+/i.test(value)) {
      problems.push(`${name} must be an absolute http(s) URL, got "${value}"`);
    }
  }
  problems.push(...earlyAccessProblems(env));
  if (problems.length > 0) {
    throw new Error(
      `Invalid build-time environment:\n  - ${problems.join("\n  - ")}\n` +
        "NEXT_PUBLIC_* values are inlined into the bundle at build time. Set them in the environment " +
        "or in .env.local (see .env.example and README.md).",
    );
  }
}

/**
 * The early-access form (src/components/early-access/EarlyAccessModal.tsx) posts to a Google Form. It is optional:
 * with none of these set, the form is off. But a partial or malformed setting would make every signup fail
 * silently (the request is `no-cors`, so its result can't be read), so that stops the build.
 */
export const EARLY_ACCESS_BUILD_ENV = [
  "NEXT_PUBLIC_EARLY_ACCESS_FORM_URL",
  "NEXT_PUBLIC_EARLY_ACCESS_INTENT_ENTRY_ID",
  "NEXT_PUBLIC_EARLY_ACCESS_EMAIL_ENTRY_ID",
] as const;

function earlyAccessProblems(env: Record<string, string | undefined>): string[] {
  const values = EARLY_ACCESS_BUILD_ENV.map((name) => [name, env[name]?.trim() ?? ""] as const);
  const set = values.filter(([, value]) => value !== "");
  if (set.length === 0) return [];
  if (set.length < values.length) {
    const missing = values.filter(([, value]) => value === "").map(([name]) => name);
    return [`${missing.join(", ")} not set: set all three NEXT_PUBLIC_EARLY_ACCESS_* variables, or none`];
  }
  const problems: string[] = [];
  const [[urlName, url], ...entries] = values;
  if (!/^https:\/\/docs\.google\.com\/forms\/\S+\/formResponse$/.test(url)) {
    problems.push(`${urlName} must be a Google Form's https://docs.google.com/forms/.../formResponse URL, got "${url}"`);
  }
  for (const [name, value] of entries) {
    if (!/^entry\.\d+$/.test(value)) problems.push(`${name} must look like "entry.123456789", got "${value}"`);
  }
  return problems;
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy course detail URLs → new /learn route. `permanent: true` makes Next.js answer 308,
      // which search engines treat like a 301 (transfers SEO equity).
      {
        source: '/course/:slug/:id',
        destination: '/learn/:slug/:id',
        permanent: true,
      },
      // Legacy saved courses URL → /saved
      {
        source: '/saved-courses',
        destination: '/saved',
        permanent: true,
      },
    ]
  },
  // Enable standalone output for Cloud Run (smaller Docker image)
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd3f1iyfxxz8i1e.cloudfront.net',
      }
    ]
  },
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // TODO: Remove this when you fix the type errors
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export { nextConfig };

/** Next CLI commands that load the config in PHASE_PRODUCTION_BUILD but do not produce a bundle. */
const NON_BUNDLING_COMMANDS = ["lint", "typegen"];

export function shouldValidateBuildEnv(phase: string, argv: string[] = process.argv): boolean {
  if (phase !== PHASE_PRODUCTION_BUILD) return false;
  const command = argv[2]; // e.g. ["node", ".../next", "typegen"]
  return !NON_BUNDLING_COMMANDS.includes(command);
}

export default function config(phase: string): NextConfig {
  if (shouldValidateBuildEnv(phase)) assertRequiredBuildEnv();
  return nextConfig;
}
