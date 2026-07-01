import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../../src/shared/ui/atoms/button';

describe('Button', () => {
  it('renders its children as button text', () => {
    render(<Button>Crear curso</Button>);
    expect(screen.getByRole('button', { name: 'Crear curso' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and does not fire onClick when the disabled prop is set', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards the type attribute (e.g. submit) to the underlying <button>', () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit');
  });
});
