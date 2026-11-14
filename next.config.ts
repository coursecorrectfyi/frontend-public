import type { NextConfig } from "next";

// Only validate NEXT_PUBLIC_* variables at build time
// Other variables (GOOGLE_CLIENT_ID, NEXTAUTH_SECRET, etc.) are runtime-only
const requiredBuildTimeEnvVars = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_GTM_ID',
] as const;

// Check for required build-time environment variables
requiredBuildTimeEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy course detail URLs → new /learn route (301 = permanent, transfers SEO equity)
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

export default nextConfig;
