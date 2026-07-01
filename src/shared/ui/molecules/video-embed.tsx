import { cn } from '@/shared/lib/cn';
import { toEmbedUrl } from '@/shared/lib/video-embed';

interface VideoEmbedProps {
  /** Raw video URL (YouTube, Vimeo, or anything else). */
  url: string;
  /** Accessible title for the iframe / fallback link context. */
  title: string;
  className?: string;
}

/**
 * Responsive 16:9 video embed. Pure presentational molecule — no
 * Clerk/composition imports (shared-ui boundary only allows shared-lib,
 * and `toEmbedUrl` lives in shared-lib per design). Converts the raw URL
 * via `toEmbedUrl`; unrecognized hosts fall back to a plain external link
 * instead of a broken iframe.
 */
export function VideoEmbed({ url, title, className }: VideoEmbedProps) {
  const embedUrl = toEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-surface p-6',
          className,
        )}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-accent underline underline-offset-2 hover:text-accent/80"
        >
          Ver video
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn('aspect-video w-full overflow-hidden rounded-lg border border-border', className)}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allowFullScreen
      />
    </div>
  );
}
