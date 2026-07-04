import { InvalidQuestionBankError } from './errors';

export interface QuestionBankProps {
  id: string;
  academyId: string;
  title: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * QuestionBank entity — a reusable pool container for Question rows.
 *
 * A bank is authored independently of any simulator; simulators reference
 * exactly one bank (Decision 1: multi-bank per simulator is deferred).
 * Deleting a bank that is bound to a simulator is rejected at the use-case
 * level (Slice S2) — the FK is `onDelete=CASCADE` for academy teardown, not
 * a restrict, so this entity itself has no "is referenced" invariant to
 * check; that check requires a repository lookup and belongs to a use-case.
 *
 * Pure TS — zero infrastructure imports.
 */
export class QuestionBank {
  readonly id: string;
  readonly academyId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: QuestionBankProps) {
    if (!props.id) throw new Error('QuestionBank: id is required');
    if (!props.academyId) throw new Error('QuestionBank: academyId is required');
    if (!props.title || !props.title.trim()) {
      throw new InvalidQuestionBankError('title is required');
    }

    this.id = props.id;
    this.academyId = props.academyId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
