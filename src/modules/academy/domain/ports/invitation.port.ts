import type { Role } from '@/shared/kernel/tenant-context';

/**
 * Port: InvitationPort
 *
 * Sends an org invitation for an approved JoinRequest (Phase 3 —
 * ApproveJoinRequestUseCase). Implemented by ClerkInvitationAdapter, the
 * inverse of the existing Clerk role mapping used by SyncMembershipUseCase.
 *
 * Idempotent by contract: the adapter treats "already a member / pending
 * invitation" as success, since no email-based DB pre-check exists
 * (memberships has no email column — see design D3).
 */
export interface InvitationPort {
  inviteToAcademy(input: {
    academyId: string;
    email: string;
    role: Role;
    invitedBy: string;
  }): Promise<void>;
}
