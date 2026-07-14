import { withPublicRole } from '@/shared/infrastructure/db/with-public-role';
import { joinRequests } from '@/shared/infrastructure/db/schema/academy.schema';
import type { JoinRequest } from '../domain/entities/join-request.entity';
import type { JoinRequestSubmissionPort } from '../domain/ports/join-request-submission.port';

/**
 * Drizzle implementation of JoinRequestSubmissionPort (PUBLIC / UNTENANTED
 * insert path). ALL access goes through withPublicRole() — SET LOCAL ROLE
 * academy_public.
 *
 * insertPending() inserts ONLY (academyId, email, status) and NEVER calls
 * `.returning()`: academy_public has a column-scoped
 * `GRANT INSERT (academy_id, email, status)` and NO SELECT grant at all on
 * join_requests (see drizzle/0011_join_requests_rls.sql correction #3 and
 * tests/integration/rls/join-requests-isolation.spec.ts "academy_public
 * cannot SELECT join_requests") — every other column falls back to its
 * table default, and RETURNING would fail with permission-denied because it
 * requires SELECT privilege on the returned columns. Any Postgres error
 * (including the partial unique index's 23505 unique-violation) propagates
 * unmodified — RequestAccessUseCase is responsible for mapping it to an
 * 'already-pending' outcome (mirrors DrizzleCertificateRepository.create's
 * "propagates unmodified to the caller" convention).
 *
 * findPendingByAcademyAndEmail() always returns null in this real adapter:
 * a genuine SELECT here would ALWAYS throw permission-denied (no SELECT
 * grant exists at all, not just for this row), which would break EVERY
 * submission rather than only duplicates. The port's pre-check is therefore
 * only load-bearing for test doubles / in-memory fakes; the actual
 * duplicate-pending guarantee in production is the unique-violation catch
 * in RequestAccessUseCase. This is a known gap between the port's original
 * doc comment ("without relying on unique-violation as control flow") and
 * what the RLS grants (already shipped in PR1) actually allow — flagged as
 * a deviation in the PR2 apply-progress/verify report, not silently patched
 * over.
 */
export class DrizzlePublicJoinRequestRepository implements JoinRequestSubmissionPort {
  async findPendingByAcademyAndEmail(): Promise<JoinRequest | null> {
    return null;
  }

  async insertPending(joinRequest: JoinRequest): Promise<void> {
    await withPublicRole((tx) =>
      tx.insert(joinRequests).values({
        academyId: joinRequest.academyId,
        email: joinRequest.email,
        status: 'pending',
      }),
    );
  }
}
