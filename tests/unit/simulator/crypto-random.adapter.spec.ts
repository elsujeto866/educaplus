/**
 * CryptoRandomAdapter unit test — the production RandomPort implementation.
 *
 * Only asserts the contract (`next()` returns a float in [0, 1)) and that
 * consecutive calls vary — this is NOT where determinism is tested (that's
 * the selection engine's job, using a fake). Uses the Web Crypto API
 * (`crypto.getRandomValues`), never `Math.random`.
 */

import { describe, it, expect } from 'vitest';
import { CryptoRandomAdapter } from '../../../src/modules/simulator/infrastructure/crypto-random.adapter';

describe('CryptoRandomAdapter', () => {
  it('returns a float in the range [0, 1)', () => {
    const rng = new CryptoRandomAdapter();
    for (let i = 0; i < 50; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces varying values across calls (not a constant)', () => {
    const rng = new CryptoRandomAdapter();
    const values = new Set(Array.from({ length: 20 }, () => rng.next()));
    expect(values.size).toBeGreaterThan(1);
  });
});
