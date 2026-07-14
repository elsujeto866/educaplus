/**
 * RequestStatus value object — lifecycle state of a JoinRequest.
 *
 * A JoinRequest starts `pending` and resolves EXACTLY ONCE, either to
 * `approved` or `rejected` (spec "Approve already-resolved request rejected"
 * / "Reject already-resolved request rejected"). `approved` and `rejected`
 * are terminal — no further transition is valid from either.
 *
 * Pure TS — zero imports.
 */
export type RequestStatusValue = 'pending' | 'approved' | 'rejected';

const VALID_VALUES: readonly RequestStatusValue[] = ['pending', 'approved', 'rejected'];

const VALID_TRANSITIONS: Record<RequestStatusValue, readonly RequestStatusValue[]> = {
  pending: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

function isRequestStatusValue(value: string): value is RequestStatusValue {
  return (VALID_VALUES as readonly string[]).includes(value);
}

export class RequestStatus {
  private readonly _value: RequestStatusValue;

  private constructor(value: RequestStatusValue) {
    this._value = value;
  }

  static create(raw: string): RequestStatus {
    if (!isRequestStatusValue(raw)) {
      throw new Error(
        `Invalid request status "${raw}": must be one of ${VALID_VALUES.join(', ')}.`,
      );
    }
    return new RequestStatus(raw);
  }

  static pending(): RequestStatus {
    return new RequestStatus('pending');
  }

  get value(): RequestStatusValue {
    return this._value;
  }

  get isPending(): boolean {
    return this._value === 'pending';
  }

  canTransitionTo(target: RequestStatusValue): boolean {
    return VALID_TRANSITIONS[this._value].includes(target);
  }

  transitionTo(target: RequestStatusValue): RequestStatus {
    if (!this.canTransitionTo(target)) {
      throw new Error(
        `Invalid request status transition: "${this._value}" -> "${target}".`,
      );
    }
    return new RequestStatus(target);
  }
}
