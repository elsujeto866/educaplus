/**
 * Reads the markdown string out of a text lesson's opaque JSONB body.
 *
 * The domain layer keeps `TextContent.body: JSONValue` unconstrained on
 * purpose (design.md §7: "envelope future-proofs to rich editor with zero
 * migration"). The `{ format: 'markdown', value }` shape is a delivery-layer
 * convention, so this does a runtime shape check instead of importing the
 * domain type (which `src/app` cannot reach — eslint-boundaries only allows
 * `delivery -> composition`, not `delivery -> domain`).
 */
export function extractMarkdown(body: unknown): string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return '';
  }

  const value = (body as Record<string, unknown>).value;
  return typeof value === 'string' ? value : '';
}
