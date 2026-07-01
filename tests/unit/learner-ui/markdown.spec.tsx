import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '../../../src/shared/ui/molecules/markdown';

describe('Markdown', () => {
  it('renders a heading from markdown syntax', () => {
    render(<Markdown content="# Titulo de la leccion" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Titulo de la leccion' })).toBeInTheDocument();
  });

  it('renders a bullet list from markdown syntax', () => {
    render(<Markdown content={'- Primero\n- Segundo'} />);
    const list = screen.getByRole('list');
    const items = screen.getAllByRole('listitem');
    expect(list).toBeInTheDocument();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Primero');
    expect(items[1]).toHaveTextContent('Segundo');
  });

  it('escapes raw HTML instead of rendering it as markup (no rehype-raw)', () => {
    const { container } = render(<Markdown content="Hola <b>Mundo</b>" />);

    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(/<b>Mundo<\/b>/)).toBeInTheDocument();
  });
});
