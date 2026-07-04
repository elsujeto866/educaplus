import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorCertificate } from '../simulator-certificate.entity';

/**
 * Port: SimulatorCertificateRepository — mirrors
 * `modules/course/domain/ports/certificate.repository.ts` verbatim.
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * unique(simulator_id, clerk_user_id) backs the (simulatorId, clerkUserId)
 * pair — `create` may reject with a Postgres unique-violation on an insert
 * race; the infra implementation is responsible for surfacing that so the
 * use-case can treat it idempotently.
 */
export interface SimulatorCertificateRepository {
  create(ctx: TenantContext, certificate: SimulatorCertificate): Promise<void>;

  /** The certificate for (simulatorId, clerkUserId), or null if none exists yet. */
  findBySimulatorAndUser(
    ctx: TenantContext,
    simulatorId: string,
    clerkUserId: string,
  ): Promise<SimulatorCertificate | null>;
}
