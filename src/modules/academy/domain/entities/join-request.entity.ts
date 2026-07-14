import { Email } from '../value-objects/email.vo';
import { RequestStatus, type RequestStatusValue } from '../value-objects/request-status.vo';
import { JoinRequestAlreadyResolvedError, JoinRequestNotApprovedError } from '../errors';

export interface JoinRequestProps {
  id: string;
  academyId: string;
  /** Raw email — normalized (lowercase + trim) via Email VO in createPending(). */
  email: string;
  createdAt: Date;
  status?: RequestStatusValue;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  fulfilledAt?: Date | null;
  membershipId?: string | null;
}

interface JoinRequestState {
  id: string;
  academyId: string;
  email: string;
  status: RequestStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  fulfilledAt: Date | null;
  membershipId: string | null;
}

/**
 * JoinRequest domain entity — an email-only request to join an academy.
 *
 * Lifecycle: `pending` -> `approved` | `rejected` (terminal, exactly once —
 * see RequestStatus for the transition rules). "Fulfilled" is a derived
 * state (approved AND fulfilledAt NOT NULL), not a 4th status — set by the
 * reconciliation use-case when the matching membership webhook fires.
 *
 * The unique key enforced at the DB layer is a PARTIAL unique index on
 * (academyId, email) WHERE status='pending' — this entity does not itself
 * enforce dedup, that is the repository/DB's job (see design D — partial
 * unique index).
 *
 * Pure TS — zero infrastructure imports.
 */
export class JoinRequest {
  private readonly state: JoinRequestState;

  private constructor(state: JoinRequestState) {
    this.state = state;
  }

  /** Creates a brand-new `pending` join request. Normalizes email via Email VO. */
  static createPending(props: JoinRequestProps): JoinRequest {
    if (!props.id) throw new Error('JoinRequest: id is required');
    if (!props.academyId) throw new Error('JoinRequest: academyId is required');

    const email = Email.create(props.email).value;

    return new JoinRequest({
      id: props.id,
      academyId: props.academyId,
      email,
      status: RequestStatus.create(props.status ?? 'pending'),
      createdAt: props.createdAt,
      resolvedAt: props.resolvedAt ?? null,
      resolvedBy: props.resolvedBy ?? null,
      fulfilledAt: props.fulfilledAt ?? null,
      membershipId: props.membershipId ?? null,
    });
  }

  /** Reconstitutes a JoinRequest from persisted state (repository use). */
  static reconstitute(props: Required<Omit<JoinRequestProps, 'status'>> & { status: RequestStatusValue }): JoinRequest {
    return new JoinRequest({
      id: props.id,
      academyId: props.academyId,
      email: Email.create(props.email).value,
      status: RequestStatus.create(props.status),
      createdAt: props.createdAt,
      resolvedAt: props.resolvedAt,
      resolvedBy: props.resolvedBy,
      fulfilledAt: props.fulfilledAt,
      membershipId: props.membershipId,
    });
  }

  get id(): string {
    return this.state.id;
  }

  get academyId(): string {
    return this.state.academyId;
  }

  get email(): string {
    return this.state.email;
  }

  get status(): RequestStatusValue {
    return this.state.status.value;
  }

  get isPending(): boolean {
    return this.state.status.isPending;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get resolvedAt(): Date | null {
    return this.state.resolvedAt;
  }

  get resolvedBy(): string | null {
    return this.state.resolvedBy;
  }

  get fulfilledAt(): Date | null {
    return this.state.fulfilledAt;
  }

  get membershipId(): string | null {
    return this.state.membershipId;
  }

  /**
   * pending -> approved. Throws JoinRequestAlreadyResolvedError if the
   * request is not currently pending (no double-resolve invariant).
   */
  approve(resolvedBy: string, at: Date = new Date()): JoinRequest {
    if (!this.state.status.canTransitionTo('approved')) {
      throw new JoinRequestAlreadyResolvedError(this.state.id);
    }
    return new JoinRequest({
      ...this.state,
      status: this.state.status.transitionTo('approved'),
      resolvedAt: at,
      resolvedBy,
    });
  }

  /**
   * pending -> rejected. Throws JoinRequestAlreadyResolvedError if the
   * request is not currently pending (no double-resolve invariant).
   */
  reject(resolvedBy: string, at: Date = new Date()): JoinRequest {
    if (!this.state.status.canTransitionTo('rejected')) {
      throw new JoinRequestAlreadyResolvedError(this.state.id);
    }
    return new JoinRequest({
      ...this.state,
      status: this.state.status.transitionTo('rejected'),
      resolvedAt: at,
      resolvedBy,
    });
  }

  /**
   * Marks an approved request as fulfilled by a real membership
   * (reconciliation, Phase 4). Idempotent: calling fulfill() again on an
   * already-fulfilled request is a no-op — the FIRST fulfillment wins, so
   * webhook re-delivery never overwrites fulfilledAt/membershipId.
   */
  fulfill(membershipId: string, at: Date = new Date()): JoinRequest {
    if (this.state.status.value !== 'approved') {
      throw new JoinRequestNotApprovedError(this.state.id);
    }
    if (this.state.fulfilledAt) {
      return this;
    }
    return new JoinRequest({
      ...this.state,
      fulfilledAt: at,
      membershipId,
    });
  }
}
