import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { simulatorCertificates } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorCertificate } from '../domain/simulator-certificate.entity';
import type { SimulatorCertificateRepository } from '../domain/ports/simulator-certificate.repository';

/**
 * Maps a raw DB row to a SimulatorCertificate entity.
 */
function toEntity(row: typeof simulatorCertificates.$inferSelect): SimulatorCertificate {
  return new SimulatorCertificate({
    id: row.id,
    simulatorId: row.simulatorId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    certificateCode: row.certificateCode,
    score: row.score,
    studentName: row.studentName,
    simulatorTitle: row.simulatorTitle,
    academyName: row.academyName,
    issuedAt: row.issuedAt,
  });
}

/**
 * Drizzle implementation of SimulatorCertificateRepository — mirrors
 * `DrizzleCertificateRepository` (modules/course) verbatim.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * unique(simulator_id, clerk_user_id) backs `create` — a concurrent insert
 * race surfaces as a Postgres unique-violation (SQLSTATE 23505), which
 * propagates unmodified to the caller (IssueSimulatorCertificateUseCase
 * re-reads and returns the winning row instead of surfacing the DB error).
 */
export class DrizzleSimulatorCertificateRepository implements SimulatorCertificateRepository {
  async create(ctx: TenantContext, certificate: SimulatorCertificate): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(simulatorCertificates).values({
        id: certificate.id,
        simulatorId: certificate.simulatorId,
        academyId: certificate.academyId,
        clerkUserId: certificate.clerkUserId,
        certificateCode: certificate.certificateCode,
        score: certificate.score,
        studentName: certificate.studentName,
        simulatorTitle: certificate.simulatorTitle,
        academyName: certificate.academyName,
        issuedAt: certificate.issuedAt,
      }),
    );
  }

  async findBySimulatorAndUser(
    ctx: TenantContext,
    simulatorId: string,
    clerkUserId: string,
  ): Promise<SimulatorCertificate | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulatorCertificates)
        .where(
          and(
            eq(simulatorCertificates.simulatorId, simulatorId),
            eq(simulatorCertificates.clerkUserId, clerkUserId),
          ),
        );
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }
}
