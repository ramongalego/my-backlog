import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Where code lives says where it runs (see CLAUDE.md, "Where things live").
// These rules hold that layering in place, so a wrong import fails lint here
// instead of the production build.
const restrict = (files, patterns, ignores = []) => ({
  files,
  ignores: ['**/*.test.ts', '**/*.test.tsx', ...ignores],
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

const SERVER_ONLY = {
  group: ['@/lib/server/*'],
  message:
    'lib/server runs on the server only. From the browser, call the API through lib/client.',
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Rules and helpers that run anywhere: no database client, no API calls,
  // no React. Types they need live with them, not with a component or a route.
  restrict(
    [
      'src/lib/games/**',
      'src/lib/suggest/**',
      'src/lib/stats/**',
      'src/lib/profile/**',
      'src/lib/diary/**',
      'src/lib/share/**',
      'src/lib/validations/**',
    ],
    [
      SERVER_ONLY,
      {
        group: ['@/lib/client/*', '@/lib/supabase/*', '@/components/*', '@/hooks/*'],
        message:
          'This folder holds pure rules that run anywhere: it must not import the database client, the API callers, components or hooks.',
      },
    ],
  ),

  // Hooks reach the server through lib/client.
  restrict(['src/hooks/**'], [SERVER_ONLY]),

  // Components reach the database and the API through hooks and lib/client.
  // Signing in and out is the exception: those talk to Supabase Auth directly.
  restrict(
    ['src/components/**'],
    [
      SERVER_ONLY,
      {
        group: ['@/lib/supabase/*'],
        message:
          'Components read and write through hooks and lib/client, not the database client.',
      },
    ],
    ['src/components/auth/**', 'src/components/layout/UserMenu.tsx'],
  ),
  restrict(['src/components/auth/**', 'src/components/layout/UserMenu.tsx'], [SERVER_ONLY]),

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Local design tooling, not part of the app (untracked).
    '.claude/**',
    'public/impeccable-detect.js',
  ]),
]);

export default eslintConfig;
