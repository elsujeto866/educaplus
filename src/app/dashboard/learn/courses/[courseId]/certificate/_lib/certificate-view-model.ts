export interface CertificateViewModel {
  studentName: string;
  courseTitle: string;
  academyName: string;
  score: number;
  issuedAtLabel: string;
  certificateCode: string;
}

/**
 * Structural shape `toCertificateView` accepts — deliberately NOT the
 * `Certificate` domain entity (design.md's "VM boundary"). This file lives
 * under `src/app/**` (the `delivery` element per eslint-plugin-boundaries),
 * which may depend on `composition` + `shared-ui`/`shared-lib` but NOT
 * `domain` directly. A structural param lets the page pass the entity
 * returned by `issueCertificate.execute()` (which satisfies this shape)
 * without this file ever importing `Certificate` itself.
 */
export interface CertificateStructuralInput {
  id: string;
  studentName: string;
  courseTitle: string;
  academyName: string;
  score: number;
  certificateCode: string;
  issuedAt: Date;
}

/**
 * toCertificateView — maps the structural certificate shape into the
 * `CertificateViewModel` the presentational `CertificateView` component
 * renders. `issuedAt` (a `Date`) is formatted to an `es-AR` locale string
 * here so the presentational component never needs to know about `Date`
 * formatting or locales.
 */
export function toCertificateView(cert: CertificateStructuralInput): CertificateViewModel {
  return {
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
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
