import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../_components/user-menu';
import { DashboardNav } from '../_components/dashboard-nav';
import { requireInstructor } from './_lib/require-instructor';

// Inline literal union instead of importing `Simulator`'s status type from
// the domain layer — `src/app` may not depend on `domain` directly
// (eslint-boundaries). Same rationale as `courses/page.tsx`'s STATUS_LABEL.
const STATUS_LABEL: Record<'draft' | 'published', string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

/**
 * Simulators home — Server Component. Reads `ListBanksUseCase` AND
 * `ListSimulatorsUseCase` through `makeSimulatorComposition()` (delivery
 * may only reach `application` via `composition`, never directly).
 * Role-gated: only admin/instructor reach this route. Two sections mirror
 * design Decision 9's "list banks+simulators": question banks (reusable
 * pools, Slice S2) and simulators (the exam RULES students actually take,
 * this slice) — each bank card links into a bank-scoped "Crear simulador"
 * flow (a simulator always binds to exactly one bank).
 */
export default async function SimulatorsPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeSimulatorComposition();
  const [banks, simulators] = await Promise.all([
    composition.listBanks.execute(ctx),
    composition.listSimulators.execute(ctx),
  ]);
  const bankTitleById = new Map(banks.map((bank) => [bank.id, bank.title]));

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simuladores" subtitle="Gestioná los bancos de preguntas y simuladores de tu academia." />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Bancos de preguntas</h2>
            <Link
              href="/dashboard/simulators/new"
              className="text-sm font-medium text-primary hover:underline"
            >
              Crear banco
            </Link>
          </div>
          {banks.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">Todavía no tenés bancos de preguntas</Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {banks.map((bank) => (
                <li key={bank.id}>
                  <Card className="flex flex-col gap-2">
                    <Link
                      href={`/dashboard/simulators/banks/${bank.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {bank.title}
                    </Link>
                    {bank.description ? (
                      <p className="text-sm text-muted-foreground">{bank.description}</p>
                    ) : null}
                    <Link
                      href={`/dashboard/simulators/banks/${bank.id}/simulators/new`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Crear simulador desde este banco
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">Simuladores</h2>
          {simulators.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">Todavía no tenés simuladores</Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {simulators.map((simulator) => (
                <li key={simulator.id}>
                  <Link
                    href={`/dashboard/simulators/${simulator.id}/edit`}
                    className="block rounded-lg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{simulator.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {bankTitleById.get(simulator.bankId) ?? 'Banco desconocido'}
                        </span>
                      </div>
                      <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                        {STATUS_LABEL[simulator.status]}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
