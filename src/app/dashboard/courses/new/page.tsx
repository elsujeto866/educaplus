import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../_components/user-menu';
import { CoursesNavLink } from '../_lib/courses-nav-link';
import { requireInstructor } from '../_lib/require-instructor';
import { CreateCourseForm } from './_components/create-course-form';

/**
 * Create-course shell — Server Component. Role-gated, no data reads;
 * `CreateCourseForm` (the only interactive piece) is a client island that
 * calls the colocated `createCourseAction`.
 */
export default async function NewCoursePage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  return (
    <AppShell navSlot={<CoursesNavLink ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Crear curso" subtitle="Completá los datos para empezar." />
        <CreateCourseForm />
      </div>
    </AppShell>
  );
}
