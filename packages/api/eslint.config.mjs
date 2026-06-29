import base from '../../eslint.config.base.mjs';

export default [
  ...base,
  {
    rules: {
      // NestJS relies heavily on decorators and constructor injection.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
