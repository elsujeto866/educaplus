/**
 * toEmbedUrl unit tests — pure function, zero mocks.
 *
 * Covers every recognized host form (YouTube watch/short-link/shorts, Vimeo)
 * plus the unrecognized-URL fallback to null.
 */

import { describe, it, expect } from 'vitest';
import { toEmbedUrl } from '../../../src/shared/lib/video-embed';

describe('toEmbedUrl', () => {
  it('converts a YouTube watch?v= URL to an embed URL', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('converts a youtu.be short-link URL to an embed URL', () => {
    expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('converts a YouTube /shorts/ URL to an embed URL', () => {
    expect(toEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('converts a Vimeo URL to an embed URL', () => {
    expect(toEmbedUrl('https://vimeo.com/76979871')).toBe(
      'https://player.vimeo.com/video/76979871',
    );
  });

  it('returns null for an unrecognized host', () => {
    expect(toEmbedUrl('https://example.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for a malformed URL string', () => {
    expect(toEmbedUrl('not-a-url')).toBeNull();
  });
});
