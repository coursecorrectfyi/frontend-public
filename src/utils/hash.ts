/**
 * Short, deterministic, non-cryptographic hash (base 36) of a string. Used for local storage keys, so that raw
 * user or session ids never appear in them.
 */
export function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
