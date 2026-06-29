import type { WebhookEvent } from '@clerk/nextjs/server';
import type { AcademyComposition } from '@/modules/academy/composition';
import { mapClerkRole } from '@/shared/infrastructure/auth/clerk';
import type { TenantContext } from '@/shared/kernel/tenant-context';

/**
 * handleWebhookEvent — routes a verified Clerk webhook event to the correct
 * use-case on the composition.
 *
 * PROVENANCE rule: orgId is sourced exclusively from the Svix-verified
 * payload — never from external request parameters.
 *
 * Extracted from route.ts into this module so it can be unit-tested without
 * HTTP transport (Next.js route files may only export HTTP method handlers).
 */
export async function handleWebhookEvent(
  event: WebhookEvent,
  composition: AcademyComposition,
): Promise<void> {
  switch (event.type) {
    case 'organization.created':
    case 'organization.updated': {
      // PROVENANCE: orgId from Svix-verified payload only.
      const ctx: TenantContext = {
        orgId: event.data.id,
        userId: 'system',
        role: 'admin',
      };
      await composition.provisionAcademy.execute(ctx, {
        orgId: event.data.id,
        name: event.data.name,
        slug: event.data.slug,
      });
      break;
    }

    case 'organization.deleted': {
      const orgId = event.data.id;
      // Deleted org events may arrive without an id in rare edge cases.
      if (!orgId) break;

      const ctx: TenantContext = {
        orgId,
        userId: 'system',
        role: 'admin',
      };
      await composition.deleteAcademy.execute(ctx, orgId);
      break;
    }

    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      // PROVENANCE: orgId sourced from membership payload's verified org object.
      const orgId = event.data.organization.id;
      const ctx: TenantContext = {
        orgId,
        userId: 'system',
        role: 'admin',
      };
      await composition.syncMembership.execute(ctx, {
        id: event.data.id,
        academyId: orgId,
        clerkUserId: event.data.public_user_data.user_id,
        role: mapClerkRole(event.data.role),
      });
      break;
    }

    case 'organizationMembership.deleted':
      // Membership hard-delete deferred — MembershipRepository has no delete
      // port in this slice. Acknowledge receipt so Svix stops re-delivery.
      break;

    default:
      // Unknown / unhandled event type — acknowledge to suppress Svix retries.
      break;
  }
}
