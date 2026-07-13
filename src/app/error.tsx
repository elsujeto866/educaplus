'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/ui/atoms/button';

/**
 * Root error boundary — the app-wide safety net for any route segment that
 * does not define its own `error.tsx`. Renders a recoverable message rather
 * than the framework's crash screen. `reset()` retries the failed render.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error inesperado. Probá de nuevo; si el problema persiste, revisá el detalle abajo.
      </p>
      <pre className="max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-3 text-left text-xs text-muted-foreground">
        {error.message || 'Error desconocido.'}
        {error.digest ? `\n\nref: ${error.digest}` : ''}
      </pre>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
