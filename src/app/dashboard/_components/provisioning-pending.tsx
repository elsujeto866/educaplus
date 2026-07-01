import { Card } from '@/shared/ui/atoms/card';
import { PageHeader } from '@/shared/ui/molecules/page-header';

/**
 * Shown when a user has an active org (`ctx.orgId` is set) but no local
 * academy row exists yet AND either (a) the visiting user is not an admin
 * (so the lazy-ensure in the dashboard page is intentionally skipped — only
 * the org creator/admin may provision), or (b) the lazy-ensure attempt
 * failed. The Clerk `organization.created` webhook is expected to land
 * shortly and provision the row as an idempotent backstop.
 */
export function ProvisioningPending() {
  return (
    <Card className="w-full max-w-sm">
      <PageHeader
        title="Setting up your academy"
        subtitle="This usually takes just a moment. Refresh the page shortly."
      />
    </Card>
  );
}
