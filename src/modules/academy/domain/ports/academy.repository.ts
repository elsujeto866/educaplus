import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Academy } from '../academy.entity';

/**
 * Port: AcademyRepository
 *
 * Every method receives TenantContext as the first argument.
 * This is the compile-time enforcement that forces callers to have resolved
 * tenant identity before any DB operation — no implicit globals.
 *
 * The infrastructure adapter that implements this interface is the ONLY place
 * that accesses academy rows, and it does so exclusively via withTenant().
 */
export interface AcademyRepository {
  /**
   * Idempotent upsert — create or overwrite on conflict(id).
   * Used by ProvisionAcademyUseCase for both create and update webhooks.
   */
  upsert(ctx: TenantContext, academy: Academy): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Academy | null>;

  /**
   * Soft-delete — sets deleted_at to now().
   * Hard deletes are not exposed; data retention is handled out-of-band.
   */
  softDelete(ctx: TenantContext, id: string): Promise<void>;
}
