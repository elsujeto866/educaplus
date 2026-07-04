/**
 * Simulator domain errors.
 *
 * These are domain-layer invariant violations — not HTTP or infrastructure
 * errors. Use-cases and entities throw these; delivery/infra layers map them
 * to appropriate HTTP responses or log entries.
 *
 * Pure TS — zero imports.
 */

export class InvalidQuestionBankError extends Error {
  constructor(reason: string) {
    super(`Invalid question bank: ${reason}`);
    this.name = 'InvalidQuestionBankError';
  }
}

export class InvalidQuestionError extends Error {
  constructor(reason: string) {
    super(`Invalid question: ${reason}`);
    this.name = 'InvalidQuestionError';
  }
}

export class QuestionBankNotFoundError extends Error {
  constructor(bankId: string) {
    super(`Question bank "${bankId}" does not exist or does not belong to the caller's academy`);
    this.name = 'QuestionBankNotFoundError';
  }
}

export class QuestionBankInUseError extends Error {
  constructor(bankId: string) {
    super(`Question bank "${bankId}" is bound to at least one simulator and cannot be deleted`);
    this.name = 'QuestionBankInUseError';
  }
}

export class QuestionNotFoundError extends Error {
  constructor(questionId: string) {
    super(`Question "${questionId}" does not exist or does not belong to the caller's academy`);
    this.name = 'QuestionNotFoundError';
  }
}
