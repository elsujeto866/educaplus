'use client';

import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal confirmation dialog — pure presentational, all copy passed via
 * props (Spanish-agnostic, per shared-ui boundary rules: no
 * Clerk/composition imports, only `shared-lib`/other `shared-ui`). Renders
 * as a full-viewport overlay; visibility is controlled entirely by the
 * caller (mount/unmount), not internal state.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
    >
      <Card className="flex w-full max-w-sm flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
