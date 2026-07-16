/**
 * getActiveHref — longest-match-wins resolver for the dashboard nav's active
 * item. Every dashboard href is nested under `/dashboard` (and
 * `/dashboard/simulators/tracks` is nested under `/dashboard/simulators`),
 * so a naive `pathname.startsWith(href)` check would light up multiple nav
 * items at once. Centralizing the rule here means the nav must be rendered
 * as a unit that knows every href — the only way longest-match can be
 * correct — instead of each link deciding its own active state in isolation.
 *
 * A href matches when the pathname IS that href or sits below it at a path
 * boundary (`href + '/'`), so `/dashboard/coursesx` never matches
 * `/dashboard/courses`. Among all matches, the longest href wins. Returns
 * `null` when nothing matches or when `pathname` is `null` (which is what
 * `usePathname()` yields outside a router context).
 */
export function getActiveHref(
  pathname: string | null,
  hrefs: readonly string[],
): string | null {
  if (pathname === null) return null;

  let active: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (active === null || href.length > active.length)) {
      active = href;
    }
  }
  return active;
}
