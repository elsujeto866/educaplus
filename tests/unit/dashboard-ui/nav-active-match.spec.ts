/**
 * getActiveHref — longest-match-wins resolver for the dashboard nav's active
 * item. Exists because every dashboard href is nested under `/dashboard`
 * (and `/dashboard/simulators/tracks` is nested under
 * `/dashboard/simulators`), so a naive `pathname.startsWith(href)` check
 * would light up multiple nav items at once (e.g. both "Inicio" and
 * "Cursos" for `/dashboard/courses`, or both "Simuladores" and "Rutas de
 * estudio" for `/dashboard/simulators/tracks`). Centralized here so the
 * matching rule lives in exactly one place instead of being copied into
 * each nav link.
 */

import { describe, it, expect } from 'vitest';
import { getActiveHref } from '../../../src/app/dashboard/_components/nav-active-match';

const HREFS = [
  '/dashboard',
  '/dashboard/courses',
  '/dashboard/simulators',
  '/dashboard/simulators/tracks',
  '/dashboard/requests',
];

describe('getActiveHref', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/courses', '/dashboard/courses'],
    ['/dashboard/courses/123', '/dashboard/courses'],
    ['/dashboard/simulators', '/dashboard/simulators'],
    ['/dashboard/simulators/tracks', '/dashboard/simulators/tracks'],
    ['/dashboard/simulators/tracks/abc', '/dashboard/simulators/tracks'],
    ['/dashboard/requests', '/dashboard/requests'],
    ['/dashboard/requests/anything', '/dashboard/requests'],
  ])('resolves %s to the longest matching href (%s)', (pathname, expected) => {
    expect(getActiveHref(pathname, HREFS)).toBe(expected);
  });

  it('returns null when the pathname matches none of the hrefs', () => {
    expect(getActiveHref('/other', HREFS)).toBeNull();
  });

  it('returns null when pathname is null (usePathname() outside a router context)', () => {
    expect(getActiveHref(null, HREFS)).toBeNull();
  });

  it('does not match a href as a prefix without a path boundary (e.g. /dashboard/coursesx)', () => {
    expect(getActiveHref('/dashboard/coursesx', HREFS)).toBe('/dashboard');
  });
});
