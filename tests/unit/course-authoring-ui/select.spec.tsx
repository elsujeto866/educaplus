import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../../../src/shared/ui/atoms/select';

describe('Select', () => {
  it('renders the given options and reflects the selected value', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Tipo de lección" onChange={onChange} defaultValue="text">
        <option value="text">Texto</option>
        <option value="video">Video</option>
      </Select>,
    );

    const select = screen.getByLabelText('Tipo de lección');
    expect(select).toHaveValue('text');

    fireEvent.change(select, { target: { value: 'video' } });

    expect(select).toHaveValue('video');
    expect(onChange).toHaveBeenCalledOnce();
  });
});
