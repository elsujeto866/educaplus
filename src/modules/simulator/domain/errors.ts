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

export class InvalidSimulatorError extends Error {
  constructor(reason: string) {
    super(`Invalid simulator: ${reason}`);
    this.name = 'InvalidSimulatorError';
  }
}

export class SimulatorNotFoundError extends Error {
  constructor(simulatorId: string) {
    super(`Simulator "${simulatorId}" does not exist or does not belong to the caller's academy`);
    this.name = 'SimulatorNotFoundError';
  }
}

/**
 * Thrown by PublishSimulatorUseCase (spec.md "Bank has fewer questions than
 * required") when the bank's matching pool (after topicFilter) is smaller
 * than the simulator's requested questionCount. Publish-time is the gate —
 * the selection engine itself stays defensively tolerant (use-all, no
 * error) for the case where a bank shrinks again after publish.
 */
export class InsufficientQuestionPoolError extends Error {
  constructor(simulatorId: string, poolSize: number, requiredCount: number) {
    super(
      `Simulator "${simulatorId}" requires ${requiredCount} question(s) but its bank only has ${poolSize} matching question(s)`,
    );
    this.name = 'InsufficientQuestionPoolError';
  }
}
