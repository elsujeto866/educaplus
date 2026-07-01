import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../src/shared/ui/atoms/badge';

describe('Badge', () => {
  it('renders its children as visible text', () => {
    render(<Badge>Publicado</Badge>);
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('renders different label text for different content (no hardcoded string)', () => {
    render(<Badge>Completada</Badge>);
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryByText('Publicado')).not.toBeInTheDocument();
  });
});
