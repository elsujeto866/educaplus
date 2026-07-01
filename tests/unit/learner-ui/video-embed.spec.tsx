import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoEmbed } from '../../../src/shared/ui/molecules/video-embed';

describe('VideoEmbed', () => {
  it('renders a 16:9 iframe pointed at the embed URL for a recognized host', () => {
    render(<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Leccion 1" />);

    const iframe = screen.getByTitle('Leccion 1');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('renders a fallback external link when the host is not recognized', () => {
    render(<VideoEmbed url="https://example.com/video/123" title="Leccion 2" />);

    expect(screen.queryByTitle('Leccion 2')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Ver video' });
    expect(link).toHaveAttribute('href', 'https://example.com/video/123');
  });
});
