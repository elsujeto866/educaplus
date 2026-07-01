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
        title="Solo por invitación"
        subtitle="Tu cuenta todavía no está habilitada para crear una academia. Pedile a un administrador que te invite, o esperá la aprobación."
      />
    </Card>
  );
}
