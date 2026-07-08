import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../_components/user-menu';
import { CoursesNavLink } from '../../../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../../_lib/simulators-nav-link';
import { TracksNavLink } from '../../_lib/tracks-nav-link';
import { requireInstructor } from '../../_lib/require-instructor';
import { CreateTrackForm } from './_components/create-track-form';

/**
 * Create-track shell — Server Component. Role-gated, no data reads;
 * `CreateTrackForm` (the only interactive piece) is a client island that
 * calls the colocated `createTrackAction`. Mirrors `simulators/new/page.tsx`.
 */
export default async function NewTrackPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  return (
    <AppShell
      navSlot={
        <>
          <CoursesNavLink ctx={ctx} />
          <SimulatorsNavLink ctx={ctx} />
          <TracksNavLink ctx={ctx} />
        </>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Crear pista" subtitle="Completá los datos para empezar." />
        <CreateTrackForm />
      </div>
    </AppShell>
  );
}
