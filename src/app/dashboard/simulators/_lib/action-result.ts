import { ZodError } from 'zod';
import { UnauthorizedError, MissingTenantContextError } from '@/shared/kernel/tenant-context';

/**
 * ActionResult — the return shape every simulator-authoring Server Action
 * uses. Mirrors `courses/_lib/action-result.ts`'s discriminated union.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Domain-error → Spanish message map, matched by `Error.name` (NOT
 * `instanceof`) — same eslint-boundaries rationale as
 * `courses/_lib/action-result.ts`: `src/app` may not depend on `domain`
 * directly.
 */
const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  QuestionBankNotFoundError: 'El banco de preguntas no existe o no tenés acceso a él.',
  QuestionBankInUseError: 'Este banco está en uso por un simulacro y no se puede eliminar.',
  QuestionNotFoundError: 'La pregunta no existe o no tenés acceso a ella.',
  InvalidQuestionError: 'La pregunta no es válida. Verificá las opciones y la respuesta correcta.',
  InvalidQuestionBankError: 'El banco de preguntas no es válido.',
  // Not a domain error (thrown by `_lib/question-form.ts`'s parseOptionsPayload)
  // but name-matched here too, same rationale as course's InvalidQuizPayloadError.
  InvalidOptionsPayloadError: 'Las opciones de la pregunta tienen un formato inválido.',
  // Slice S3 — simulator definition + catalog.
  SimulatorNotFoundError: 'El simulacro no existe o no tenés acceso a él.',
  InvalidSimulatorError: 'Los datos del simulacro no son válidos.',
  InsufficientQuestionPoolError:
    'El banco no tiene suficientes preguntas para publicar este simulacro con la configuración actual.',
  // Slice S4 — attempt-taking.
  AttemptLimitReachedError: 'Ya alcanzaste el límite de intentos permitidos para este simulacro.',
  SimulatorAttemptNotFoundError: 'El intento no existe o no tenés acceso a él.',
  AttemptAlreadySubmittedError: 'Este intento ya fue entregado y no se puede volver a enviar.',
  InvalidAttemptAnswersError: 'Las respuestas enviadas no son válidas para este intento.',
  // Gamified Tracks — authoring (Phase 5).
  InvalidSimulatorTrackError: 'Los datos de la pista no son válidos.',
  SimulatorTrackNotFoundError: 'La pista no existe o no tenés acceso a ella.',
  InvalidSimulatorTrackStepError: 'El paso de la pista no es válido.',
  SimulatorTrackStepNotFoundError: 'El paso no existe en esta pista.',
  SimulatorAlreadyInTrackError: 'Este simulacro ya está asignado a otra pista.',
  SimulatorNotPublishedError: 'Solo se pueden agregar simulacros publicados a una pista.',
  TrackStepPositionConflictError: 'Otro paso ya ocupa esa posición. Probá de nuevo.',
  // Gamified Tracks — track publish/unpublish (Phase 5.4).
  EmptyTrackError: 'Esta pista todavía no tiene pasos y no se puede publicar.',
};

/** Extracts the first Zod issue message, falling back to a generic one. */
export function firstZodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos.';
}

/**
 * Maps any error thrown by a use-case (or thrown before one runs) to an
 * `ActionResult` with a Spanish message.
 */
export function toActionError(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    return { ok: false, error: firstZodMessage(error) };
  }

  if (error instanceof UnauthorizedError) {
    return { ok: false, error: 'No tenés permiso para realizar esta acción.' };
  }

  if (error instanceof MissingTenantContextError) {
    return { ok: false, error: 'No se pudo verificar tu sesión. Iniciá sesión de nuevo.' };
  }

  if (error instanceof Error) {
    const message = DOMAIN_ERROR_MESSAGES[error.name];
    if (message) return { ok: false, error: message };
  }

  return { ok: false, error: 'Ocurrió un error. Intentá de nuevo.' };
}
