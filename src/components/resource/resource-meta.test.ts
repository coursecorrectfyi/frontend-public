import { describe, expect, it } from 'vitest'
import type { ResourceLevel, ResourceType } from '@/types/resource'
import { formatDuration, LEVEL_LABELS, RESOURCE_TYPE_META } from './resource-meta'

describe('formatDuration', () => {
  it.each([
    [null, null],
    [0.25, '15 min'],
    [0.5, '30 min'],
    [1, '1 hour'],
    [1.4, '1 hour'],
    [2, '2 hours'],
    [20, '20 hours'],
    [99.4, '99 hours'],
    // From 100 hours on, durations are shown as weeks of ~10 hours.
    [100, '~10 weeks'],
    [105, '~11 weeks'],
    [10 * 51, '~51 weeks'],
    // ...and from a year on, as years of 52 such weeks.
    [10 * 52, '~1 year'],
    [10 * 52 * 1.4, '~1 year'],
    [10 * 52 * 2, '~2 years'],
    [10 * 52 * 4.2, '~4 years'],
  ])('formatDuration(%s) → %s', (hours, expected) => {
    expect(formatDuration(hours)).toBe(expected)
  })

  it.fails('KNOWN BUG (B16): rounds into the next unit instead of showing "60 min"', () => {
    expect(formatDuration(0.999)).toBe('1 hour')
  })

  it.fails('KNOWN BUG (B16): rounds 1.9 hours to "2 hours" like every other value, instead of truncating', () => {
    expect(formatDuration(1.9)).toBe('2 hours')
  })
})

describe('labels', () => {
  it('has a label and tooltip for every resource type in the API contract', () => {
    const types: ResourceType[] = ['course', 'program', 'degree', 'project', 'certification', 'code_along']
    expect(Object.keys(RESOURCE_TYPE_META).sort()).toEqual([...types].sort())
    for (const type of types) {
      expect(RESOURCE_TYPE_META[type].label).toBeTruthy()
      expect(RESOURCE_TYPE_META[type].tooltip).toBeTruthy()
    }
  })

  it('has a label for every level in the API contract', () => {
    const levels: ResourceLevel[] = ['beginner', 'intermediate', 'advanced', 'all_levels']
    expect(LEVEL_LABELS).toEqual({
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      all_levels: 'All Levels',
    })
    expect(Object.keys(LEVEL_LABELS).sort()).toEqual([...levels].sort())
  })
})
