import { InvalidSimulatorError } from './errors';

/**
 * Selection strategy for drawing the attempt question set from the bank.
 * Only 'random' exists today (Decision 7) — the closed union leaves room
 * for a future 'random_per_topic'/'fixed' without touching every call site.
 */
export type SelectionStrategy = 'random';

const VALID_SELECTION_STRATEGIES: ReadonlySet<string> = new Set<SelectionStrategy>(['random']);

export interface SimulatorProps {
  id: string;
  academyId: string;
  /** Exactly one bank per simulator (Decision 1: multi-bank is deferred). */
  bankId: string;
  title: string;
  description?: string | null;
  /** How many questions an attempt snapshots — must be a positive integer. */
  questionCount: number;
  /** 0-100 integer — minimum percentage score required to pass. */
  passingScore: number;
  timeLimitMinutes: number;
  /** Per-student lifetime cap on attempts (Decision 6). */
  attemptLimit: number;
  selectionStrategy: SelectionStrategy;
  /** Nullable — flat string[] of topics; null/empty means no topic filter. */
  topicFilter?: string[] | null;
  status: 'draft' | 'published';
  /**
   * Whether passing this simulator issues a certificate (Slice S6 —
   * spec.md "Certificate on first pass (optional per simulator)"). Defaults
   * to `true` when omitted so every pre-existing simulator (created before
   * this column existed) keeps issuing certificates unchanged.
   */
  issuesCertificate?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simulator aggregate root — the RULES bound to exactly one QuestionBank
 * (Decision 1). Does NOT hold questions itself; the selection engine
 * (`domain/services/question-selection.service.ts`) draws from the bank at
 * StartAttempt time (Slice S4). New simulators always start in 'draft'
 * (spec.md "Define simulator": "New simulators start unpublished") —
 * enforced by CreateSimulatorUseCase, not this constructor (a rehydrated
 * simulator from the repository may legitimately already be 'published').
 *
 * Pure TS — zero infrastructure imports. Mirrors `Course`'s
 * publish()/unpublish() immutable-transition shape.
 */
export class Simulator {
  readonly id: string;
  readonly academyId: string;
  readonly bankId: string;
  readonly title: string;
  readonly description: string | null;
  readonly questionCount: number;
  readonly passingScore: number;
  readonly timeLimitMinutes: number;
  readonly attemptLimit: number;
  readonly selectionStrategy: SelectionStrategy;
  readonly topicFilter: string[] | null;
  readonly status: 'draft' | 'published';
  readonly issuesCertificate: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SimulatorProps) {
    if (!props.id) throw new Error('Simulator: id is required');
    if (!props.academyId) throw new Error('Simulator: academyId is required');
    if (!props.bankId) throw new Error('Simulator: bankId is required');
    if (!props.title || !props.title.trim()) {
      throw new InvalidSimulatorError('title is required');
    }
    if (!Number.isInteger(props.questionCount) || props.questionCount < 1) {
      throw new InvalidSimulatorError('questionCount must be a positive integer');
    }
    if (!Number.isInteger(props.passingScore) || props.passingScore < 0 || props.passingScore > 100) {
      throw new InvalidSimulatorError('passingScore must be an integer between 0 and 100');
    }
    if (!Number.isInteger(props.timeLimitMinutes) || props.timeLimitMinutes < 1) {
      throw new InvalidSimulatorError('timeLimitMinutes must be a positive integer');
    }
    if (!Number.isInteger(props.attemptLimit) || props.attemptLimit < 1) {
      throw new InvalidSimulatorError('attemptLimit must be a positive integer');
    }
    if (!VALID_SELECTION_STRATEGIES.has(props.selectionStrategy)) {
      throw new InvalidSimulatorError(`selectionStrategy "${props.selectionStrategy}" is not supported`);
    }
    if (props.topicFilter != null) {
      for (const topic of props.topicFilter) {
        if (!topic || !topic.trim()) {
          throw new InvalidSimulatorError('topicFilter entries must be non-empty strings');
        }
      }
    }

    this.id = props.id;
    this.academyId = props.academyId;
    this.bankId = props.bankId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.questionCount = props.questionCount;
    this.passingScore = props.passingScore;
    this.timeLimitMinutes = props.timeLimitMinutes;
    this.attemptLimit = props.attemptLimit;
    this.selectionStrategy = props.selectionStrategy;
    this.topicFilter = props.topicFilter ?? null;
    this.status = props.status;
    this.issuesCertificate = props.issuesCertificate ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get isPublished(): boolean {
    return this.status === 'published';
  }

  /** Returns a new Simulator instance with status set to 'published'. */
  publish(at: Date = new Date()): Simulator {
    return new Simulator({ ...this, status: 'published', updatedAt: at });
  }

  /** Returns a new Simulator instance with status set to 'draft'. */
  unpublish(at: Date = new Date()): Simulator {
    return new Simulator({ ...this, status: 'draft', updatedAt: at });
  }
}
