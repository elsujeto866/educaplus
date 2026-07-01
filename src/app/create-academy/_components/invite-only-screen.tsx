import { Card } from '@/shared/ui/atoms/card';
import { PageHeader } from '@/shared/ui/molecules/page-header';

/**
 * Blocked screen shown to authenticated users with no active org who are
 * not approved (`publicMetadata.canCreateAcademy !== true`). No creation
 * form is rendered — academy creation is invite-only.
 */
export function InviteOnlyScreen() {
  return (
    <Card className="w-full max-w-sm">
      <PageHeader
        title="Invite-only"
        subtitle="Your account is not enabled to create an academy yet. Ask an existing admin to invite you, or wait for approval."
      />
    </Card>
  );
}
