'use server';

import { z } from 'zod';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { toRequestAccessActionError, type RequestAccessActionResult } from './_lib/action-result';

/**
 * Public, UNTENANTED Server Action — request-access form on /a/[slug].
 * Deliberately never calls getTenantContext(): a visitor has no orgId
 * (design D1). `slug` is a bound argument from the page's URL param (same
 * bound-action convention as `enrollAction(courseId, ...)`), not read from
 * FormData — so it can't be spoofed by a hidden form field either way, but
 * more importantly the academyId used for the insert is resolved SERVER-SIDE
 * from that slug via GetPublicAcademyUseCase, never trusted from the client
 * (spec "academy_id is set server-side from the slug resolution").
 */

const requestAccessSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email.'),
});

export async function requestAccessAction(
  slug: string,
  _prevState: RequestAccessActionResult,
  formData: FormData,
): Promise<RequestAccessActionResult> {
  const parsed = requestAccessSchema.safeParse({
    email: (formData.get('email') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const composition = makeAcademyComposition();

  const academy = await composition.getPublicAcademy.execute(slug);
  if (!academy) {
    return { ok: false, error: 'Esta academia ya no está disponible.' };
  }

  try {
    const result = await composition.requestAccess.execute({
      id: crypto.randomUUID(),
      academyId: academy.id,
      email: parsed.data.email,
    });

    if (result.outcome === 'already-pending') {
      return { ok: true, message: 'Ya tenés una solicitud pendiente para esta academia.' };
    }

    return { ok: true, message: 'Solicitud enviada. Te contactaremos cuando sea aprobada.' };
  } catch (error) {
    return toRequestAccessActionError(error);
  }
}
