import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../_components/user-menu';
import { CoursesNavLink } from '../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from './_lib/simulators-nav-link';
import { requireInstructor } from './_lib/require-instructor';

/**
 * Question banks list — Server Component. Reads `ListBanksUseCase` through
 * `makeSimulatorComposition()` (delivery may only reach `application` via
 * `composition`, never directly). Role-gated: only admin/instructor reach
 * this route. Mirrors `courses/page.tsx`. Simulator RULES (the "simulacros"
 * students actually take) ship in Slice S3 — this route only manages the
 * reusable question pools that back them.
 */
export default async function SimulatorsPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const banks = await makeSimulatorComposition().listBanks.execute(ctx);

  return (
    <AppShell
      navSlot={
        <>
          <CoursesNavLink ctx={ctx} />
          <SimulatorsNavLink ctx={ctx} />
        </>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simulacros" subtitle="Gestioná los bancos de preguntas de tu academia." />
        <Link
          href="/dashboard/simulators/new"
          className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-surface"
        >
          Crear banco de preguntas
        </Link>
        {banks.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">Todavía no tenés bancos de preguntas</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {banks.map((bank) => (
              <li key={bank.id}>
                <Link
                  href={`/dashboard/simulators/banks/${bank.id}`}
                  className="block rounded-lg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Card>
                    <span className="font-medium text-foreground">{bank.title}</span>
                    {bank.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{bank.description}</p>
                    ) : null}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
