/**
 * BankOverview — presentational "Vista general" stat tiles. Pure props,
 * no framework/composition imports beyond React + shared-ui atoms.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('BankOverview', () => {
  it('renders the hero total question count', async () => {
    const { BankOverview } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-overview'
    );

    render(
      <BankOverview
        total={7}
        byDifficulty={{ easy: 2, medium: 3, hard: 1, unclassified: 1 }}
        byTopic={[{ topic: 'Álgebra', count: 5 }]}
      />,
    );

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/total de preguntas/i)).toBeInTheDocument();
  });

  it('renders labeled difficulty count chips, including "Sin clasificar"', async () => {
    const { BankOverview } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-overview'
    );

    render(
      <BankOverview
        total={7}
        byDifficulty={{ easy: 2, medium: 3, hard: 1, unclassified: 1 }}
        byTopic={[]}
      />,
    );

    expect(screen.getByText('Fácil')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('Difícil')).toBeInTheDocument();
    expect(screen.getByText('Sin clasificar')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the topic breakdown ordered as given, with counts', async () => {
    const { BankOverview } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-overview'
    );

    render(
      <BankOverview
        total={8}
        byDifficulty={{ easy: 0, medium: 0, hard: 0, unclassified: 8 }}
        byTopic={[
          { topic: 'Álgebra', count: 5 },
          { topic: 'Sin tema', count: 3 },
        ]}
      />,
    );

    expect(screen.getByText(/Álgebra/)).toBeInTheDocument();
    expect(screen.getByText(/Sin tema/)).toBeInTheDocument();
  });

  it('omits the topic breakdown section when there are no topics', async () => {
    const { BankOverview } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-overview'
    );

    render(<BankOverview total={0} byDifficulty={{ easy: 0, medium: 0, hard: 0, unclassified: 0 }} byTopic={[]} />);

    expect(screen.queryByText(/Por tema/i)).not.toBeInTheDocument();
  });
});
