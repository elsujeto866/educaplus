'use client';

import { Button } from '@/shared/ui/atoms/button';

/**
 * PrintButton — 'use client' island that triggers the browser's native
 * print dialog (spec.md's "Print Affordance"). `print:hidden` keeps it out
 * of the printed page — it is only a screen-time control.
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Imprimir / Descargar
    </Button>
  );
}
