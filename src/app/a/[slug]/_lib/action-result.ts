/**
 * ActionResult for the public request-access form — deliberately its own
 * type (not the courses/_lib one) because the success case needs an inline
 * Spanish message (spec "Resubmission is idempotent" — the response must
 * inform the visitor they already have a pending request, not just silently
 * succeed or fail).
 */
export type RequestAccessActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const INVALID_EMAIL_MESSAGE = 'Ingresá un email válido.';
const GENERIC_ERROR_MESSAGE = 'Ocurrió un error. Intentá de nuevo.';

/**
 * Maps an error thrown by RequestAccessUseCase (or GetPublicAcademyUseCase)
 * to a Spanish ActionResult. The Email VO throws a plain Error (message
 * starts with "Invalid email") rather than a named domain error class, so
 * this matches by message prefix instead of `Error.name` — the only signal
 * available without importing domain classes into delivery (eslint
 * boundaries: delivery may not depend on `domain`).
 */
export function toRequestAccessActionError(error: unknown): RequestAccessActionResult {
  if (error instanceof Error && error.message.startsWith('Invalid email')) {
    return { ok: false, error: INVALID_EMAIL_MESSAGE };
  }
  return { ok: false, error: GENERIC_ERROR_MESSAGE };
}
