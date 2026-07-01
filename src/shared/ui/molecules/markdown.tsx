'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/shared/lib/cn';

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Themed markdown renderer for lesson text content. Pure presentational
 * molecule wrapping `react-markdown` — no Clerk/composition imports
 * (shared-ui boundary only allows shared-lib per eslint.config.mjs;
 * `react-markdown` is an external npm dep, outside the boundaries graph).
 *
 * Deliberately does NOT enable `rehype-raw` — raw HTML in the source
 * string is escaped and rendered as plain text, never as markup. Course
 * markdown comes from instructors and is treated as untrusted-ish input.
 */
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('flex flex-col gap-3 text-sm text-foreground', className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed text-foreground">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-foreground">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 hover:text-accent/80"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-xs">{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
