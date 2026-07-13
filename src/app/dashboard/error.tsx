'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/ui/atoms/button';

/**
 * Dashboard route-segment error boundary. Catches any error thrown while
 * rendering a dashboard page (Server Component data reads, unexpected
 * runtime failures) and renders a recoverable message instead of letting
 * the error bubble to the framework's crash screen.
 *
 * Without this file, an uncaught render error anywhere under /dashboard
 * takes the whole page down with no retry path. `reset()` re-renders the
 * segment so a transient failure can be retried in place.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep a console trace for debugging in dev and in the browser.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        No pudimos completar la acción. Probá de nuevo; si el problema persiste, revisá el detalle abajo.
      </p>
      <pre className="max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-3 text-left text-xs text-muted-foreground">
        {error.message || 'Error desconocido.'}
        {error.digest ? `\n\nref: ${error.digest}` : ''}
      </pre>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
          Volver al inicio
        </Button>
      </div>
    </main>
  );
}
