import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'drizzle/**',
    'tests/**',
  ]),

  // Allow _-prefixed args/vars to be unused (intentional "void" params).
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Hexagonal boundary rules (eslint-plugin-boundaries v6, flat config).
  // Root cause of previous inertness: eslint-plugin-boundaries v6 passes elements with
  // a `match` field but @boundaries/elements v2 reads `mode`. Adding explicit `mode: "file"`
  // overrides the mismatch — our patterns already include /**/* so file mode is correct.
  // Severity raised to "error" so CI fails on violations (design requirement).
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/modules/*/domain/**/*', mode: 'file', capture: ['module'] },
        { type: 'application', pattern: 'src/modules/*/application/**/*', mode: 'file', capture: ['module'] },
        { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**/*', mode: 'file', capture: ['module'] },
        { type: 'composition', pattern: 'src/modules/*/composition.ts', mode: 'file', capture: ['module'] },
        { type: 'delivery', pattern: 'src/app/**/*', mode: 'file' },
        { type: 'shared-ui', pattern: 'src/shared/ui/**/*', mode: 'file' },
        { type: 'shared-lib', pattern: 'src/shared/lib/**/*', mode: 'file' },
        { type: 'shared-infra', pattern: 'src/shared/infrastructure/**/*', mode: 'file' },
        { type: 'shared-config', pattern: 'src/shared/config/**/*', mode: 'file' },
        // shared-kernel: pure, framework-agnostic cross-cutting types (TenantContext, Role, errors).
        // Allowed as a dependency by all other layers; imports nothing from the element graph.
        { type: 'shared-kernel', pattern: 'src/shared/kernel/**/*', mode: 'file' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // domain: pure TS — no external layers. Intra-domain imports allowed (entities, value
            // objects, ports all live here), but ONLY within the same module: the `domain`/
            // `application` element types already capture `module` (see settings above); we
            // reference that capture (`${from.module}`) on the `to` side so a second module's
            // domain (e.g. modules/simulator) cannot import another module's domain
            // (e.g. modules/course) — that isolation was previously only enforced by code review.
            { from: [['domain', { module: '${from.module}' }]],
              allow: [['domain', { module: '${from.module}' }], 'shared-kernel'] },
            // application: own domain only — no infra, no framework
            { from: [['application', { module: '${from.module}' }]],
              allow: [['domain', { module: '${from.module}' }], 'shared-kernel'] },
            // infrastructure: implements ports; may read shared config + lib + kernel.
            // Also allowed to import shared-infra (e.g. module repos using the shared db client).
            { from: 'infrastructure', allow: ['domain', 'shared-kernel', 'shared-infra', 'shared-config', 'shared-lib'] },
            // composition: DI wiring layer; may wire application + infrastructure
            { from: 'composition', allow: ['application', 'infrastructure'] },
            // delivery (app/): thin HTTP/RSC adapter; intra-app imports (CSS, fonts) allowed
            { from: 'delivery', allow: ['delivery', 'composition', 'shared-ui', 'shared-lib', 'shared-config', 'shared-infra', 'shared-kernel'] },
            // shared-ui: presentational atoms/molecules/organisms; intra-layer composition
            // allowed (organisms compose atoms/molecules, e.g. ConfirmDialog uses Button+Card)
            // — mirrors 'domain' allowing intra-domain imports below. Only framework-agnostic
            // utils otherwise.
            { from: 'shared-ui', allow: ['shared-ui', 'shared-lib'] },
            // shared-infra: cross-cutting platform adapters (db/auth/ai); may read kernel types
            { from: 'shared-infra', allow: ['shared-config', 'shared-lib', 'shared-kernel'] },
            // shared-kernel: pure — imports nothing from the element graph
            { from: 'shared-kernel', allow: [] },
            // shared-config, shared-lib: pure — import nothing from the element graph
            { from: 'shared-config', allow: [] },
            { from: 'shared-lib', allow: [] },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
