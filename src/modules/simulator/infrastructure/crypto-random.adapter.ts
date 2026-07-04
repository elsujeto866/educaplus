import type { RandomPort } from '../domain/ports/random.port';

/**
 * CryptoRandomAdapter — the production `RandomPort` implementation.
 *
 * Uses the Web Crypto API (`crypto.getRandomValues`) instead of
 * `Math.random()`: (1) domain code must stay decoupled from any concrete
 * RNG (see `random.port.ts`), and (2) `Math.random` is unavailable in some
 * runtimes this app targets, while `crypto` is already the codebase's
 * standard source of randomness (every `id` field uses
 * `crypto.randomUUID()`). Converts one unsigned 32-bit integer into a
 * float in [0, 1) — same contract as `Math.random()`.
 */
export class CryptoRandomAdapter implements RandomPort {
  next(): number {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return (buffer[0] as number) / 0x1_0000_0000;
  }
}
