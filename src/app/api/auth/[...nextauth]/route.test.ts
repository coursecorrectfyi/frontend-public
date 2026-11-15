// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as route from './route'

describe('NextAuth route', () => {
  it('serves GET and POST with the same NextAuth handler', () => {
    expect(Object.keys(route).sort()).toEqual(['GET', 'POST'])
    expect(typeof route.GET).toBe('function')
    expect(route.GET).toBe(route.POST)
  })
})
