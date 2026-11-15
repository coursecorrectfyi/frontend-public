import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  trackEnrollClick,
  trackEvent,
  trackPageView,
  trackSaveCourse,
  trackSearch,
  trackSearchError,
  trackSearchResultClick,
  trackSearchResultsLoaded,
  trackUserSignIn,
} from './analytics'

const NOW = new Date('2026-03-01T12:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const lastPush = () => window.dataLayer[window.dataLayer.length - 1]

describe('trackEvent', () => {
  it('creates the GTM dataLayer if GTM has not loaded yet', () => {
    expect(window.dataLayer).toBeUndefined()
    trackEvent('something')
    expect(window.dataLayer).toEqual([{ event: 'something', timestamp: NOW.toISOString() }])
  })

  it('appends to an existing dataLayer without touching earlier entries', () => {
    window.dataLayer = [{ 'gtm.start': 1 }]
    trackEvent('a', { x: 1 })
    expect(window.dataLayer).toEqual([{ 'gtm.start': 1 }, { event: 'a', timestamp: NOW.toISOString(), x: 1 }])
  })

  it('is a no-op during server rendering', () => {
    vi.stubGlobal('window', undefined)
    expect(() => trackEvent('server')).not.toThrow()
  })
})

// Event names and parameters are the contract with the GTM container (docs/analytics.md, "GA4 Event Tags").
// Renaming any of them silently breaks reporting, so they are asserted exactly.
describe('event payloads', () => {
  const ts = NOW.toISOString()

  it('search', () => {
    trackSearch('python', 12)
    expect(lastPush()).toEqual({ event: 'search', timestamp: ts, search_term: 'python', result_count: 12 })
  })

  it('search_result_click (default source: search_results)', () => {
    trackSearchResultClick('id-1', 'Python 101', 3)
    expect(lastPush()).toEqual({
      event: 'search_result_click',
      timestamp: ts,
      course_id: 'id-1',
      course_name: 'Python 101',
      position: 3,
      source: 'search_results',
    })
    trackSearchResultClick('id-1', 'Python 101', 3, 'subject_page')
    expect(lastPush().source).toBe('subject_page')
  })

  it('enroll_click', () => {
    trackEnrollClick('id-1', 'Python 101', 'https://provider.example/p', 'course_detail')
    expect(lastPush()).toEqual({
      event: 'enroll_click',
      timestamp: ts,
      course_id: 'id-1',
      course_name: 'Python 101',
      course_url: 'https://provider.example/p',
      source: 'course_detail',
    })
  })

  it('save_course', () => {
    trackSaveCourse('id-1', 'Python 101', 'unsave')
    expect(lastPush()).toEqual({
      event: 'save_course',
      timestamp: ts,
      course_id: 'id-1',
      course_name: 'Python 101',
      action: 'unsave',
    })
  })

  it('user_sign_in', () => {
    trackUserSignIn('google')
    expect(lastPush()).toEqual({ event: 'user_sign_in', timestamp: ts, method: 'google' })
  })

  it('page_view, with optional extra parameters', () => {
    trackPageView('search', { search_query: 'sql' })
    expect(lastPush()).toEqual({ event: 'page_view', timestamp: ts, page_name: 'search', search_query: 'sql' })
    trackPageView('home')
    expect(lastPush()).toEqual({ event: 'page_view', timestamp: ts, page_name: 'home' })
  })

  it('search_results_loaded flags empty result sets', () => {
    trackSearchResultsLoaded('rust', 0, false)
    expect(lastPush()).toEqual({
      event: 'search_results_loaded',
      timestamp: ts,
      search_term: 'rust',
      result_count: 0,
      has_results: false,
      vector_search: false,
    })
    trackSearchResultsLoaded('rust', 5, true)
    expect(lastPush()).toMatchObject({ result_count: 5, has_results: true, vector_search: true })
  })

  it('search_error', () => {
    trackSearchError('rust', 'Search request failed')
    expect(lastPush()).toEqual({
      event: 'search_error',
      timestamp: ts,
      search_term: 'rust',
      error_message: 'Search request failed',
    })
  })
})
