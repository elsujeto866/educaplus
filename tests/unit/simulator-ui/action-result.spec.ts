/**
 * toActionError / firstZodMessage unit tests — simulators section.
 *
 * Pure mapping logic — no mocks. Mirrors
 * `tests/unit/course-authoring-ui/action-result.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import { ZodError, z } from 'zod';
import { UnauthorizedError, MissingTenantContextError } from '../../../src/shared/kernel/tenant-context';
import { toActionError, firstZodMessage } from '../../../src/app/dashboard/simulators/_lib/action-result';

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
    expect(firstZodMessage(makeZodError())).toBe('El título debe tener al menos 3 caracteres.');
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

  it('maps a domain QuestionBankNotFoundError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('QuestionBankNotFoundError'))).toEqual({
      ok: false,
      error: 'El banco de preguntas no existe o no tenés acceso a él.',
    });
  });

  it('maps a domain QuestionBankInUseError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('QuestionBankInUseError'))).toEqual({
      ok: false,
      error: 'Este banco está en uso por un simulador y no se puede eliminar.',
    });
  });

  it('maps a domain QuestionNotFoundError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('QuestionNotFoundError'))).toEqual({
      ok: false,
      error: 'La pregunta no existe o no tenés acceso a ella.',
    });
  });

  it('maps a domain InvalidQuestionError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidQuestionError'))).toEqual({
      ok: false,
      error: 'La pregunta no es válida. Verificá las opciones y la respuesta correcta.',
    });
  });

  it('maps a domain InvalidQuestionBankError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidQuestionBankError'))).toEqual({
      ok: false,
      error: 'El banco de preguntas no es válido.',
    });
  });

  it('maps a delivery InvalidOptionsPayloadError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidOptionsPayloadError'))).toEqual({
      ok: false,
      error: 'Las opciones de la pregunta tienen un formato inválido.',
    });
  });

  it('maps a domain SimulatorNotFoundError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('SimulatorNotFoundError'))).toEqual({
      ok: false,
      error: 'El simulador no existe o no tenés acceso a él.',
    });
  });

  it('maps a domain InvalidSimulatorError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidSimulatorError'))).toEqual({
      ok: false,
      error: 'Los datos del simulador no son válidos.',
    });
  });

  it('maps a domain InsufficientQuestionPoolError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InsufficientQuestionPoolError'))).toEqual({
      ok: false,
      error: 'El banco no tiene suficientes preguntas para publicar este simulador con la configuración actual.',
    });
  });

  it('maps a domain AttemptLimitReachedError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('AttemptLimitReachedError'))).toEqual({
      ok: false,
      error: 'Ya alcanzaste el límite de intentos permitidos para este simulador.',
    });
  });

  it('maps a domain SimulatorAttemptNotFoundError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('SimulatorAttemptNotFoundError'))).toEqual({
      ok: false,
      error: 'El intento no existe o no tenés acceso a él.',
    });
  });

  it('maps a domain AttemptAlreadySubmittedError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('AttemptAlreadySubmittedError'))).toEqual({
      ok: false,
      error: 'Este intento ya fue entregado y no se puede volver a enviar.',
    });
  });

  it('maps a domain InvalidAttemptAnswersError (matched by name) to a Spanish message', () => {
    expect(toActionError(namedError('InvalidAttemptAnswersError'))).toEqual({
      ok: false,
      error: 'Las respuestas enviadas no son válidas para este intento.',
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
