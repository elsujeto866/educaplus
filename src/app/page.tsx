import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

// The root route is the entry point: send signed-in users to their dashboard,
// everyone else to sign-in. There is no separate marketing landing yet.
export default async function Home() {
  const { userId } = await auth();
  redirect(userId ? '/dashboard' : '/sign-in');
}
