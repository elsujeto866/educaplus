import { Card } from '@/shared/ui/atoms/card';
import type { SimulatorCertificateViewModel } from '../_lib/certificate-view-model';

interface SimulatorCertificateViewProps {
  view: SimulatorCertificateViewModel;
}

/**
 * SimulatorCertificateView — presentational, prop-only certificate layout.
 * Mirrors `learn/courses/[courseId]/certificate/_components/certificate-view.tsx`
 * verbatim (view-model in, JSX out, no use-case/Clerk/DB calls). Cyberpunk
 * visual style on screen; `print:` utilities reset to a clean, legible
 * black-on-white layout for printing. Imports shared/ui atoms only — no
 * composition/domain imports.
 */
export function SimulatorCertificateView({ view }: SimulatorCertificateViewProps) {
  return (
    <Card className="flex flex-col items-center gap-6 border-2 border-primary bg-surface p-10 text-center shadow-lg print:border print:border-black print:bg-white print:text-black print:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary print:text-black">
        Certificado de aprobación
      </p>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground print:text-black">Otorgado a</p>
        <p className="text-3xl font-bold text-foreground print:text-black">{view.studentName}</p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground print:text-black">por aprobar el simulacro</p>
        <p className="text-xl font-semibold text-foreground print:text-black">
          {view.simulatorTitle}
        </p>
      </div>

      <p className="text-sm text-muted-foreground print:text-black">{view.academyName}</p>

      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-foreground print:text-black">
        <p>Puntaje: {view.score} / 100</p>
        <p>{view.issuedAtLabel}</p>
      </div>

      <p className="text-xs font-mono text-muted-foreground print:text-black">
        {view.certificateCode}
      </p>
    </Card>
  );
}
