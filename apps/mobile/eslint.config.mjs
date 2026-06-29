import base from '../../eslint.config.base.mjs';

export default [
  ...base,
  {
    ignores: ['.expo/**', 'babel.config.js', 'metro.config.js', 'index.js'],
  },
];
