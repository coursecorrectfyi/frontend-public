/**
 * Full-page navigation (a real page load, not a client-side route change).
 *
 * A separate module so tests can observe where the app navigates: jsdom does not implement navigation and
 * silently ignores `window.location.href = ...`.
 */
export function navigateTo(url: string): void {
  window.location.href = url
}
