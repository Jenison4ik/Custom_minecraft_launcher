import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/types/**',
        '**/vite.config.ts',
        '**/index.html',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/renderer/src/main.tsx',
        '**/renderer/src/App.tsx',
        '**/renderer/src/index.html',
      ],
    },
  },
});