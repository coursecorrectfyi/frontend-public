import { expect } from 'vitest'

/**
 * Parses XML the way a crawler would and asserts it is well-formed (the assertion, not a thrown Error,
 * so known-bug tests that rely on it fail "on an assertion"). Needs the jsdom environment (DOMParser).
 */
export function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml.trim(), 'application/xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]?.textContent
  expect(parserError, 'XML must be well-formed').toBeUndefined()
  return doc
}

/** Text of every <tag> element, in document order. */
export const textOf = (doc: Document, tag: string) =>
  [...doc.getElementsByTagName(tag)].map(el => el.textContent ?? '')
