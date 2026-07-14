import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/nextjs/server before route.ts is imported.
// @clerk/nextjs/server uses server-only guards that throw outside the
// Next.js runtime — mocking prevents those guards from loading.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock the academy composition module to prevent the entire DB / drizzle /
// neon-serverless chain from loading in the test environment.
// handleWebhookEvent receives composition as a parameter, so makeAcademyComposition
// is only used by POST (not tested here).
vi.mock('@/modules/academy/composition', () => ({
  makeAcademyComposition: vi.fn(),
}));

import type { WebhookEvent } from '@clerk/nextjs/server';
import { handleWebhookEvent } from '../../src/app/api/webhooks/clerk/event-dispatch';
import type { AcademyComposition } from '../../src/modules/academy/composition';

// ---------------------------------------------------------------------------
// Mocked composition
// AcademyComposition members are concrete classes with private fields so
// structural mocking needs a type cast — the concrete class is not injectable
// via duck-typing. Cast through unknown to satisfy TypeScript.
// ---------------------------------------------------------------------------

const mockProvisionAcademy = { execute: vi.fn() };
const mockSyncMembership = { execute: vi.fn() };
const mockDeleteAcademy = { execute: vi.fn() };
const mockDeleteMembership = { execute: vi.fn() };
const mockFulfillJoinRequest = { execute: vi.fn() };

const mockComposition = {
  provisionAcademy: mockProvisionAcademy,
  syncMembership: mockSyncMembership,
  deleteAcademy: mockDeleteAcademy,
  deleteMembership: mockDeleteMembership,
  fulfillJoinRequest: mockFulfillJoinRequest,
} as unknown as AcademyComposition;

// ---------------------------------------------------------------------------
// Helpers to build minimal webhook event payloads
// ---------------------------------------------------------------------------

