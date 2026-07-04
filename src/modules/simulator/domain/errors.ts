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
