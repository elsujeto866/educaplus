import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { DashboardNav } from '../_components/dashboard-nav';
import { UserMenu } from '../_components/user-menu';
import { requireInstructor } from './_lib/require-instructor';
import { approveJoinRequestAction, rejectJoinRequestAction } from './actions';

/**
 * Admin approval queue — Server Component. Role-gated: only admin/instructor
 * reach this route (spec "Role- and Tenant-Scoped Queue Access", "Student
 * role denied"), enforced by `requireInstructor` before any data read.
 * `ListPendingJoinRequestsUseCase` already tenant-scopes the result via
 * `withTenant`/RLS (spec "Cross-academy isolation") — this page renders
 * whatever it returns, no client-side filtering.
 */
export default async function RequestsPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const pendingRequests = await makeAcademyComposition().listPendingJoinRequests.execute(ctx);

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title="Solicitudes"
          subtitle="Aprobá o rechazá las solicitudes de acceso a tu academia."
        />
        {pendingRequests.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay solicitudes pendientes.
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingRequests.map((request) => (
              <li key={request.id}>
                <Card className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">{request.email}</span>
                  <div className="flex shrink-0 gap-2">
                    <form action={rejectJoinRequestAction.bind(null, request.id)}>
                      <Button type="submit" variant="secondary">
                        Rechazar
                      </Button>
                    </form>
                    <form action={approveJoinRequestAction.bind(null, request.id)}>
                      <Button type="submit" variant="primary">
                        Aprobar
                      </Button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
