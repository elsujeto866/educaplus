import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Mirror ALL path aliases from tsconfig.json so vitest resolves them
// identically to TypeScript (including short aliases like @/config/*, @/db/*).
const alias = {
  '@': resolve(__dirname, 'src'),
  '@/app': resolve(__dirname, 'src/app'),
  '@/modules': resolve(__dirname, 'src/modules'),
  '@/shared': resolve(__dirname, 'src/shared'),
  '@/ui': resolve(__dirname, 'src/shared/ui'),
  '@/lib': resolve(__dirname, 'src/shared/lib'),
  '@/config': resolve(__dirname, 'src/shared/config'),
  '@/db': resolve(__dirname, 'src/shared/infrastructure/db'),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'domain',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
          // Force Next.js and Clerk through Vite's transform pipeline so that
          // @/ path aliases are applied for transitive src/ imports.
          server: {
            deps: {
              inline: ['next', '@clerk/nextjs'],
            },
          },
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          include: ['tests/unit/**/*.spec.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
  },
});
