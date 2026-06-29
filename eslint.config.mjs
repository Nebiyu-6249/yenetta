import base from './eslint.config.base.mjs';

// Root config lints repo-level scripts/config only; packages have their own.
export default [...base];