function orgEvent(type: 'organization.created' | 'organization.updated'): WebhookEvent {
  return {
    type,
    data: {
      id: 'org_test',
      name: 'Test Academy',
      slug: 'test-academy',
      object: 'organization',
      has_image: false,
      max_allowed_memberships: 5,
      admin_delete_enabled: true,
      public_metadata: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  } as unknown as WebhookEvent;
}

function orgDeletedEvent(): WebhookEvent {
  return {
    type: 'organization.deleted',
    data: {
      id: 'org_test',
      object: 'organization',
      deleted: true,
    },
  } as unknown as WebhookEvent;
}

function membershipEvent(
  type: 'organizationMembership.created' | 'organizationMembership.updated',
  role = 'org:admin',
): WebhookEvent {
  return {
    type,
    data: {
      id: 'orgmem_test',
      object: 'organization_membership',
      role,
      permissions: [],
      created_at: Date.now(),
      updated_at: Date.now(),
      organization: {
        id: 'org_test',
        name: 'Test Academy',
        slug: 'test-academy',
        object: 'organization',
        has_image: false,
        max_allowed_memberships: 5,
        admin_delete_enabled: true,
        public_metadata: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      public_user_data: {
        user_id: 'user_abc',
        identifier: 'test@example.com',
        first_name: null,
        last_name: null,
        image_url: '',
        has_image: false,
      },
      public_metadata: {},
    },
  } as unknown as WebhookEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleWebhookEvent — organization events', () => {
  it('calls provisionAcademy on organization.created', async () => {
    await handleWebhookEvent(orgEvent('organization.created'), mockComposition);

    expect(mockProvisionAcademy.execute).toHaveBeenCalledOnce();
    expect(mockProvisionAcademy.execute).toHaveBeenCalledWith(
      { orgId: 'org_test', userId: 'system', role: 'admin' },
      { orgId: 'org_test', name: 'Test Academy', slug: 'test-academy' },
    );
  });

  it('calls provisionAcademy on organization.updated (idempotent upsert)', async () => {
    await handleWebhookEvent(orgEvent('organization.updated'), mockComposition);

    expect(mockProvisionAcademy.execute).toHaveBeenCalledOnce();
  });

  it('calls deleteAcademy on organization.deleted', async () => {
    await handleWebhookEvent(orgDeletedEvent(), mockComposition);

    expect(mockDeleteAcademy.execute).toHaveBeenCalledOnce();
    expect(mockDeleteAcademy.execute).toHaveBeenCalledWith(
      { orgId: 'org_test', userId: 'system', role: 'admin' },
      'org_test',
    );
  });

  it('skips deleteAcademy when org.deleted event has no id', async () => {
    const event: WebhookEvent = {
      type: 'organization.deleted',
      data: { object: 'organization', deleted: true },
    } as unknown as WebhookEvent;

    await handleWebhookEvent(event, mockComposition);

    expect(mockDeleteAcademy.execute).not.toHaveBeenCalled();
  });
});

describe('handleWebhookEvent — membership events', () => {
  it('calls syncMembership on organizationMembership.created with correct role mapping', async () => {
    await handleWebhookEvent(membershipEvent('organizationMembership.created', 'org:admin'), mockComposition);

    expect(mockSyncMembership.execute).toHaveBeenCalledOnce();
    const [ctx, input] = mockSyncMembership.execute.mock.calls[0] as [unknown, { role: string }];
    expect((ctx as { orgId: string }).orgId).toBe('org_test');
    expect(input.role).toBe('admin');
  });

  it('maps org:instructor role correctly on organizationMembership.updated', async () => {
    await handleWebhookEvent(membershipEvent('organizationMembership.updated', 'org:instructor'), mockComposition);

    const [, input] = mockSyncMembership.execute.mock.calls[0] as [unknown, { role: string }];
    expect(input.role).toBe('instructor');
  });

  it('maps unknown role to student on organizationMembership.created', async () => {
    await handleWebhookEvent(membershipEvent('organizationMembership.created', 'org:member'), mockComposition);

    const [, input] = mockSyncMembership.execute.mock.calls[0] as [unknown, { role: string }];
    expect(input.role).toBe('student');
  });

  it('calls fulfillJoinRequest AFTER syncMembership on organizationMembership.created (reconciliation, Phase 4)', async () => {
    await handleWebhookEvent(membershipEvent('organizationMembership.created', 'org:admin'), mockComposition);

    expect(mockFulfillJoinRequest.execute).toHaveBeenCalledOnce();
    expect(mockFulfillJoinRequest.execute).toHaveBeenCalledWith(
      { orgId: 'org_test', userId: 'system', role: 'admin' },
      { academyId: 'org_test', email: 'test@example.com', membershipId: 'orgmem_test' },
    );

    const syncOrder = mockSyncMembership.execute.mock.invocationCallOrder[0]!;
    const fulfillOrder = mockFulfillJoinRequest.execute.mock.invocationCallOrder[0]!;
    expect(syncOrder).toBeLessThan(fulfillOrder);
  });

  it('does NOT call fulfillJoinRequest on organizationMembership.updated (reconciliation is create-only)', async () => {
    await handleWebhookEvent(membershipEvent('organizationMembership.updated', 'org:admin'), mockComposition);

    expect(mockFulfillJoinRequest.execute).not.toHaveBeenCalled();
  });

  it('calls deleteMembership on organizationMembership.deleted with correct tenant context', async () => {
    const event: WebhookEvent = {
      type: 'organizationMembership.deleted',
      data: {
        id: 'orgmem_test',
        object: 'organization_membership',
        role: 'org:admin',
        permissions: [],
        created_at: Date.now(),
        updated_at: Date.now(),
        organization: { id: 'org_test' },
        public_user_data: { user_id: 'user_abc' },
        public_metadata: {},
      },
    } as unknown as WebhookEvent;

    await handleWebhookEvent(event, mockComposition);

    expect(mockDeleteMembership.execute).toHaveBeenCalledOnce();
    expect(mockDeleteMembership.execute).toHaveBeenCalledWith(
      { orgId: 'org_test', userId: 'system', role: 'admin' },
      { academyId: 'org_test', clerkUserId: 'user_abc' },
    );
    expect(mockSyncMembership.execute).not.toHaveBeenCalled();
  });

  it('deleteMembership is idempotent — second deleted event for same user is a no-op success', async () => {
    const makeEvent = (): WebhookEvent =>
      ({
        type: 'organizationMembership.deleted',
        data: {
          id: 'orgmem_test',
          object: 'organization_membership',
          role: 'org:admin',
          permissions: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          organization: { id: 'org_test' },
          public_user_data: { user_id: 'user_abc' },
          public_metadata: {},
        },
      }) as unknown as WebhookEvent;

    // Simulate two webhook deliveries (Svix retries).
    await handleWebhookEvent(makeEvent(), mockComposition);
    await handleWebhookEvent(makeEvent(), mockComposition);

    // Both calls succeed; the underlying repo handles idempotency.
    expect(mockDeleteMembership.execute).toHaveBeenCalledTimes(2);
    expect(mockDeleteMembership.execute).toHaveBeenNthCalledWith(
      1,
      { orgId: 'org_test', userId: 'system', role: 'admin' },
      { academyId: 'org_test', clerkUserId: 'user_abc' },
    );
  });
});
