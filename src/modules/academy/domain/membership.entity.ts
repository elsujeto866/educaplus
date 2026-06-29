import type { Role } from '@/shared/kernel/tenant-context';

export interface MembershipProps {
  id: string;
  academyId: string;
  clerkUserId: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Membership domain entity — mirrors a Clerk organization membership.
 *
 * The unique key is (academyId, clerkUserId). Upserts on that pair are
 * idempotent and update role when the same event is re-delivered.
 *
 * Pure TS — zero infrastructure imports.
 */
export class Membership {
  readonly id: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly role: Role;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: MembershipProps) {
    if (!props.id) throw new Error('Membership: id is required');
    if (!props.academyId) throw new Error('Membership: academyId is required');
    if (!props.clerkUserId) throw new Error('Membership: clerkUserId is required');

    this.id = props.id;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.role = props.role;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  withRole(role: Role): Membership {
    return new Membership({ ...this, role, updatedAt: new Date() });
  }
}
