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

// ---------------------------------------------------------------------------
// Slice S4 — Attempt-Taking
// ---------------------------------------------------------------------------

export class InvalidSimulatorAttemptError extends Error {
  constructor(reason: string) {
    super(`Invalid simulator attempt: ${reason}`);
    this.name = 'InvalidSimulatorAttemptError';
  }
}

/**
 * Collapses "not found", "cross-tenant" (RLS-hidden), "still draft", AND
 * "belongs to a different student" into ONE error across StartAttempt/
 * SubmitAttempt/GetAttempt — never confirms existence of a resource the
 * caller should not be able to see.
 */
export class SimulatorAttemptNotFoundError extends Error {
  constructor(attemptId: string) {
    super(`Simulator attempt "${attemptId}" does not exist or does not belong to the caller`);
    this.name = 'SimulatorAttemptNotFoundError';
  }
}

/**
 * Thrown by StartAttemptUseCase (spec.md "Attempt limit exhausted") — the
 * SERVER-SIDE gate, enforced BEFORE any new attempt row is created.
 */
export class AttemptLimitReachedError extends Error {
  constructor(simulatorId: string, limit: number) {
    super(`Simulator "${simulatorId}" attempt limit (${limit}) has already been reached`);
    this.name = 'AttemptLimitReachedError';
  }
}

/**
 * Thrown by SubmitAttemptUseCase when the attempt is no longer 'in_progress'
 * — enforces single-submission (spec.md abuse case: double-submit rejected).
 */
export class AttemptAlreadySubmittedError extends Error {
  constructor(attemptId: string) {
    super(`Simulator attempt "${attemptId}" has already been submitted and cannot be resubmitted`);
    this.name = 'AttemptAlreadySubmittedError';
  }
}

/**
 * Thrown by SubmitAttemptUseCase's answer-validation gate
 * (`assertPartialAnswersValid`) — an answer references a questionId/
 * selectedOptionId that doesn't belong to this attempt's frozen snapshot,
 * or the same questionId is answered more than once (blocks the same
 * duplicate-answer scoring exploit `shared/kernel/scoring` guards against).
 */
export class InvalidAttemptAnswersError extends Error {
  constructor(reason: string) {
    super(`Invalid attempt answers: ${reason}`);
    this.name = 'InvalidAttemptAnswersError';
  }
}

// ---------------------------------------------------------------------------
// Slice S5 — Certificate
// ---------------------------------------------------------------------------

export class InvalidSimulatorCertificateError extends Error {
  constructor(reason: string) {
    super(`Invalid simulator certificate: ${reason}`);
    this.name = 'InvalidSimulatorCertificateError';
  }
}

/**
 * Thrown by IssueSimulatorCertificateUseCase (mirrors course's
 * CertificateNotEarnedError) when the caller has never posted a passing
 * attempt for this simulator — defense-in-depth pass-gate, on top of the
 * page-level flow that should never reach this use-case without a pass.
 */
export class SimulatorCertificateNotEarnedError extends Error {
  constructor(simulatorId: string, clerkUserId: string) {
    super(
      `User "${clerkUserId}" has not passed simulator "${simulatorId}" — no certificate can be issued`,
    );
    this.name = 'SimulatorCertificateNotEarnedError';
  }
}

// ---------------------------------------------------------------------------
// Slice S6 — Per-simulator certificate toggle
// ---------------------------------------------------------------------------

/**
 * Thrown by IssueSimulatorCertificateUseCase when the simulator is
 * configured NOT to issue certificates (spec.md "Certificate on first pass
 * (optional per simulator)"). Mirrors the throw-based "skipped outcome"
 * convention already established by `SimulatorCertificateNotEarnedError` —
 * the delivery layer catches both by `Error.name` and redirects away from
 * the certificate route, never crashing. Checked AFTER the existing-
 * certificate lookup so a certificate issued before the toggle was flipped
 * off remains visible (immutability wins over a later config change).
 */
export class SimulatorCertificateNotConfiguredError extends Error {
  constructor(simulatorId: string) {
    super(`Simulator "${simulatorId}" is not configured to issue certificates`);
    this.name = 'SimulatorCertificateNotConfiguredError';
  }
}
