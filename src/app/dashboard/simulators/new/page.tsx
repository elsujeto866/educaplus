import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../_components/user-menu';
import { CoursesNavLink } from '../../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../_lib/simulators-nav-link';
import { TracksNavLink } from '../_lib/tracks-nav-link';
import { requireInstructor } from '../_lib/require-instructor';
import { CreateBankForm } from './_components/create-bank-form';

/**
 * Create-bank shell — Server Component. Role-gated, no data reads;
 * `CreateBankForm` (the only interactive piece) is a client island that
 * calls the colocated `createBankAction`. Mirrors `courses/new/page.tsx`.
 */
export default async function NewBankPage() {
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
        <PageHeader title="Crear banco de preguntas" subtitle="Completá los datos para empezar." />
        <CreateBankForm />
      </div>
    </AppShell>
  );
}
