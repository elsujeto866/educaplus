import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../../src/shared/ui/atoms/input';

describe('Input', () => {
  it('renders with the given placeholder and forwards typed value via onChange', () => {
    const onChange = vi.fn();
    render(<Input aria-label="Título" placeholder="Ej: Introducción a TypeScript" onChange={onChange} />);

    const input = screen.getByPlaceholderText('Ej: Introducción a TypeScript');
    fireEvent.change(input, { target: { value: 'Mi curso' } });

    expect(input).toHaveValue('Mi curso');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('respects the disabled attribute', () => {
    render(<Input aria-label="Título" disabled />);
    expect(screen.getByLabelText('Título')).toBeDisabled();
  });
});
