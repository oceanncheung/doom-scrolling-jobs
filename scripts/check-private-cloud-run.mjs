import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const expected = new Set([
  'scripts/deploy-cloud-run.sh',
  '.github/workflows/deploy-cloud-run.yml',
  'cloudbuild.yaml',
])
const self = 'scripts/check-private-cloud-run.mjs'
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : [path]
})
const files = [...walk(join(root, 'scripts')), ...walk(join(root, '.github')), join(root, 'cloudbuild.yaml')]
const found = new Set()

for (const path of files) {
  const name = relative(root, path)
  if (name === self) continue
  const text = readFileSync(path, 'utf8')
  assert(!/--no-invoker-iam-check|--allow-unauthenticated|invoker-iam-disabled|allUsers|allAuthenticatedUsers/.test(text), `${name}: public invocation must not be enabled`)
  const deploy = /gcloud\s+run\s+(?:deploy|services\s+update)|entrypoint:\s*gcloud|google-github-actions\/deploy-cloudrun/.test(text)
  if (!deploy) continue
  assert(expected.has(name), `${name}: review new Cloud Run deployment path`)
  assert.equal((text.match(/--invoker-iam-check\b/g) ?? []).length, 1, `${name}: require one explicit IAM check`)
  assert(text.includes('scripts/check-private-cloud-run.mjs'), `${name}: run this check before deployment`)
  found.add(name)
}

assert.deepEqual(found, expected, 'all three reviewed deployment paths must remain covered')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.scripts['deploy:cloud-run'], 'bash ./scripts/deploy-cloud-run.sh')
assert(!readdirSync(join(root, 'supabase/migrations')).some((name) => name.includes('restrict_public_data_api_access')), 'already-applied lockdown must stay outside automatic migration discovery')
console.log('PASS: all three Cloud Run deployment paths require IAM authentication; no public invocation flags or bindings.')
