export interface SimulatorCertificateViewModel {
  studentName: string;
  simulatorTitle: string;
  academyName: string;
  score: number;
  issuedAtLabel: string;
  certificateCode: string;
}

/**
 * Structural shape `toSimulatorCertificateView` accepts — deliberately NOT
 * the `SimulatorCertificate` domain entity (mirrors course's "VM boundary").
 * This file lives under `src/app/**` (the `delivery` element per
 * eslint-plugin-boundaries), which may depend on `composition` +
 * `shared-ui`/`shared-lib` but NOT `domain` directly. A structural param
 * lets the page pass the entity returned by
 * `issueSimulatorCertificate.execute()` (which satisfies this shape)
 * without this file ever importing `SimulatorCertificate` itself.
 */
export interface SimulatorCertificateStructuralInput {
  id: string;
  studentName: string;
  simulatorTitle: string;
  academyName: string;
  score: number;
  certificateCode: string;
  issuedAt: Date;
}

/**
 * toSimulatorCertificateView — maps the structural certificate shape into
 * the `SimulatorCertificateViewModel` the presentational
 * `SimulatorCertificateView` component renders. Mirrors
 * `learn/courses/[courseId]/certificate/_lib/certificate-view-model.ts`'s
 * `toCertificateView` verbatim. `issuedAt` (a `Date`) is formatted to an
 * `es-AR` locale string here so the presentational component never needs to
 * know about `Date` formatting or locales.
 */
export function toSimulatorCertificateView(
  cert: SimulatorCertificateStructuralInput,
): SimulatorCertificateViewModel {
  return {
    studentName: cert.studentName,
    simulatorTitle: cert.simulatorTitle,
    academyName: cert.academyName,
    score: cert.score,
    issuedAtLabel: cert.issuedAt.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    certificateCode: cert.certificateCode,
  };
}
