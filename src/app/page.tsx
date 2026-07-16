import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { PublicAcademiesDirectory } from './_components/public-academies-directory';

// The root route is the entry point: signed-in users go to their dashboard;
// everyone else lands on the public academies directory (untenanted, no forced
// login) where they can discover an academy and request access via /a/[slug].
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  const academies = await makeAcademyComposition().listPublicAcademies.execute();
  return <PublicAcademiesDirectory academies={academies} />;
}
