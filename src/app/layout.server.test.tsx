// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RootLayout from './layout'

// Server rendering of the root layout, in Node like the real server: there, Emotion writes styles inline unless the
// Emotion cache provider (AppRouterCacheProvider) collects them (jsdom puts them in document.head, so it can't tell).

describe('root layout on the server', () => {
  it("writes no global styles inline, and starts <body> with the color-scheme script (inline styles break hydration)", () => {
    // With the theme (and CssBaseline) outside the Emotion cache provider, the server wrote CssBaseline's global
    // styles as <style> elements into the document (in Next's stream: at the start of <body>), the browser didn't,
    // and hydration failed on every page: React rebuilt the page client-side, and the split view sometimes crashed
    // ("No group found for id"). Inside the provider, Next inserts them into <head> separately. See src/app/layout.tsx.
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>page body</main>
      </RootLayout>,
    )
    expect(html).not.toMatch(/<style[^>]*data-emotion="[^"]*css-global/)
    expect(html.slice(html.indexOf('<body'))).toMatch(/^<body><script/)
  })
})
