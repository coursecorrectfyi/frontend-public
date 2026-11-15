import { describe, expect, it, vi } from 'vitest'
import { onOpenSearch, openSearch } from './search-events'

describe('search events', () => {
  it('notifies every registered listener', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onOpenSearch(a)
    const offB = onOpenSearch(b)

    openSearch()

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    offB()
  })

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = vi.fn()
    const off = onOpenSearch(listener)
    off()
    openSearch()
    expect(listener).not.toHaveBeenCalled()
  })

  it('does nothing when nobody listens', () => {
    expect(() => openSearch()).not.toThrow()
  })

  it('registers the same function only once', () => {
    const listener = vi.fn()
    const off1 = onOpenSearch(listener)
    const off2 = onOpenSearch(listener)
    openSearch()
    expect(listener).toHaveBeenCalledTimes(1)
    off1()
    off2()
  })
})
