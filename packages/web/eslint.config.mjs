import base from '../../eslint.config.base.mjs';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  {
    // Node-run config files may use Node globals.
    files: ['*.mjs', '*.config.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
