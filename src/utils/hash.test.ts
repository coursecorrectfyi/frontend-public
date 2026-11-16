import { describe, expect, it } from 'vitest'
import { stableHash } from './hash'

describe('stableHash', () => {
  // Conversations are stored under `chat_<hash of "identity:context">`. If the hash ever changed, every stored
  // conversation would silently become unreachable. These values come from the original implementation.
  it.each([
    ['user-1:search:python', 'u8oyn7'],
    ['3f2b8c1e-9d4a-4e6b-8c2d-1a2b3c4d5e6f:saved', 'aps5h3'],
    ['', '0'],
  ])('%j → %j (must never change)', (value, expected) => {
    expect(stableHash(value)).toBe(expected)
  })
})
