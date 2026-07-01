import Link from 'next/link';
import { clerkClient } from '@clerk/nextjs/server';
import type { TenantContext, Role } from '@/shared/kernel/tenant-context';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { Card } from '@/shared/ui/atoms/card';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { CoursesNavLink } from '../courses/_lib/courses-nav-link';
import { UserMenu } from './user-menu';
import { ProvisioningPending } from './provisioning-pending';

/**
 * UI-only Spanish labels for domain roles. Presentation concern, so it
 * lives in the delivery layer next to the page that renders it rather
 * than in the shared kernel (which stays free of copy/i18n concerns).
 */
const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  instructor: 'Instructor',
  student: 'Estudiante',
};

/**
 * Best-effort member count lookup. Prefers `Organization.membersCount`
 * (populated when `includeMembersCount: true` is passed to
 * `getOrganization`); falls back to the membership list's `totalCount` if
 * the field is absent. Returns `undefined` on any failure — the page
 * degrades to omitting the count rather than crashing.
 */
async function getMemberCount(orgId: string): Promise<number | undefined> {
  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({
      organizationId: orgId,
      includeMembersCount: true,
    });
    if (typeof org.membersCount === 'number') {
      return org.membersCount;
    }
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });
    return memberships.totalCount;
  } catch {
    return undefined;
  }
}

interface InstructorDashboardProps {
  ctx: TenantContext;
}

/**
 * Instructor/admin dashboard home — Server Component. Extracted verbatim
 * (byte-identical body) from the original unconditional `dashboard/page.tsx`
 * so the role-branch added there carries zero behavioral risk for this path
 * (spec.md "Instructor/admin path unchanged (regression)").
 *
 * Data flow: composition.getAcademy(ctx).
 *
 * Lazy-ensure (webhook race guard): if no local academy row exists yet,
 * ONLY an `admin` (the org creator) may provision it here — matches
 * `ProvisionAcademyUseCase`'s `assertRole(ctx, ['admin'])` guard. A
 * non-admin member arriving before the webhook lands would otherwise hit
 * that assertion and throw, so we skip the attempt entirely for
 * non-admins and show a themed waiting state instead. The ensure is also
 * wrapped in try/catch so any failure (network, Clerk API, race) degrades
 * to the same waiting state rather than crashing the page.
 */
export async function InstructorDashboard({ ctx }: InstructorDashboardProps) {
  const composition = makeAcademyComposition();

  let academy = await composition.getAcademy.execute(ctx);

  if (!academy && ctx.role === 'admin') {
    try {
      const clerk = await clerkClient();
      const organization = await clerk.organizations.getOrganization({
        organizationId: ctx.orgId,
      });
      await composition.provisionAcademy.execute(ctx, {
        orgId: ctx.orgId,
        name: organization.name,
        slug: organization.slug,
      });
      academy = await composition.getAcademy.execute(ctx);
    } catch {
      // Provisioning failed — fall through to the waiting state below.
      academy = null;
    }
  }

  if (!academy) {
    return (
      <AppShell userSlot={<UserMenu />}>
        <div className="flex flex-1 items-center justify-center">
          <ProvisioningPending />
        </div>
      </AppShell>
    );
  }

  const memberCount = await getMemberCount(ctx.orgId);

  return (
    <AppShell navSlot={<CoursesNavLink ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <PageHeader title={academy.name} />
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tu rol</span>
            <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              {ROLE_LABEL[ctx.role]}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Miembros</span>
            <span className="font-medium text-foreground">
              {memberCount !== undefined ? `${memberCount} miembros` : '—'}
            </span>
          </div>
        </Card>
        <Link
          href="/dashboard/organization"
          className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-surface"
        >
          Invitar miembros
        </Link>
      </div>
    </AppShell>
  );
}
