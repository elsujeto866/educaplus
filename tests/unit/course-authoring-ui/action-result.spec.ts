/**
 * toActionError / firstZodMessage unit tests.
 *
 * Pure mapping logic — no mocks. Domain error classes are matched by
 * `error.name` (NOT `instanceof`) because `src/app` may not import
 * `src/modules/*\/domain/**` directly (eslint-boundaries: delivery is not
 * allowed to depend on the `domain` element). `UnauthorizedError` and
 * `MissingTenantContextError` DO live in `shared-kernel`, which delivery
 * IS allowed to import, so those two use real `instanceof` checks.
 */

import { describe, it, expect } from 'vitest';
import { ZodError, z } from 'zod';
import { UnauthorizedError, MissingTenantContextError } from '../../../src/shared/kernel/tenant-context';
import { toActionError, firstZodMessage } from '../../../src/app/dashboard/courses/_lib/action-result';

function namedError(name: string): Error {
  const error = new Error(`${name} message`);
  error.name = name;
  return error;
}

function makeZodError(): ZodError {
  const result = z.object({ title: z.string().min(3, 'El título debe tener al menos 3 caracteres.') }).safeParse({ title: 'ab' });
  if (result.success) throw new Error('expected failure');
  return result.error;
}

describe('firstZodMessage', () => {
  it('returns the first issue message from a ZodError', () => {
    const zodError = makeZodError();
    expect(firstZodMessage(zodError)).toBe('El título debe tener al menos 3 caracteres.');
  });
});

describe('toActionError', () => {
  it('maps a ZodError to its first issue message', () => {
    expect(toActionError(makeZodError())).toEqual({
      ok: false,
      error: 'El título debe tener al menos 3 caracteres.',
    });
  });

  it('maps UnauthorizedError (real shared-kernel class) to a Spanish permission message', () => {
    expect(toActionError(new UnauthorizedError())).toEqual({
      ok: false,
      error: 'No tenés permiso para realizar esta acción.',
    });
  });

  it('maps MissingTenantContextError to a Spanish session message', () => {
    expect(toActionError(new MissingTenantContextError())).toEqual({
      ok: false,
      error: 'No se pudo verificar tu sesión. Iniciá sesión de nuevo.',
    });
  });

  it('maps a domain SlugConflictError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('SlugConflictError'))).toEqual({
      ok: false,
      error: 'Ya existe un curso con ese título.',
    });
  });

  it('maps a domain InvalidReorderError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidReorderError'))).toEqual({
      ok: false,
      error: 'No se pudo reordenar.',
    });
  });

  it('maps a domain InvalidQuizQuestionError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidQuizQuestionError'))).toEqual({
      ok: false,
      error: 'La pregunta del cuestionario no es válida.',
    });
  });

  it('maps a domain InvalidAssessmentError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidAssessmentError'))).toEqual({
      ok: false,
      error: 'No se pudo guardar la evaluación.',
    });
  });

  it('maps a domain CourseNotFoundError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('CourseNotFoundError'))).toEqual({
      ok: false,
      error: 'El curso no existe o no tenés acceso a él.',
    });
  });

  it('maps a delivery InvalidQuizPayloadError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidQuizPayloadError'))).toEqual({
      ok: false,
      error: 'El cuestionario tiene un formato inválido.',
    });
  });

  it('falls back to a generic Spanish message for unrecognized errors', () => {
    expect(toActionError(namedError('SomeUnknownError'))).toEqual({
      ok: false,
      error: 'Ocurrió un error. Intentá de nuevo.',
    });
  });

  it('falls back to a generic Spanish message for non-Error thrown values', () => {
    expect(toActionError('a plain string was thrown')).toEqual({
      ok: false,
      error: 'Ocurrió un error. Intentá de nuevo.',
    });
  });
});
