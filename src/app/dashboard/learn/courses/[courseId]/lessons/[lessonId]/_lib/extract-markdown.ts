/**
 * Reads the markdown string out of a text lesson's opaque JSONB body.
 *
 * Local copy of `dashboard/courses/[courseId]/lessons/[lessonId]/_lib/
 * extract-markdown.ts` (design.md §7's `{ format: 'markdown', value }`
 * delivery-layer convention). Kept as a separate copy rather than a
 * cross-route import so the learner viewer route stays independent of the
 * authoring editor route's internal `_lib` — both are pure, tiny, and
 * intentionally allowed to drift if the two content-rendering needs ever
 * diverge.
 */
export function extractMarkdown(body: unknown): string {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return '';
  }

  const value = (body as Record<string, unknown>).value;
  return typeof value === 'string' ? value : '';
}
