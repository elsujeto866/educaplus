/**
 * PrintButton — 'use client' island tests (spec.md's "Print Affordance").
 * Clicking it must trigger the browser's native print dialog via
 * `window.print()`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintButton } from '../../../src/app/dashboard/learn/courses/[courseId]/certificate/_components/print-button';

describe('PrintButton', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  it('calls window.print() when clicked', () => {
    render(<PrintButton />);

    fireEvent.click(screen.getByRole('button'));

    expect(window.print).toHaveBeenCalledOnce();
  });
});
