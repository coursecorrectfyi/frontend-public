/**
 * Per-call options for backend requests. Server code passes the relay headers here
 * (`{ headers: await relayHeaders() }`, see src/lib/server/relay.ts); browser code never needs them.
 */
export interface RequestOptions {
  headers?: Record<string, string>
}
