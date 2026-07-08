import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrack } from '../simulator-track.entity';

/**
 * Port: SimulatorTrackRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS. Mirrors
 * `SimulatorRepository` shape. No `delete()` — deleting a track is out of
 * scope for this slice (not required by any spec scenario); its steps are
 * removed via CASCADE instead.
 */
export interface SimulatorTrackRepository {
  create(ctx: TenantContext, track: SimulatorTrack): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<SimulatorTrack | null>;

  /** Returns all tracks for the tenant academy, most recently created first. */
  findByAcademy(ctx: TenantContext, academyId: string): Promise<SimulatorTrack[]>;

  update(ctx: TenantContext, track: SimulatorTrack): Promise<void>;
}
