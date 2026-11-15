# Testing

The test suite runs with **no backend, no Firebase, no network and no `.env` file**. Everything the app talks to
is mocked at its boundary, and the harness fails any test that tries to reach the network.

Stack: [Vitest](https://vitest.dev) · [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
· [user-event](https://testing-library.com/docs/user-event/intro) · [jest-dom matchers](https://github.com/testing-library/jest-dom)
· [MSW](https://mswjs.io) (network mocking) · jsdom · V8 coverage.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run the whole suite once |
| `npm run test:watch` | Watch mode (re-runs affected tests on save) |
| `npm run test:coverage` | Run once with coverage; HTML report in `coverage/index.html` |
| `npm run typecheck` | `tsc --noEmit` over app code, tests and `vitest.config.mts` |
| `npm run test:known-bugs` | Runs every `KNOWN BUG` test as a normal test and checks it fails *on its assertion* (see [Known bugs](#known-bugs)) |
| `npm run test:mutations` | Applies deliberate breaks to app code (`scripts/mutations.mjs`) and checks the tests catch each one (see [Mutation check](#mutation-check)). Optional filter: `npm run test:mutations -- chat` |
| `npm run verify` | The full acceptance run: `npm ci`, `test`, `test:coverage`, `test:known-bugs`, `typecheck`, `build`, with a summary. `-- --no-ci` skips `npm ci`; `-- --clean` starts from a fresh-checkout state; `-- --mutations` adds the mutation check (slow) |

Run a subset: `npx vitest run src/api` or `npx vitest run -t "limit reached"`.

`npm run build` needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GTM_ID` (from `.env.local` or the environment).
`npm run verify` uses placeholders for the build check if neither is set. Tests never need them.

## What the harness guarantees

All of this is wired in `src/test/setup.ts` and applies to every test file:

- **No network.** Every `fetch` and `node:http` request goes through the MSW server. A request without a matching
  handler never leaves the process: it fails with a network error *and* fails the test in `afterEach`, even if the
  code under test caught the error. `src/test/harness.test.tsx` proves this against a real server on localhost.
- **Known-bug tests can't hide problems.** `it.fails` would count an `afterEach` failure as its expected failure, so
  problems left by an `it.fails` test (unhandled request, unexpected console output) are reported in `afterAll` and
  fail the test file instead.
- **No surprise console output.** An unexpected `console.error` or `console.warn` fails the test. React reports real
  bugs this way (duplicate keys, state updates outside `act()`, invalid DOM props). When a test *intends* to trigger
  an error log, it says so with `allowConsole('error', /pattern/)`.
- **Fixed configuration.** `NEXT_PUBLIC_API_URL` is `http://api.test` (see `vitest.config.mts`, `test.env`).
- **Platform mocks** for `next/navigation`, `next/image`, `next/script`, `next-auth/react` and `@/lib/firebase`.
- **Isolation.** After each test: DOM cleanup, `localStorage`/`sessionStorage` cleared, GTM `dataLayer` removed,
  session/router/Firebase mocks reset, MSW handlers reset, spies and stubbed env/globals restored.
- **Browser gaps filled** for jsdom: `matchMedia` (desktop by default), `ResizeObserver`, `IntersectionObserver`,
  `scrollIntoView`, `scrollTo`.

The harness checks itself in `src/test/harness.test.tsx`; if that file fails, no other result can be trusted.

## Writing tests

### Where and how

- Colocate: `src/api/chat.ts` → `src/api/chat.test.ts`. Test files under `src/app/` are safe: the App Router only
  treats `page`, `layout`, `route` (etc.) files as routes.
- Default environment is **jsdom**. Server-only code (route handlers, middleware, `generateMetadata`) runs in Node:
  put `// @vitest-environment node` on the first line of the test file.
- Import test APIs explicitly (`import { describe, it, expect, vi } from 'vitest'`); globals are off.
- Assert on what a user or a caller can observe (rendered text, roles, requests sent, values returned), not on
  internal state. Prefer `getByRole(..., { name })` queries — except for form controls inside large MUI trees
  (e.g. the 34 checkboxes of the filters drawer): there use `getByLabelText(name)`. `*ByRole` with a `name` computes
  every candidate's accessible name and styles and costs ~0.8 s per query in such trees (27 ms with `getByLabelText`);
  a test doing a dozen of those timed out under load.
- API response data comes from the factories in `src/test/fixtures.ts`, which follow `docs/backend-api.md`. If the
  contract changes, change the factories first and let the failing tests show what else must change.

### Helpers (`src/test/`)

| Module | Use it for |
|---|---|
| `render.tsx` | `renderWithProviders(ui)` → `{ user, queryClient, ...RTL }` with the real theme and a fresh no-retry QueryClient. `renderHookWithProviders(hook)` for hooks |
| `msw.ts` | `createGate()` holds a mocked response until `gate.open()`, to assert in-between states (optimistic updates, spinners) without racing timers. `mockApi(method, path, reply, init?)` mocks one backend endpoint and returns the list of requests it received (`url`, `headers`, `params`, raw `body`). Lower level: `server`, `http`, `HttpResponse`, `delay`, `apiUrl('/api/v1/...')` |
| `fixtures.ts` | Contract-shaped factories: `makeResource`, `makeResourceDetail`, `makeSearchResponse`, `makeTopic`, `makeDomainDetail`, `makeSubtopicDetail`, `makeSubject`, `makeBackendTokens`, `makeUuid` |
| `sse.ts` | Chat stream responses: `sseResponse([delta('Hi'), done()])`, `sseResponseFromChunks([...])` for exact chunk boundaries, `controlledSse()` to drive a stream step by step |
| `mocks/next-auth.ts` | `mockSignedIn(overrides?)`, `mockSignedOut()`, `mockSessionLoading()`, `setSession(data, status)`, spies `nextAuth.signIn` / `nextAuth.signOut` |
| `mocks/next-navigation.ts` | `router` (spies: `push`, `replace`, ...), `setPathname()`, `setSearchParams()` |
| `mocks/firebase.ts` | `firebase.signInWithGoogle` / `firebase.signOutFirebase` spies |
| `console.ts` | `allowConsole('error' \| 'warn', pattern)` |
| `pages.tsx` | Route tests: `renderPage(ui)` (mocks the layout's background requests, renders, settles), `expectMainLayout()`, `iconButton('Send')` (finds an icon-only button by its MUI icon), `allowKnownPageWarnings()`, `settle()` |
| `xml.ts` | `parseXml(xml)` (asserts well-formed XML, jsdom only), `textOf(doc, tag)` |
| `browser.ts` | `setMediaQueryMatcher(query => boolean)` to simulate mobile layouts |

To test a module that is mocked globally (for example `lib/firebase.ts` itself), call
`vi.unmock('@/lib/firebase')` at the top of that test file and mock its dependencies instead.

### Example

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeResource } from '@/test/fixtures'
import { mockSignedIn } from '@/test/mocks/next-auth'
import { apiUrl, http, HttpResponse, server } from '@/test/msw'
import { renderWithProviders } from '@/test/render'
import SaveCourseButton from './SaveCourseButton'

describe('SaveCourseButton', () => {
  it('saves the resource for a signed-in user', async () => {
    mockSignedIn()
    const resource = makeResource()
    let saved: string | undefined
    server.use(
      http.get(apiUrl('/api/v1/saved'), () => HttpResponse.json({ data: [] })),
      http.post(apiUrl('/api/v1/saved/:id'), ({ params }) => {
        saved = params.id as string
        return HttpResponse.json({ ok: true })
      }),
    )

    const { user } = renderWithProviders(<SaveCourseButton courseId={resource.id} courseName={resource.title} />)
    await user.click(await screen.findByRole('button', { name: 'Add to shortlist' }))

    await expect.poll(() => saved).toBe(resource.id)
  })
})
```

### Timers

Use `vi.useFakeTimers({ shouldAdvanceTime: true })` when the code waits (e.g. the early-access redirect after 4 s),
and pass `userEventOptions: { advanceTimers: vi.advanceTimersByTime }` to `renderWithProviders`. Restore with
`vi.useRealTimers()` in `afterEach`.

## Known bugs

A test always asserts the **correct** behaviour. When the current code is wrong and the fix is deferred, the test is
written with `it.fails` and a `KNOWN BUG` tag that points at the registry below:

```ts
it.fails('KNOWN BUG (B3): clears the typing indicator when the stream ends without a done event', async () => { ... })
```

`it.fails` passes while the assertion fails. When someone fixes the bug, the test **starts failing**: change
`it.fails` to `it`, drop the `KNOWN BUG` prefix, and remove the row here. `grep -rn "KNOWN BUG" src` lists them all.

**Caveat and safeguard.** `it.fails` passes when the test throws *anything*, so a known-bug test that is itself
broken (a typo, a `TypeError` in the test) would look exactly like a detected bug. `npm run test:known-bugs`
(also part of `npm run verify`) runs these tests as ordinary tests (`vitest.known-bugs.config.mts`) and reports
each one as:

- `OK` — fails on an assertion: the bug is present and the test detects it;
- `FIXED?` — passes: the bug is gone, flip `it.fails` to `it`;
- `BROKEN TEST` — fails with some other error: fix the test;
- `HARNESS` — also leaves a harness problem (unhandled request, unexpected console output): fix the test.

So the assertion that proves the bug must be an `expect(...)`; don't let helpers throw plain `Error`s for it.

| ID | Summary | Test |
|---|---|---|
| B1 | After the refresh token expires, `/auth/refresh` answers 401 but the expired tokens are kept (user looks signed in, every call 401s) | `src/lib/auth-options.test.ts` |
| B2 | Logout only signs out of Firebase when `user.provider === 'firebase'`; the backend sends `"google"`, so Firebase is never signed out | `src/components/header/AuthButton.test.tsx` |
| B3 | Chat: a stream that ends without `done` leaves the answer "streaming" and unsaved; `done` without any text leaves "Cora is typing..." forever | `src/hooks/use-chat-state.test.tsx` |
| B4 | Chat: an `error` event after part of the answer adds a second message with the same id and leaves the first one streaming | `src/hooks/use-chat-state.test.tsx` |
| B5 | Chat: a new question can be sent (Enter, button or quick prompt) while Cora is still answering | `src/components/Chat.test.tsx` |
| B6 | `/saved` shows "Sign in to save resources" while the session is still loading | `src/app/saved/page.test.tsx` |
| B7 | Subtopic breadcrumb links to `/subjects`, which is a 404 | `src/app/subjects/[slug]/page.test.tsx` |
| B8 | `/learn` metadata: canonical URL is built from the requested slug/id (legacy id, stale slug) instead of the resource's slug and UUID | `src/app/metadata.test.ts` |
| B9 | A failed "Load more" replaces the already-loaded results with an error | `src/components/resource/ResourceList.test.tsx` |
| B10 | `/blog` proxy decodes the path: non-Latin/space paths → 502; `..%2F` escapes `/blog` (reaches `/wp-login.php`) | `src/app/blog/[[...slug]]/route.test.ts` |
| B11 | `/blog` proxy: redirect loops are followed without limit; a relative `Location` throws an uncaught `TypeError` and the request never resolves | `src/app/blog/[[...slug]]/route.test.ts` |
| B12 | `/blog` proxy forwards only the first `Set-Cookie` header | `src/app/blog/[[...slug]]/route.test.ts` |
| B13 | API path params (`id`, `slug`) are not URL-encoded; `getResourceById('../saved')` actually calls `GET /api/v1/saved` | `src/api/resources.test.ts`, `src/api/subjects.test.ts` |
| B14 | Query retry policy: the "don't retry 401/403" rule never applies (errors carry no status) and 404s are retried twice (~3 s before "not found" shows) | `src/app/providers.test.tsx` |
| B15 | Saved-items cache key does not include the user (session has no email), so after a session expires and another account signs in without a reload, the previous user's items are shown | `src/hooks/use-saved-courses.test.tsx` |
| B16 | `formatDuration` rounding at unit boundaries: `0.999` h → "60 min", `1.9` h → "1 hour" | `src/components/resource/resource-meta.test.ts` |
| B17 | Search modal: `width: '100$'` typo, so the search box doesn't span the modal | `src/components/AppSearch.test.tsx` |
| B18 | Account menu "Saved Items" goes to the legacy `/saved-courses` (redirect) instead of `/saved` | `src/components/header/AuthButton.test.tsx` |
| B19 | Early-access form: double-clicking "Join Early Access" submits twice | `src/components/early-access/EarlyAccessModal.test.tsx` |
| B20 | Sitemap XML: values are not escaped (`&` makes the XML invalid); `priority: 0` is dropped; the subjects sitemap drops subjects that share a name with another | `src/utils/sitemap.test.ts`, `src/app/sitemaps.test.ts` |
| B21 | Chat SSE parser drops a final event that has no trailing newline | `src/api/chat.test.ts` |
| B22 | Chat: a message typed while the session is still loading is ignored by the hook but cleared from the input (lost) | `src/components/Chat.test.tsx` |
| B23 | Chat message ids come from `Date.now()`; two messages sent in the same millisecond get the same id | `src/hooks/use-chat-state.test.tsx` |
| B25 | A stored `cc_session_id` that is not a UUID is reused (backend answers `400`) | `src/utils/session.test.ts` |
| B26 | Chat's "New chat" button is disabled inside a Tooltip: MUI warns and the tooltip never shows. Page tests allow exactly this warning via `allowKnownPageWarnings()` (remove it there when fixed) | `src/components/Chat.test.tsx` |
| B27 | Accessible names: icon-only buttons without names (header sign-in, account menu, chat Send, filters Close, Product Hunt hide, carousel arrows); Enroll announced as its tooltip text; breadcrumb `<nav>` unlabelled | `src/accessibility.test.tsx` |
| B28 | `AppSearch` uses a hard-coded id for `aria-labelledby`; with two instances (header + hero) the hero button is announced with the header's label | `src/app/about-us/page.test.tsx` |
| C3 | Chat request size/abort recommendations: history is not capped at 20 turns, `pageContextIds` not at 50, and the request is not aborted when the chat unmounts | `src/hooks/use-chat-state.test.tsx` |
| B29 | Security: Cora's answers render Markdown images from any host, so injected content can make the browser send conversation data to a third party (exfiltration) | `src/components/SafeMarkdown.test.tsx` |
| C1 | Chat limit banner always says "You've used your free questions…", contradicting network/global limit messages; contract says show the 429 `message` | `src/components/Chat.test.tsx` |
| C2 | Chat `400` (message too long) and `413` show as a generic failure instead of the backend's message; no `maxLength={4000}` on the input | `src/api/chat.test.ts`, `src/components/Chat.test.tsx` |

IDs are stable (`B…` = bug, `C…` = gap against the backend contract in `docs/backend-api.md`). `npm run test:known-bugs` fails if this table and the tests disagree.

## UI inventory

Every live route has a page test (`src/app/**/page.test.tsx`) and the shared layout has `src/layouts/MainLayout.test.tsx`.
Together they assert every user-visible feature: headings, links and their targets, buttons, filter groups and options,
card facts and actions, detail sections, chat prompts, empty/error/loading states, the mobile layout, and the primary
wiring of each control (filters → request, Load more → cursor, a chat prompt → request with the page context → answer).
Removing any feature makes one of them fail; `ui/*` entries in `scripts/mutations.mjs` prove that for each feature.

jsdom has no layout engine, which matters in two places (both handled by the harness):
`react-resizable-panels` hit-tests every click against its resize handle's box, which is 0×0 at (0,0) in jsdom, so
handles are moved off-screen in `src/test/browser.ts`; and MUI's `SwipeableDrawer` keeps closed content mounted (hidden),
so assert with accessible queries (`queryByRole`) rather than presence in the DOM.

## Not testable in jsdom (needs a real browser)

A few behaviours depend on real layout and are left to manual or end-to-end testing:

- `SplitViewLayout`: dragging or keyboard-resizing the divider, and double-click to restore 50/50
  (react-resizable-panels needs the panel group's pixel width; jsdom has no layout).
- Smooth scrolling of the chat to the newest message (`scrollTop`/`scrollHeight` are always 0 in jsdom).
- CSS-only responsiveness (e.g. the desktop nav bar hidden on small screens via `display: { xs: 'none' }`);
  JS-driven breakpoints (`useMediaQuery`) *are* tested with `setMediaQueryMatcher`.

## Mutation check

A passing test only proves something if it would fail when the behaviour it covers breaks. `npm run test:mutations`
checks exactly that: each entry in `scripts/mutations.mjs` makes one realistic break in app code (drop a header,
shift a threshold, remove a UI element), runs the tests that should notice, and restores the file.

- `KILLED`: the tests failed, the behaviour is protected.
- `SURVIVED`: the tests still pass: a gap. Strengthen the test, or, if the break cannot change behaviour (e.g. a
  redundant check), replace the mutation and leave a comment saying why.

When you add tests for a feature, add a mutation or two for it. Behaviour that is guarded in two places (e.g. a limit
checked twice) needs a multi-edit mutation (`edits: [...]`), otherwise removing one guard proves nothing.

The runner restores the mutated file after each mutation and on Ctrl+C/SIGTERM/SIGHUP. If it is killed hard, the
original is in `.mutation-backup.json` and the next run restores it first (both paths were tested with real signals).
Don't run it at the same time as other test commands: while it runs, one source file is deliberately broken. The check refuses to run if a `find` string no longer
occurs exactly once (so stale mutations are noticed), or if the tests fail before mutating.

What it has caught so far: SSE chunk-boundary tests that never saw a boundary (the helper's chunks were merged into
one read; fixed in `sseResponseFromChunks` and guarded by a harness self-test), and a missing `socialId` case in the
token validation tests.

## Conventions enforced by tests

`src/conventions.test.ts` checks codebase rules that keep the app and the suite healthy. Currently:

- **Import MUI icons by path** (`import SearchIcon from '@mui/icons-material/Search'`), never from the
  `@mui/icons-material` barrel. The barrel re-exports ~2,000 icons as non-native ESM; importing it once made a single
  test file take more than 3 minutes. (ESLint reports it too: `no-restricted-imports`.)

## Coverage

`npm run test:coverage` measures every file in `src/` (tests and `src/test/` excluded), including files no test
imports, so untested code shows up as 0%. Thresholds in `vitest.config.mts` are raised as the suite grows and must
not be lowered to make a change pass.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Unhandled network request (add an MSW handler): GET http://api.test/...` | The code made a request the test did not expect or mock. Add `server.use(http.get(apiUrl(...), ...))`, or fix the code if the request is wrong |
| `console.error: ... not wrapped in act(...)` | A state update happened after the test stopped waiting. Await the UI that results from it (`findBy...`, `waitFor`, `expect.poll`) |
| `console.error: ... unique "key" prop` | A real rendering bug; fix the component |
| A test times out only under `npm run verify` / coverage | It is too slow for the 20 s budget under parallel load. Profile it (time each step); the usual cause is many `getByRole(..., { name })` queries in a large MUI tree — switch form controls to `getByLabelText` |
| Test passes alone but fails in the suite | Leaked state. Module-level caches are the usual suspect; the harness resets storage, mocks and handlers, not module variables |
