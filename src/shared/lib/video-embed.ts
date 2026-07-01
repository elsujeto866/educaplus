/**
 * toEmbedUrl — converts a known video-host URL (YouTube, Vimeo) into an
 * iframe-embeddable URL. Returns `null` for unrecognized hosts or malformed
 * input — no network call, no secrets, deterministic and RSC-safe.
 *
 * Recognized forms:
 *   YouTube: watch?v={id}, youtu.be/{id}, /shorts/{id}  → youtube.com/embed/{id}
 *   Vimeo:   vimeo.com/{id}                              → player.vimeo.com/video/{id}
 *
 * Pure TS — zero imports (shared-lib boundary: may not depend on anything else).
 */
export function toEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const watchId = parsed.searchParams.get('v');
    if (watchId) return `https://www.youtube.com/embed/${watchId}`;

    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

    return null;
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '');
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === 'vimeo.com') {
    const id = parsed.pathname.replace(/^\//, '');
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}
