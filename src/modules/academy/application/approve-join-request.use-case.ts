import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { JoinRequest } from '../domain/entities/join-request.entity';
import { JoinRequestNotFoundError } from '../domain/errors';
import type { JoinRequestRepository } from '../domain/ports/join-request.repository';
import type { InvitationPort } from '../domain/ports/invitation.port';

export interface ApproveJoinRequestInput {
  id: string;
}

/**
 * ApproveJoinRequestUseCase — pending -> approved + org invitation (Phase 3).
 *
 * Authorization: only `admin`/`instructor` may approve.
 *
 * Order of operations matters: the domain transition (`joinRequest.approve`)
 * runs first (in-memory, throws JoinRequestAlreadyResolvedError on a
 * double-resolve attempt WITHOUT any side effect — spec "Approve
 * already-resolved request rejected" — "no duplicate invitation is sent").
 * The invitation is sent BEFORE persisting: if InvitationPort rejects with a
 * genuine (non-idempotent) error, the request must stay `pending` in the DB
 * so the admin can retry — persisting `approved` first and inviting after
 * would strand the request in an approved-but-never-invited state.
 *
 * Member short-circuit (design D3): there is no DB-side pre-check (memberships
 * has no email column). `InvitationPort.inviteToAcademy` is idempotent by
 * contract — ClerkInvitationAdapter swallows "already a member / pending
 * invitation" responses — so this use-case can treat every non-throwing
 * `inviteToAcademy` call as success, whether it created a NEW invitation or
 * the email was already a member/invitee.
 */
export class ApproveJoinRequestUseCase {
  constructor(
    private readonly joinRequestRepo: JoinRequestRepository,
    private readonly invitationPort: InvitationPort,
  ) {}

  async execute(ctx: TenantContext, input: ApproveJoinRequestInput): Promise<JoinRequest> {
    assertRole(ctx, ['admin', 'instructor']);

    const joinRequest = await this.joinRequestRepo.findById(ctx, input.id);
    if (!joinRequest) throw new JoinRequestNotFoundError(input.id);

    const approved = joinRequest.approve(ctx.userId);

    await this.invitationPort.inviteToAcademy({
      academyId: ctx.orgId,
      email: approved.email,
      role: 'student',
      invitedBy: ctx.userId,
    });

    await this.joinRequestRepo.save(ctx, approved);
    return approved;
  }
}
