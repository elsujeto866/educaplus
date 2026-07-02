export interface CertificateProps {
  id: string;
  courseId: string;
  academyId: string;
  clerkUserId: string;
  certificateCode: string;
  /** Percentage score (0-100, integer) snapshotted from the passing attempt. */
  score: number;
  /** Snapshot of the learner's display name at issuance time. */
  studentName: string;
  /** Snapshot of the course title at issuance time. */
  courseTitle: string;
  /** Snapshot of the academy name at issuance time. */
  academyName: string;
  issuedAt: Date;
}

/**
 * Certificate entity — an immutable proof-of-completion credential.
 *
 * A certificate is a derived, point-in-time projection of "this student
 * passed this course's final quiz". Once issued it never changes: all
 * fields are readonly and IssueCertificateUseCase never updates an existing
 * row (see issue-certificate.use-case.ts). studentName/courseTitle/
 * academyName are snapshots taken at issuance — later renames elsewhere do
 * not retroactively change an already-issued certificate.
 *
 * Pure TS — zero infrastructure imports.
 */
export class Certificate {
  readonly id: string;
  readonly courseId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly certificateCode: string;
  readonly score: number;
  readonly studentName: string;
  readonly courseTitle: string;
  readonly academyName: string;
  readonly issuedAt: Date;

  constructor(props: CertificateProps) {
    if (!props.id) throw new Error('Certificate: id is required');
    if (!props.courseId) throw new Error('Certificate: courseId is required');
    if (!props.academyId) throw new Error('Certificate: academyId is required');
    if (!props.clerkUserId) throw new Error('Certificate: clerkUserId is required');
    if (!props.certificateCode) throw new Error('Certificate: certificateCode is required');
    if (!props.studentName) throw new Error('Certificate: studentName is required');
    if (!props.courseTitle) throw new Error('Certificate: courseTitle is required');
    if (!props.academyName) throw new Error('Certificate: academyName is required');
    if (!Number.isInteger(props.score) || props.score < 0 || props.score > 100) {
      throw new Error('Certificate: score must be an integer between 0 and 100');
    }

    this.id = props.id;
    this.courseId = props.courseId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.certificateCode = props.certificateCode;
    this.score = props.score;
    this.studentName = props.studentName;
    this.courseTitle = props.courseTitle;
    this.academyName = props.academyName;
    this.issuedAt = props.issuedAt;
  }
}
