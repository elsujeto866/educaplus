import { InvalidAttemptError } from './errors';

/**
 * SubmittedAnswer — one learner-selected option per question, as submitted
 * at attempt time. Validated against the assessment's questions by
 * quiz-scoring.service.assertAnswersValid() before an entity is constructed.
 */
export interface SubmittedAnswer {
  readonly questionId: string;
  readonly selectedOptionId: string;
}

export interface AssessmentAttemptProps {
  id: string;
  assessmentId: string;
  academyId: string;
  clerkUserId: string;
  /** Full snapshot of the answers submitted for this attempt. */
  answers: SubmittedAnswer[];
  /** Percentage score (0-100, integer) computed by quiz-scoring.service. */
  score: number;
  passed: boolean;
  createdAt: Date;
}

/**
 * AssessmentAttempt entity — one historical row per learner submission.
 *
 * Unlimited retakes: no unique constraint on (assessmentId, clerkUserId) —
 * every submission is persisted as a distinct, immutable row. Scoring is
 * computed BEFORE this entity is constructed (see quiz-scoring.service) —
 * this entity is a pure data holder, mirroring the Assessment pattern.
 *
 * Pure TS — zero infrastructure imports.
 */
export class AssessmentAttempt {
  readonly id: string;
  readonly assessmentId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly answers: SubmittedAnswer[];
  readonly score: number;
  readonly passed: boolean;
  readonly createdAt: Date;

  constructor(props: AssessmentAttemptProps) {
    if (!props.id) throw new Error('AssessmentAttempt: id is required');
    if (!props.assessmentId) throw new Error('AssessmentAttempt: assessmentId is required');
    if (!props.academyId) throw new Error('AssessmentAttempt: academyId is required');
    if (!props.clerkUserId) throw new Error('AssessmentAttempt: clerkUserId is required');
    if (!Number.isInteger(props.score) || props.score < 0 || props.score > 100) {
      // Domain guard, not just a defensive assertion: with assertAnswersValid's
      // bijection enforced upstream this branch is unreachable in normal flow,
      // but it must still be a typed domain error (InvalidAttemptError), not a
      // generic Error, on this hostile-input path.
      throw new InvalidAttemptError('AssessmentAttempt: score must be an integer between 0 and 100');
    }
    if (typeof props.passed !== 'boolean') {
      throw new Error('AssessmentAttempt: passed must be a boolean');
    }

    this.id = props.id;
    this.assessmentId = props.assessmentId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.answers = props.answers;
    this.score = props.score;
    this.passed = props.passed;
    this.createdAt = props.createdAt;
  }
}
