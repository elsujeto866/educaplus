import { InvalidSimulatorAttemptError } from './errors';

/**
 * FrozenQuestion — one question as SNAPSHOTTED into an attempt at
 * StartAttempt time (Decision 1: snapshot column, not a join table).
 * Self-contained and immune to later edits/deletes on the source
 * `Question` row. Carries `correctOptionId` — the DB row is trusted with
 * it, but any view-model sent to the browser while the attempt is
 * in_progress MUST strip it (see the route's `_lib/attempt-view.ts`
 * mapper — SECURITY-CRITICAL, Decision 1's security note).
 */
export interface FrozenQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: { id: string; label: string }[];
  readonly correctOptionId: string;
}

/** One learner-selected option per question, as submitted at attempt time. */
export interface SubmittedAnswer {
  readonly questionId: string;
  readonly selectedOptionId: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';

const VALID_STATUSES: ReadonlySet<string> = new Set<AttemptStatus>([
  'in_progress',
  'submitted',
  'expired',
]);

export interface SimulatorAttemptProps {
  id: string;
  simulatorId: string;
  academyId: string;
  clerkUserId: string;
  status: AttemptStatus;
  /** FULL snapshot of the selected questions, frozen at StartAttempt time. */
  frozenQuestions: FrozenQuestion[];
  /** Null until the student submits (manually or via lazy expiry). */
  answers: SubmittedAnswer[] | null;
  /** Percentage score (0-100, integer) — null while in_progress. */
  score: number | null;
  passed: boolean | null;
  /** Server-authoritative — the timer starts here (Decision 5). */
  startedAt: Date;
  /** Server-computed = startedAt + simulator.timeLimitMinutes. */
  deadlineAt: Date;
  /** Null while in_progress; set on submit()/expire(). */
  submittedAt: Date | null;
  createdAt: Date;
}

/**
 * SimulatorAttempt entity — one row per attempt: frozen question snapshot +
 * answers + score + server-authoritative timing + status.
 *
 * Immutable transitions mirror `Simulator.publish()/unpublish()`:
 * `submit()` (on-time manual submission) and `expire()` (late manual
 * submission OR lazy/timeout auto-submit — both produce status 'expired',
 * per Decision 5: "late submissions are never rejected... status ->
 * 'expired'"). Both return a NEW instance; the original is left untouched.
 *
 * Pure TS — zero infrastructure imports.
 */
export class SimulatorAttempt {
  readonly id: string;
  readonly simulatorId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly status: AttemptStatus;
  readonly frozenQuestions: FrozenQuestion[];
  readonly answers: SubmittedAnswer[] | null;
  readonly score: number | null;
  readonly passed: boolean | null;
  readonly startedAt: Date;
  readonly deadlineAt: Date;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: SimulatorAttemptProps) {
    if (!props.id) throw new Error('SimulatorAttempt: id is required');
    if (!props.simulatorId) throw new Error('SimulatorAttempt: simulatorId is required');
    if (!props.academyId) throw new Error('SimulatorAttempt: academyId is required');
    if (!props.clerkUserId) throw new Error('SimulatorAttempt: clerkUserId is required');
    if (!VALID_STATUSES.has(props.status)) {
      throw new InvalidSimulatorAttemptError(`status "${props.status}" is not supported`);
    }
    if (!props.frozenQuestions || props.frozenQuestions.length === 0) {
      throw new InvalidSimulatorAttemptError('frozenQuestions must be a non-empty snapshot');
    }
    if (props.deadlineAt.getTime() <= props.startedAt.getTime()) {
      throw new InvalidSimulatorAttemptError('deadlineAt must be after startedAt');
    }

    if (props.status === 'in_progress') {
      if (props.score !== null || props.passed !== null || props.submittedAt !== null) {
        throw new InvalidSimulatorAttemptError(
          'an in_progress attempt must have null score, passed, and submittedAt',
        );
      }
    } else {
      // Finished (submitted/expired): score/passed/submittedAt are required.
      if (!Number.isInteger(props.score) || (props.score as number) < 0 || (props.score as number) > 100) {
        throw new InvalidSimulatorAttemptError(
          'a finished attempt must have an integer score between 0 and 100',
        );
      }
      if (typeof props.passed !== 'boolean') {
        throw new InvalidSimulatorAttemptError('a finished attempt must have a boolean passed value');
      }
      if (!props.submittedAt) {
        throw new InvalidSimulatorAttemptError('a finished attempt must have a submittedAt timestamp');
      }
    }

    this.id = props.id;
    this.simulatorId = props.simulatorId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.status = props.status;
    this.frozenQuestions = props.frozenQuestions;
    this.answers = props.answers;
    this.score = props.score;
    this.passed = props.passed;
    this.startedAt = props.startedAt;
    this.deadlineAt = props.deadlineAt;
    this.submittedAt = props.submittedAt;
    this.createdAt = props.createdAt;
  }

  get isInProgress(): boolean {
    return this.status === 'in_progress';
  }

  /** Returns a new instance transitioned to 'submitted' (on-time manual submit). */
  submit(input: { answers: SubmittedAnswer[]; score: number; passed: boolean; at: Date }): SimulatorAttempt {
    return new SimulatorAttempt({
      ...this,
      status: 'submitted',
      answers: input.answers,
      score: input.score,
      passed: input.passed,
      submittedAt: input.at,
    });
  }

  /**
   * Returns a new instance transitioned to 'expired' — used for BOTH a late
   * manual submission (deadline already passed when SubmitAttempt runs) and
   * a lazy/timeout auto-submit detected by GetAttemptUseCase. Never
   * rejected — the server always scores whatever answers arrived.
   */
  expire(input: { answers: SubmittedAnswer[]; score: number; passed: boolean; at: Date }): SimulatorAttempt {
    return new SimulatorAttempt({
      ...this,
      status: 'expired',
      answers: input.answers,
      score: input.score,
      passed: input.passed,
      submittedAt: input.at,
    });
  }
}
