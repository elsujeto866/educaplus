import { ZodError } from 'zod';
import { UnauthorizedError, MissingTenantContextError } from '@/shared/kernel/tenant-context';

/**
 * ActionResult — the return shape every course-authoring Server Action
 * uses. Discriminated union so callers narrow on `ok` before reading
 * `error`.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Domain-error → Spanish message map, matched by `Error.name` (NOT
 * `instanceof`). We CANNOT `instanceof`-check classes from
 * `src/modules/*\/domain/**` here: eslint-boundaries forbids `delivery`
 * (src/app) from depending on the `domain` element — only `composition`
 * is reachable from delivery, and composition itself only re-exports use
 * cases, not domain error classes. Name-matching keeps this file
 * boundary-clean while still mapping every domain error the course
 * use-cases can throw.
 */
const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  SlugConflictError: 'Ya existe un curso con ese título.',
  InvalidReorderError: 'No se pudo reordenar.',
  CourseNotPublishedError: 'El curso debe estar publicado para esta acción.',
  DuplicateEnrollmentError: 'Ya estás inscripto en este curso.',
  DuplicateAssessmentError: 'Este módulo ya tiene una evaluación.',
  CourseNotFoundError: 'El curso no existe o no tenés acceso a él.',
  InvalidQuizQuestionError: 'La pregunta del cuestionario no es válida.',
  InvalidAssessmentError: 'No se pudo guardar la evaluación.',
  // Not a domain error (thrown by quiz/_lib/quiz-form.ts's parseQuizPayload)
  // but name-matched here too so saveQuizAction's single try/catch can map
  // it via the same toActionError() call, per design.md's canonical flow.
  InvalidQuizPayloadError: 'El cuestionario tiene un formato inválido.',
  // Slice 4b-ii (student quiz-taking): thrown by SubmitAttemptUseCase.
  LearnerNotEnrolledError: 'Necesitás estar inscripto para rendir la evaluación.',
  EmptyQuizError: 'La evaluación todavía no tiene preguntas.',
  InvalidAttemptError: 'Las respuestas enviadas no son válidas.',
};

/** Extracts the first Zod issue message, falling back to a generic one. */
export function firstZodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos.';
}

/**
 * Maps any error thrown by a use-case (or thrown before one runs) to an
 * `ActionResult` with a Spanish message. Unknown/unclassified errors fall
 * back to a generic message rather than leaking internal error text.
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
