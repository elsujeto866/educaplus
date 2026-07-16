import Link from 'next/link';
import { Card } from '@/shared/ui/atoms/card';
import { PageHeader } from '@/shared/ui/molecules/page-header';

/**
 * Delivery-owned view-model. Declared structurally (not imported from the
 * academy domain port) so this presentational component respects the
 * eslint-plugin-boundaries rule that forbids delivery → domain imports; the
 * public-safe `{ id, name, slug }` projection returned by the use-case is
 * structurally assignable to this shape.
 */
interface AcademyListItem {
  id: string;
  name: string;
  slug: string;
}

interface PublicAcademiesDirectoryProps {
  academies: AcademyListItem[];
}

/**
 * Public academies directory — the unauthenticated root landing. Untenanted
 * and login-free by design: a visitor discovers a published academy and
 * follows it to `/a/[slug]` to request access. Mirrors the plain-`<main>`
 * layout of the `/a/[slug]` page (no `AppShell`/`UserMenu`, which are
 * Clerk-bound and assume an authenticated session). A discreet sign-in link
 * lets returning users in without the page forcing login on everyone.
 */
export function PublicAcademiesDirectory({ academies }: PublicAcademiesDirectoryProps) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Academias" subtitle="Descubrí una academia y solicitá acceso." />

        {academies.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay academias disponibles todavía
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {academies.map((academy) => (
              <li key={academy.id}>
                <Link
                  href={`/a/${academy.slug}`}
                  className="block rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface"
                >
                  {academy.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/sign-in"
          className="text-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ¿Ya tenés cuenta? Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
