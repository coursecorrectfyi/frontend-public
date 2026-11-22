# CourseCorrect Frontend

Web frontend for [CourseCorrect](https://coursecorrect.fyi), a search and recommendation platform for online courses, programs and degrees. It talks to the [CourseCorrect backend](https://github.com/coursecorrectfyi/backend-public) API.

Built with Next.js 15 (App Router), React 19, MUI 6 (light and dark themes), TanStack Query, Firebase Authentication and NextAuth.

## Features

- **Search** with filters and cursor pagination over the backend's hybrid (full-text + vector) search
- **Resource detail pages** (`/learn/[slug]/[id]`) with AI-generated career insights
- **Subjects** (`/subjects/[slug]`) and saved resources (`/saved`) for signed-in users
- **Cora**, a streaming AI learning assistant (server-sent events) that sees the resources on the current page
- Sitemaps, `robots.txt`, structured data and Google Tag Manager analytics

## Project layout

```
src/
  app/          routes (App Router), NextAuth route, sitemaps, /blog reverse proxy
  api/          backend API clients
  components/   UI components
  hooks/        data hooks (TanStack Query)
  layouts/      page shells, header, footer
  lib/          Firebase client, NextAuth options; lib/server/ is server-only (relay headers)
  theme/        MUI theme (light/dark)
  types/        shared types
  test/         test harness (setup, mocks, fixtures); tests sit next to the code as *.test.ts(x)
docs/           backend API contract, testing guide, analytics, schema markup, video and deployment notes
public/         static assets
```

### Static assets

The home page plays four demo videos from `public/`: `bg-video.mp4`, `search-a-topic.mp4`, `real-outcomes.mp4`
and `overthinking-it.mp4`, served from the site root. They are the largest files in the repo. The tests check the
video markup, not the files, so the suite also runs on a copy without them.

## Getting started

Requirements: Node.js 22, a running [backend](https://github.com/coursecorrectfyi/backend-public) (default `http://localhost:3000`) and a Firebase project with a web app (for sign-in).

```sh
npm ci
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3001
```

Search and detail pages work without Firebase; sign-in, saved resources and higher chat limits need it.

## Backend API

The frontend calls the [CourseCorrect backend](https://github.com/coursecorrectfyi/backend-public) API. Its contract (endpoints, limits, error bodies, chat stream events, requirements for clients) is in [docs/backend-api.md](docs/backend-api.md), a copy of the backend's `docs/api.md`.

## Configuration

All configuration is through environment variables (see `.env.example`). `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so they must be set when running `npm run build`.

`npm run build` refuses to start if `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_GTM_ID` is missing (or if the API URL is not an absolute `http(s)` URL): a bundle built without them cannot be fixed by setting the variables at runtime. The check lives in `next.config.ts` and only runs for the production build; `npm run dev`, `npm start`, `npm run lint` and the tests don't need the variables.

| Variable | When | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | build | Backend base URL. Required. |
| `NEXT_PUBLIC_GTM_ID` | build | Google Tag Manager container ID. Required by the build; only loaded in production. |
| `NEXT_PUBLIC_FIREBASE_*` | build | Firebase web app config (API key, auth domain, project ID, storage bucket, sender ID, app ID, measurement ID). |
| `NEXT_PUBLIC_HOSTINGER_IP` | build | Optional upstream host for the `/blog` reverse proxy (a WordPress site). |
| `NEXT_PUBLIC_EARLY_ACCESS_*` | build | Optional Google Form (`FORM_URL`, `INTENT_ENTRY_ID`, `EMAIL_ENTRY_ID`) for early-access signups. |
| `NEXTAUTH_SECRET` | runtime | Session encryption secret (`openssl rand -base64 32`). |
| `API_RELAY_SECRET` | runtime | Optional, **server-only**. Relay secret shared with the backend (`TRUSTED_RELAY_SECRETS` there). Backend calls the server makes for a visitor (page metadata, subjects sitemap, token refresh, logout) then carry `X-Relay-Secret` and `X-Visitor-IP`, so they count against that visitor's rate limits; without it they all share the server's. Must never be `NEXT_PUBLIC_*`, a `next.config.ts` `env` entry or a Docker build arg: tests and `npm run verify` check this (see `src/lib/server/relay.ts`). |
| `NEXTAUTH_URL` | runtime | Public base URL of the site. |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with Turbopack on port 3001 |
| `npm run build` | Production build (`output: 'standalone'`) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (`eslint .`). Currently fails (55 known errors, deferred); don't add new ones |
| `npm test` | Unit and component tests (Vitest); no backend, Firebase or network needed |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with a coverage report in `coverage/` |
| `npm run typecheck` | TypeScript type check (`next build` skips it: `ignoreBuildErrors` is on) |
| `npm run verify` | Acceptance run: `npm ci`, typecheck, tests with coverage, known-bug check, build, with a summary. Runs `bash scripts/verify.sh` (bash ≥ 3.2, e.g. macOS's `/bin/bash`; zsh as your login shell is fine, but don't run the script with `sh` or `zsh`) |

See [docs/testing.md](docs/testing.md) for how the tests work and how to write them.

CI (`.github/workflows/ci.yml`) runs `npm run verify -- --no-ci` and a gitleaks scan of the full history on every
pull request and push to `main`.

## Deployment

The `Dockerfile` builds a standalone Next.js image; `cloudbuild.yaml` builds it on Cloud Build and deploys it to Cloud Run. See [docs/deployment-gcp.md](docs/deployment-gcp.md).

## License

[MIT](LICENSE) for the source code. The CourseCorrect name and logo, the provider logos in `public/images/partner_logos/`, and the images and videos in `public/` are not covered by the MIT license.
