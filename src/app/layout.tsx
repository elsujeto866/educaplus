import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { clerkAppearance } from './clerk-appearance';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'educaplus',
  description: 'Plataforma de aprendizaje con IA',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider appearance={clerkAppearance} localization={esES}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
