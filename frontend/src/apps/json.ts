/**
 * The one place an unknown JSON value is narrowed for reading. Everything the launcher
 * fetches — the manifest, `/boot/<slug>`, `/instances` — arrives as `unknown` and is read
 * key by key, so a single helper keeps the assertion at that boundary instead of spreading
 * inline casts through every parser.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
