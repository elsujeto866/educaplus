'use client';

import { useEffect, useRef, useState } from 'react';

interface AttemptTimerProps {
  /** Server-issued absolute deadline (ISO string) — see `_lib/attempt-view.ts`. */
  deadlineAt: string;
  /** Fired exactly once when the countdown reaches zero. */
  onExpire: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Client-side countdown — UX ONLY (design Decision 5). Renders the
 * server-issued absolute `deadlineAt`; does NOT itself decide validity —
 * `SubmitAttemptUseCase` re-checks `now` vs `deadlineAt` server-side on
 * every submit and never trusts this component's clock. Fires `onExpire`
 * once the remaining time reaches zero so the runner can auto-submit
 * (spec.md "Timeout mid-exam").
 */
export function AttemptTimer({ deadlineAt, onExpire }: AttemptTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(deadlineAt).getTime() - Date.now());
  const onExpireRef = useRef(onExpire);

  // Keep the ref pointed at the LATEST `onExpire` without re-running the
  // countdown effect below on every render (assigning to `.current` during
  // render itself is disallowed by react-hooks/refs — must happen in an
  // effect).
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const deadline = new Date(deadlineAt).getTime();
    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        onExpireRef.current();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineAt]);

  return (
    <p role="timer" aria-live="polite" className="text-sm font-medium text-foreground">
      Tiempo restante: {formatRemaining(remainingMs)}
    </p>
  );
}
