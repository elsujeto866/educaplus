import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { CreateAcademyForm } from './_components/create-academy-form';
import { InviteOnlyScreen } from './_components/invite-only-screen';

/**
 * Restricted academy-creation gate — three branches:
 *   1. No authenticated user (defense-in-depth; middleware already
 *      redirects this case) → /sign-in.
 *   2. Active org already present (one academy per user) → /dashboard.
 *   3. No org: approved creators (`publicMetadata.canCreateAcademy ===
 *      true`) see Clerk's <CreateOrganization/>; everyone else sees the
 *      invite-only screen, with no creation form rendered.
 */
export default async function CreateAcademyPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  if (orgId) {
    redirect('/dashboard');
  }

  const user = await currentUser();
  const canCreateAcademy = user?.publicMetadata?.canCreateAcademy === true;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      {canCreateAcademy ? (
        <>
          <PageHeader
            title="Creá tu academia"
            subtitle="Configurá tu organización para empezar a enseñar."
          />
          <CreateAcademyForm />
        </>
      ) : (
        <InviteOnlyScreen />
      )}
    </main>
  );
}
