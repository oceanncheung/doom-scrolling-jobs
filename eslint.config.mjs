import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    // `.next*/**` covers both `.next/` (active build output) and any ` 2`/`3`-suffixed
    // duplicates created by editors or stale rebuilds (e.g. `.next 2/`). Keeping these
    // out of the lint crawl prevents transpiled output from flooding the report with
    // false errors about `require()` and unused-vars in generated code.
    '.next*/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
  ]),
])
