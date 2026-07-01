'use client';

import { useState } from 'react';
import { publishCourseAction, unpublishCourseAction, deleteCourseAction } from '../../actions';
import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';
import { ConfirmDialog } from '@/shared/ui/organisms/confirm-dialog';

// Inline literal union instead of importing `PublicationStatus` from the
// domain layer — same rationale as `courses/page.tsx`'s `STATUS_LABEL`
// (delivery may only reach `domain` via `composition`).
const STATUS_LABEL: Record<'draft' | 'published', string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

interface CourseStatusActionsProps {
  courseId: string;
  status: 'draft' | 'published';
}

/**
 * 'use client' island — status toggle (plain forms, fire-and-forget, per
 * design.md §2) plus delete-with-confirmation. Needs `useState` for the
 * confirm dialog's visibility, so the whole component is a client
 * boundary; `deleteCourseAction` is invoked directly (Server Actions are
 * callable as plain async functions from client code — not only via
 * `<form action>`), which lets the dialog's `onConfirm` trigger it without
 * a hidden-form workaround.
 */
export function CourseStatusActions({ courseId, status }: CourseStatusActionsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Estado: {STATUS_LABEL[status]}</span>
        {status === 'published' ? (
          <form action={unpublishCourseAction.bind(null, courseId)}>
            <Button type="submit" variant="secondary">
              Despublicar
            </Button>
          </form>
        ) : (
          <form action={publishCourseAction.bind(null, courseId)}>
            <Button type="submit" variant="primary">
              Publicar
            </Button>
          </form>
        )}
      </div>
      <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)}>
        Eliminar curso
      </Button>
      {confirmingDelete ? (
        <ConfirmDialog
          title="Eliminar curso"
          description="Esta acción no se puede deshacer. Se eliminarán todos los módulos y lecciones del curso."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            void deleteCourseAction(courseId, new FormData());
          }}
        />
      ) : null}
    </Card>
  );
}
