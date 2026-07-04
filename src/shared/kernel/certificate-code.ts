/**
 * certificate-code — pure derivation of a human-readable certificate code
 * from a certificate id and its issuance timestamp.
 *
 * Verbatim port of `modules/course/domain/services/certificate-code.service.ts`
 * into `shared/kernel` so `modules/simulator` can reuse it without a
 * cross-module domain import (disallowed by the boundaries ESLint rule).
 * Zero deps — safe to import from any `domain` layer.
 *
 * Deterministic and side-effect-free: the same (id, issuedAt) pair always
 * produces the same code, which is what makes it unit-testable and safe to
 * recompute if ever needed (e.g. re-rendering a printable certificate).
 * Uniqueness within an academy is enforced at the DB level via
 * unique(academy_id, certificate_code) — this function only formats.
 *
 * Format: CERT-{issuedAt.getUTCFullYear()}-{first 8 hex chars of the id,
 * dashes stripped, uppercased}.
 *
 * Pure TS — zero imports.
 */
export function formatCertificateCode(id: string, issuedAt: Date): string {
  const year = issuedAt.getUTCFullYear();
  const hex = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CERT-${year}-${hex}`;
}
