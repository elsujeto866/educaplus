import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { LearnerHome } from './_components/learner-home';
import { InstructorDashboard } from './_components/instructor-dashboard';

/**
 * Dashboard — Server Component. Role branch only (spec.md "Dashboard Role
 * Branch"): students get the learner home, instructor/admin get the
 * pre-existing academy-info view (extracted verbatim to
 * `_components/instructor-dashboard.tsx` — see that file for the
 * lazy-ensure/provisioning behavior, unchanged by this branch).
 */
export default async function DashboardPage() {
  const ctx = await getTenantContext();

  if (ctx.role === 'student') {
    return <LearnerHome ctx={ctx} />;
  }

  return <InstructorDashboard ctx={ctx} />;
}
