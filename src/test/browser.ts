/**
 * Browser APIs that jsdom does not implement, installed by setup.ts for jsdom test files.
 *
 * matchMedia answers every query with `false` by default, which makes MUI's useMediaQuery report
 * a desktop viewport. Use setMediaQueryMatcher() to simulate other viewports:
 *
 *   setMediaQueryMatcher(query => query.includes('max-width'))   // "mobile"
 */
type Matcher = (query: string) => boolean

let matcher: Matcher = () => false
let patchedRect = false

export function setMediaQueryMatcher(next: Matcher) {
  matcher = next
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

export function installBrowserPolyfills() {
  matcher = () => false

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matcher(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
    if (!(name in window)) {
      Object.defineProperty(window, name, { configurable: true, writable: true, value: NoopObserver })
    }
  }

  // react-resizable-panels (SplitViewLayout) decides whether a pointerdown grabbed a resize handle by comparing the
  // pointer position with the handle's bounding box, then calls preventDefault() + stopImmediatePropagation().
  // In jsdom every box is 0×0 at (0,0), so EVERY click "hits" the handle and focus/clicks elsewhere break.
  // Put handles off-screen, as a click away from the handle would be in a real browser.
  if (!patchedRect) {
    const originalRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this instanceof HTMLElement && this.hasAttribute('data-panel-resize-handle-id')) {
        return DOMRect.fromRect({ x: -10_000, y: -10_000, width: 6, height: 100 })
      }
      return originalRect.call(this)
    }
    patchedRect = true
  }

  // jsdom logs "Not implemented" errors for these.
  Element.prototype.scrollIntoView = function scrollIntoView() {}
  window.scrollTo = (() => {}) as typeof window.scrollTo
}
