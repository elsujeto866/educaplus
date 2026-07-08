/**
 * TrackStepRow behavioral tests — Server Component (no hooks), but has real
 * conditional logic worth testing: the up/down reorder buttons must be
 * disabled at the ordering boundaries, and the simulator's status renders
 * as a badge. Mirrors `course-authoring-ui/module-row.spec.tsx`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/app/dashboard/simulators/tracks/actions', () => ({
  reorderTrackStepUpAction: vi.fn(),
  reorderTrackStepDownAction: vi.fn(),
  removeTrackStepAction: vi.fn(),
}));

describe('TrackStepRow', () => {
  it('disables the "up" button when isFirst is true, keeps "down" enabled', async () => {
    const { TrackStepRow } = await import(
      '../../../src/app/dashboard/simulators/tracks/[trackId]/_components/track-step-row'
    );
    render(
      <TrackStepRow
        trackId="track-1"
        stepId="step-1"
        position={1}
        simulatorTitle="Simulacro de álgebra"
        simulatorStatus="published"
        isFirst={true}
        isLast={false}
      />,
    );

    expect(screen.getByRole('button', { name: /hacia arriba/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /hacia abajo/i })).toBeEnabled();
  });

  it('disables the "down" button when isLast is true, keeps "up" enabled', async () => {
    const { TrackStepRow } = await import(
      '../../../src/app/dashboard/simulators/tracks/[trackId]/_components/track-step-row'
    );
    render(
      <TrackStepRow
        trackId="track-1"
        stepId="step-1"
        position={2}
        simulatorTitle="Simulacro de geometría"
        simulatorStatus="published"
        isFirst={false}
        isLast={true}
      />,
    );

    expect(screen.getByRole('button', { name: /hacia arriba/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /hacia abajo/i })).toBeDisabled();
  });

  it('shows the simulator title and its position', async () => {
    const { TrackStepRow } = await import(
      '../../../src/app/dashboard/simulators/tracks/[trackId]/_components/track-step-row'
    );
    render(
      <TrackStepRow
        trackId="track-1"
        stepId="step-1"
        position={3}
        simulatorTitle="Simulacro final"
        simulatorStatus="draft"
        isFirst={false}
        isLast={false}
      />,
    );

    expect(screen.getByText('Simulacro final')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders a "Borrador" badge when the underlying simulator is unpublished', async () => {
    const { TrackStepRow } = await import(
      '../../../src/app/dashboard/simulators/tracks/[trackId]/_components/track-step-row'
    );
    render(
      <TrackStepRow
        trackId="track-1"
        stepId="step-1"
        position={1}
        simulatorTitle="Simulacro sin publicar"
        simulatorStatus="draft"
        isFirst={true}
        isLast={true}
      />,
    );

    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('renders a remove button for the step', async () => {
    const { TrackStepRow } = await import(
      '../../../src/app/dashboard/simulators/tracks/[trackId]/_components/track-step-row'
    );
    render(
      <TrackStepRow
        trackId="track-1"
        stepId="step-1"
        position={1}
        simulatorTitle="Simulacro"
        simulatorStatus="published"
        isFirst={true}
        isLast={true}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
  });
});
