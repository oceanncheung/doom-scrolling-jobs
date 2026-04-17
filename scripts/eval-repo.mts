import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

import { getRankedJob } from '@/lib/data/jobs'
import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { chromium } from '@playwright/test'

import { defaultSmokeBaseUrl, getSmokeCookieHeader, getSmokeJobId, getSmokeOperatorId } from './smoke-helpers.mts'

type EvalLayerName = 'correctness' | 'workflows' | 'ui' | 'ui-artifacts'

interface CommandSpec {
  args: string[]
  command: string
  name: string
}

interface CommandResult {
  command: string
  durationMs: number
  failureReason: string | null
  logPath: string | null
  name: string
  pass: boolean
}

interface LayerResult {
  artifactPaths: string[]
  commands: CommandResult[]
  durationMs: number
  failureHint: string | null
  failureReason: string | null
  nextLookPaths: string[]
  pass: boolean
  scoreContribution: number
  summary: string
}

interface EvalReport {
  baseUrl: string
  coverageCaveats: CoverageCaveat[]
  layers: Record<EvalLayerName, LayerResult>
  maxScore: number
  preflight: PreflightResult
  regression: RegressionResult
  status: 'fail' | 'pass'
  timestamp: string
  totalScore: number
}

interface CoverageCaveat {
  id:
    | 'ai-generation-quality'
    | 'server-action-e2e-context'
    | 'live-external-sourcing'
    | 'ui-artifacts-review'
  summary: string
}

type CommandExecution = CommandResult

interface PreflightCheckResult {
  failureReason: string | null
  name: string
  pass: boolean
  relatedPaths: string[]
  summary: string
}

interface PreflightResult {
  checks: PreflightCheckResult[]
  durationMs: number
  pass: boolean
  summary: string
}

interface LayerRegressionResult {
  currentPass: boolean
  currentScore: number
  delta: number
  previousPass: boolean
  previousScore: number
}

interface ArtifactGenerationChange {
  addedPaths: string[]
  currentCount: number
  delta: number
  previousCount: number
  removedPaths: string[]
}

interface RegressionResult {
  artifactGenerationChanges: Record<'ui' | 'ui-artifacts', ArtifactGenerationChange>
  available: boolean
  comparedToPath: string | null
  comparedToTimestamp: string | null
  layerScoreChanges: Record<EvalLayerName, LayerRegressionResult>
  newlyFailingLayers: EvalLayerName[]
  repeatedWeakSpots: string[]
  resolvedFailures: string[]
  summary: string
}

interface ArtifactCollection {
  artifactPaths: string[]
  failureReason: string | null
}

interface DevServerHandle {
  baseUrl: string
  logPath: string | null
  startedByHarness: boolean
  stop: () => Promise<void>
}

const requiredLayers: EvalLayerName[] = ['correctness', 'workflows', 'ui']
const layerOrder: EvalLayerName[] = ['correctness', 'workflows', 'ui', 'ui-artifacts']
const projectRoot = process.cwd()
const evalBaseRoot = path.join(projectRoot, '.codex-artifacts/eval')
const evalRoot = path.join(evalBaseRoot, 'latest')
const evalRunsRoot = path.join(evalBaseRoot, 'runs')
const logsRoot = path.join(evalRoot, 'logs')
const uiArtifactRootRelative = '.codex-artifacts/eval/latest/ui'
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const layerArgIndex = process.argv.indexOf('--layer')
const requestedLayer =
  layerArgIndex >= 0 ? (process.argv[layerArgIndex + 1] as EvalLayerName | undefined) : undefined
const noReport = process.argv.includes('--no-report')
const managedHost = new URL(defaultSmokeBaseUrl).hostname
let baseUrl = defaultSmokeBaseUrl
const suppressedConsoleOutputPatterns = [
  /^⚠ "next start" does not work with "output: standalone" configuration\./,
  /^\(node:\d+\) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set\.$/,
  /^\(Use `node --trace-warnings .*$/,
] as const

const layerSpecs: Record<
  EvalLayerName,
  {
    commands: CommandSpec[]
    needsServer: boolean
    score: number
  }
> = {
  correctness: {
    commands: [
      { args: ['run', 'lint'], command: 'npm run lint', name: 'lint' },
      { args: ['run', 'typecheck'], command: 'npm run typecheck', name: 'typecheck' },
      { args: ['run', 'check:ui-system'], command: 'npm run check:ui-system', name: 'check:ui-system' },
      { args: ['run', 'build'], command: 'npm run build', name: 'build' },
    ],
    needsServer: false,
    score: 40,
  },
  workflows: {
    commands: [
      { args: ['run', 'smoke:import-contract'], command: 'npm run smoke:import-contract', name: 'smoke:import-contract' },
      { args: ['run', 'smoke:routes'], command: 'npm run smoke:routes', name: 'smoke:routes' },
      { args: ['run', 'smoke:packet'], command: 'npm run smoke:packet', name: 'smoke:packet' },
      { args: ['run', 'smoke:packet-persistence'], command: 'npm run smoke:packet-persistence', name: 'smoke:packet-persistence' },
      { args: ['run', 'smoke:server-action-workflow'], command: 'npm run smoke:server-action-workflow', name: 'smoke:server-action-workflow' },
      { args: ['run', 'smoke:workflow-state'], command: 'npm run smoke:workflow-state', name: 'smoke:workflow-state' },
      { args: ['run', 'smoke:workflow-transition'], command: 'npm run smoke:workflow-transition', name: 'smoke:workflow-transition' },
    ],
    needsServer: true,
    score: 25,
  },
  ui: {
    commands: [
      { args: ['run', 'test:ui-contracts'], command: 'npm run test:ui-contracts', name: 'test:ui-contracts' },
    ],
    needsServer: true,
    score: 20,
  },
  'ui-artifacts': {
    commands: [
      { args: ['run', 'capture:ui'], command: 'npm run capture:ui', name: 'capture:ui' },
    ],
    needsServer: true,
    score: 15,
  },
}

function toReportRelative(targetPath: string) {
  const relativePath = path.relative(evalRoot, targetPath).replaceAll(path.sep, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function compareSemver(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (delta !== 0) {
      return delta
    }
  }

  return 0
}

function sanitizeTimestampForPath(timestamp: string) {
  return timestamp.replaceAll(':', '-').replaceAll('.', '-')
}

async function exists(targetPath: string) {
  try {
    await fsp.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function mkdirp(targetPath: string) {
  await fsp.mkdir(targetPath, { recursive: true })
}

async function readJsonFile<T>(targetPath: string) {
  return JSON.parse(await fsp.readFile(targetPath, 'utf8')) as T
}

async function uniquePath(basePath: string) {
  if (!(await exists(basePath))) {
    return basePath
  }

  let index = 1
  while (await exists(`${basePath}-${index}`)) {
    index += 1
  }

  return `${basePath}-${index}`
}

async function createLogStream(logPath: string) {
  await mkdirp(path.dirname(logPath))
  return fs.createWriteStream(logPath, { flags: 'w' })
}

function buildChildEnv(extraEnv?: NodeJS.ProcessEnv) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...extraEnv,
  }

  if (env.FORCE_COLOR && env.NO_COLOR) {
    delete env.NO_COLOR
  }

  delete env.NO_COLOR
  delete env.FORCE_COLOR

  return env
}

function writeChunk(target: NodeJS.WriteStream, chunk: string | Buffer) {
  target.write(chunk)
}

function chunkToText(chunk: string | Buffer) {
  return typeof chunk === 'string' ? chunk : chunk.toString('utf8')
}

function writeTextWithConsoleFiltering(target: NodeJS.WriteStream, text: string) {
  const lines = text.split(/(?<=\n)/)

  for (const line of lines) {
    const normalizedLine = line.replace(/\r?\n$/, '')
    if (suppressedConsoleOutputPatterns.some((pattern) => pattern.test(normalizedLine))) {
      continue
    }

    writeChunk(target, line)
  }
}

function writeChunkWithConsoleFiltering(target: NodeJS.WriteStream, chunk: string | Buffer) {
  writeTextWithConsoleFiltering(target, chunkToText(chunk))
}

function extractJsonObject(text: string) {
  const startIndex = text.indexOf('{')
  const endIndex = text.lastIndexOf('}')

  if (startIndex < 0 || endIndex <= startIndex) {
    return null
  }

  try {
    return JSON.parse(text.slice(startIndex, endIndex + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function buildWorkflowSuccessSummary(commandName: CommandSpec['name'], stdout: string, stderr: string) {
  const payload = extractJsonObject(stdout) ?? extractJsonObject(stderr)

  switch (commandName) {
    case 'smoke:routes': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} route checks passed.`
    }
    case 'smoke:import-contract': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} import contract checks passed.`
    }
    case 'smoke:packet':
      return 'Packet review smoke passed.'
    case 'smoke:packet-persistence': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} packet persistence checks passed.`
    }
    case 'smoke:server-action-workflow': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} authenticated server-action checks passed.`
    }
    case 'smoke:workflow-state': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} workflow-state checks passed.`
    }
    case 'smoke:workflow-transition': {
      const results = Array.isArray(payload?.results) ? payload.results : []
      return `${results.length}/${results.length} workflow transition checks passed.`
    }
    default:
      return 'Workflow smoke passed.'
  }
}

async function runCommand(layerName: EvalLayerName, spec: CommandSpec, extraEnv?: NodeJS.ProcessEnv) {
  const startedAt = Date.now()
  // Sanitize the spec name — `check:ui-system` etc. would produce filenames containing a colon,
  // which `actions/upload-artifact@v4` rejects (invalid on NTFS).
  const logSafeName = spec.name.replace(/[^A-Za-z0-9._-]+/g, '-')
  const logPath = noReport ? null : path.join(logsRoot, `${layerName}-${logSafeName}.log`)
  const quietWorkflowSuccess = !noReport && layerName === 'workflows'

  const result = await new Promise<CommandExecution>((resolve) => {
    const child = spawn(npmCommand, spec.args, {
      cwd: projectRoot,
      env: buildChildEnv(extraEnv),
      stdio: noReport ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    })
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []

    const finish = (pass: boolean) =>
      resolve({
        command: spec.command,
        durationMs: Date.now() - startedAt,
        failureReason: pass ? null : buildCommandFailureReason(spec.name),
        logPath: logPath ? toReportRelative(logPath) : null,
        name: spec.name,
        pass,
      })

    if (!noReport && logPath) {
      void createLogStream(logPath).then((logStream) => {
        child.stdout?.on('data', (chunk) => {
          const text = chunkToText(chunk)
          stdoutChunks.push(text)
          if (!quietWorkflowSuccess) {
            writeTextWithConsoleFiltering(process.stdout, text)
          }
          writeChunk(logStream, chunk)
        })

        child.stderr?.on('data', (chunk) => {
          const text = chunkToText(chunk)
          stderrChunks.push(text)
          if (!quietWorkflowSuccess) {
            writeTextWithConsoleFiltering(process.stderr, text)
          }
          writeChunk(logStream, chunk)
        })

        child.on('close', () => {
          logStream.end()
        })

        child.on('error', (error) => {
          logStream.write(`${error}\n`)
          logStream.end()
        })
      })
    }

    child.on('close', (code) => {
      const pass = code === 0

      if (quietWorkflowSuccess) {
        const stdout = stdoutChunks.join('')
        const stderr = stderrChunks.join('')

        if (pass) {
          process.stdout.write(`[workflows] ${spec.name} passed — ${buildWorkflowSuccessSummary(spec.name, stdout, stderr)}\n`)
        } else {
          writeTextWithConsoleFiltering(process.stdout, stdout)
          writeTextWithConsoleFiltering(process.stderr, stderr)
        }
      }

      finish(pass)
    })
    child.on('error', () => finish(false))
  })

  return result
}

function buildCommandFailureReason(commandName: CommandSpec['name']) {
  switch (commandName) {
    case 'lint':
      return 'ESLint reported code issues or the lint configuration failed to load.'
    case 'typecheck':
      return 'TypeScript reported type, module-resolution, or configuration errors.'
    case 'check:ui-system':
      return 'The static UI-system audit found an ownership or contract violation.'
    case 'build':
      return 'The production build failed.'
    case 'smoke:routes':
      return 'One or more required routes returned an unexpected status.'
    case 'smoke:import-contract':
      return 'The deterministic sourcing/import smoke no longer matches the expected route contract, source resolution, or import normalization behavior.'
    case 'smoke:packet':
      return 'The packet smoke flow did not reach the expected review state.'
    case 'smoke:packet-persistence':
      return 'The packet persistence smoke could not save a deterministic draft packet or enforce the ready-state generation guardrail.'
    case 'smoke:server-action-workflow':
      return 'The authenticated updateJobWorkflow server action did not persist the expected archived state and event history under real cookie-backed request context.'
    case 'smoke:workflow-state':
      return 'The workflow-state domain contract no longer matches queue derivation or seeded ranked-job expectations.'
    case 'smoke:workflow-transition':
      return 'The workflow transition smoke could not persist the expected status change, event history, or queue-family result.'
    case 'test:ui-contracts':
      return 'A Playwright UI contract assertion failed.'
    case 'capture:ui':
      return 'The UI capture flow failed before producing the full screenshot bundle.'
    default:
      return 'The command exited non-zero.'
  }
}

async function readPackageMetadata() {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8')) as {
    engines?: {
      node?: string
    }
  }

  return {
    packageJson,
    packageJsonPath,
  }
}

async function runPreflight(targetedLayers: EvalLayerName[]): Promise<PreflightResult> {
  const startedAt = Date.now()
  const checks: PreflightCheckResult[] = []
  const needsServer = targetedLayers.some((layerName) => layerSpecs[layerName].needsServer)
  const needsUiBrowser = targetedLayers.some(
    (layerName) => layerName === 'ui' || layerName === 'ui-artifacts' || layerName === 'workflows',
  )
  const includesCorrectness = targetedLayers.includes('correctness')
  const { packageJson, packageJsonPath } = await readPackageMetadata()

  const requiredNodeRange = packageJson.engines?.node?.trim() ?? ''
  const minimumNodeVersion = requiredNodeRange.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1] ?? null
  const currentNodeVersion = process.versions.node
  checks.push(
    minimumNodeVersion && compareSemver(currentNodeVersion, minimumNodeVersion) < 0
      ? {
          failureReason: `Current Node ${currentNodeVersion} does not satisfy the repo requirement ${requiredNodeRange}.`,
          name: 'node-version',
          pass: false,
          relatedPaths: [toReportRelative(packageJsonPath)],
          summary: `Node ${currentNodeVersion} is below the required version ${requiredNodeRange}.`,
        }
      : {
          failureReason: null,
          name: 'node-version',
          pass: true,
          relatedPaths: [toReportRelative(packageJsonPath)],
          summary: minimumNodeVersion
            ? `Node ${currentNodeVersion} satisfies the repo requirement ${requiredNodeRange}.`
            : `Node ${currentNodeVersion} is available for the harness run.`,
        },
  )

  if (needsServer) {
    const buildIdPath = path.join(projectRoot, '.next', 'BUILD_ID')
    const buildExists = await exists(buildIdPath)
    checks.push(
      buildExists
        ? {
            failureReason: null,
            name: 'managed-build',
            pass: true,
            relatedPaths: [toReportRelative(buildIdPath)],
            summary: 'A production build is available for managed server startup.',
          }
        : includesCorrectness
          ? {
              failureReason: null,
              name: 'managed-build',
              pass: true,
              relatedPaths: [toReportRelative(packageJsonPath)],
              summary: 'No existing production build was found, but the correctness layer will create one before server-backed checks run.',
            }
          : {
              failureReason: 'Server-backed eval layers require an existing production build. Run `npm run build` or the full `npm run eval` first.',
              name: 'managed-build',
              pass: false,
              relatedPaths: [toReportRelative(packageJsonPath)],
              summary: 'A production build is required before server-backed layers can start.',
            },
    )

    try {
      await getSmokeCookieHeader()
      checks.push({
        failureReason: null,
        name: 'smoke-operator',
        pass: true,
        relatedPaths: [toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts'))],
        summary: 'A smoke-test operator can be resolved for authenticated route and UI checks.',
      })
    } catch (error) {
      checks.push({
        failureReason:
          error instanceof Error
            ? error.message
            : 'Smoke operator resolution failed.',
        name: 'smoke-operator',
        pass: false,
        relatedPaths: [
          toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts')),
          toReportRelative(path.join(projectRoot, 'lib/data/operators.ts')),
        ],
        summary: 'The harness could not resolve an operator for smoke authentication.',
      })
    }

    const smokeJobId = getSmokeJobId()
    try {
      if (hasSupabaseServerEnv()) {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('jobs')
          .select('id')
          .eq('id', smokeJobId)
          .maybeSingle()

        if (error || !data?.id) {
          checks.push({
            failureReason:
              error?.message ||
              `Smoke job fixture ${smokeJobId} could not be found in the jobs table.`,
            name: 'smoke-job-fixture',
            pass: false,
            relatedPaths: [
              toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts')),
              toReportRelative(path.join(projectRoot, 'lib/data/jobs.ts')),
            ],
            summary: `The configured smoke job fixture ${smokeJobId} is not available.`,
          })
        } else {
          checks.push({
            failureReason: null,
            name: 'smoke-job-fixture',
            pass: true,
            relatedPaths: [toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts'))],
            summary: `Smoke job fixture ${smokeJobId} exists in the persisted jobs data.`,
          })
        }
      } else {
        const { issue, job, source } = await getRankedJob(smokeJobId)
        if (!job) {
          checks.push({
            failureReason:
              issue ||
              `Smoke job fixture ${smokeJobId} could not be resolved from the ranked job data.`,
            name: 'smoke-job-fixture',
            pass: false,
            relatedPaths: [
              toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts')),
              toReportRelative(path.join(projectRoot, 'lib/data/jobs.ts')),
            ],
            summary: `The configured smoke job fixture ${smokeJobId} is not available.`,
          })
        } else {
          checks.push({
            failureReason: null,
            name: 'smoke-job-fixture',
            pass: true,
            relatedPaths: [toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts'))],
            summary: `Smoke job fixture ${smokeJobId} is available from the ${source} job data path.`,
          })
        }
      }
    } catch (error) {
      checks.push({
        failureReason:
          error instanceof Error
            ? error.message
            : `Smoke job fixture ${smokeJobId} could not be validated.`,
        name: 'smoke-job-fixture',
        pass: false,
        relatedPaths: [
          toReportRelative(path.join(projectRoot, 'scripts/smoke-helpers.mts')),
          toReportRelative(path.join(projectRoot, 'lib/data/jobs.ts')),
        ],
        summary: `The harness could not validate smoke job fixture ${smokeJobId}.`,
      })
    }

    if (targetedLayers.includes('workflows')) {
      checks.push(
        hasSupabaseServerEnv()
          ? {
              failureReason: null,
              name: 'workflow-mutation-storage',
              pass: true,
              relatedPaths: [
                toReportRelative(path.join(projectRoot, 'scripts/smoke-workflow-transition.mts')),
                toReportRelative(path.join(projectRoot, 'lib/supabase/server.ts')),
              ],
              summary: 'Persisted storage is available for the workflow transition smoke fixture.',
            }
          : {
              failureReason:
                'The workflow transition smoke requires Supabase server environment variables because it writes isolated smoke fixtures.',
              name: 'workflow-mutation-storage',
              pass: false,
              relatedPaths: [
                toReportRelative(path.join(projectRoot, 'scripts/smoke-workflow-transition.mts')),
                toReportRelative(path.join(projectRoot, 'lib/env.ts')),
              ],
              summary: 'Persisted storage is required before the workflow transition smoke can run.',
            },
      )

      if (hasSupabaseServerEnv()) {
        try {
          const operatorId = await getSmokeOperatorId()
          const supabase = createClient()
          const [{ data: profileData, error: profileError }, { data: resumeMasterData, error: resumeMasterError }] =
            await Promise.all([
              supabase
                .from('user_profiles')
                .select('id')
                .eq('operator_id', operatorId)
                .maybeSingle(),
              supabase
                .from('resume_master')
                .select('id')
                .eq('operator_id', operatorId)
                .maybeSingle(),
            ])

          checks.push(
            profileError || !profileData?.id
              ? {
                  failureReason:
                    profileError?.message ||
                    `Smoke operator ${operatorId} does not have a persisted user profile for workflow smoke setup.`,
                  name: 'workflow-mutation-profile',
                  pass: false,
                  relatedPaths: [
                    toReportRelative(path.join(projectRoot, 'scripts/smoke-workflow-transition.mts')),
                    toReportRelative(path.join(projectRoot, 'lib/data/operator-profile.ts')),
                  ],
                  summary: 'The workflow transition smoke fixture could not resolve a persisted profile for the smoke operator.',
                }
              : {
                  failureReason: null,
                  name: 'workflow-mutation-profile',
                  pass: true,
                  relatedPaths: [toReportRelative(path.join(projectRoot, 'scripts/smoke-workflow-transition.mts'))],
                  summary: 'The smoke operator has a persisted profile for isolated workflow transition fixtures.',
                },
          )

          checks.push(
            resumeMasterError || !resumeMasterData?.id
              ? {
                  failureReason:
                    resumeMasterError?.message ||
                    `Smoke operator ${operatorId} does not have a persisted resume master for packet persistence smoke setup.`,
                  name: 'packet-persistence-resume-master',
                  pass: false,
                  relatedPaths: [
                    toReportRelative(path.join(projectRoot, 'scripts/smoke-packet-persistence.mts')),
                    toReportRelative(path.join(projectRoot, 'lib/data/operator-profile.ts')),
                  ],
                  summary: 'The packet persistence smoke could not resolve a persisted resume master for the smoke operator.',
                }
              : {
                  failureReason: null,
                  name: 'packet-persistence-resume-master',
                  pass: true,
                  relatedPaths: [toReportRelative(path.join(projectRoot, 'scripts/smoke-packet-persistence.mts'))],
                  summary: 'The smoke operator has a persisted resume master for isolated packet persistence fixtures.',
                },
          )
        } catch (error) {
          checks.push({
            failureReason:
              error instanceof Error
                ? error.message
                : 'The harness could not verify the persisted workflow mutation profile fixture.',
            name: 'workflow-mutation-profile',
            pass: false,
            relatedPaths: [
              toReportRelative(path.join(projectRoot, 'scripts/smoke-workflow-transition.mts')),
              toReportRelative(path.join(projectRoot, 'lib/data/operator-profile.ts')),
            ],
            summary: 'The harness could not verify the persisted workflow mutation profile fixture.',
          })
          checks.push({
            failureReason:
              error instanceof Error
                ? error.message
                : 'The harness could not verify the persisted packet persistence resume-master fixture.',
            name: 'packet-persistence-resume-master',
            pass: false,
            relatedPaths: [
              toReportRelative(path.join(projectRoot, 'scripts/smoke-packet-persistence.mts')),
              toReportRelative(path.join(projectRoot, 'lib/data/operator-profile.ts')),
            ],
            summary: 'The harness could not verify the persisted packet persistence resume-master fixture.',
          })
        }
      }
    }
  }

  if (needsUiBrowser) {
    try {
      const chromiumPath = chromium.executablePath()
      const browserInstalled = Boolean(chromiumPath) && (await exists(chromiumPath))
      checks.push(
        browserInstalled
          ? {
              failureReason: null,
              name: 'playwright-chromium',
              pass: true,
              relatedPaths: [toReportRelative(path.join(projectRoot, 'playwright.config.ts'))],
                summary:
                  'Playwright Chromium is installed for authenticated server-action smoke coverage, UI assertions, and screenshot capture.',
            }
          : {
              failureReason: 'Playwright Chromium is not installed. Run `npx playwright install --with-deps chromium` before the UI layers.',
              name: 'playwright-chromium',
              pass: false,
              relatedPaths: [
                toReportRelative(path.join(projectRoot, 'playwright.config.ts')),
                toReportRelative(packageJsonPath),
              ],
              summary: 'The harness could not find a Chromium browser binary for Playwright.',
            },
      )
    } catch (error) {
      checks.push({
        failureReason:
          error instanceof Error
            ? error.message
            : 'Playwright Chromium could not be resolved.',
        name: 'playwright-chromium',
        pass: false,
        relatedPaths: [
          toReportRelative(path.join(projectRoot, 'playwright.config.ts')),
          toReportRelative(packageJsonPath),
        ],
        summary: 'The harness could not verify the Playwright Chromium dependency.',
      })
    }
  }

  const pass = checks.every((check) => check.pass)
  const passedChecks = checks.filter((check) => check.pass).length

  return {
    checks,
    durationMs: Date.now() - startedAt,
    pass,
    summary: pass
      ? `${passedChecks}/${checks.length} preflight checks passed. Required environment assumptions and smoke fixtures are ready.`
      : `${checks.length - passedChecks}/${checks.length} preflight checks failed. Resolve setup issues before rerunning the main eval layers.`,
  }
}

async function isServerHealthy(url: string) {
  try {
    const response = await fetch(`${url}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

async function allocatePort(host: string) {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate an eval port.')))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

async function waitForServer(url: string, timeoutMs: number, hasExited: () => boolean) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy(url)) {
      return true
    }

    if (hasExited()) {
      return false
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return false
}

async function startManagedAppServer() {
  const buildIdPath = path.join(projectRoot, '.next', 'BUILD_ID')
  if (!(await exists(buildIdPath))) {
    throw new Error(
      'Managed app server requires an existing production build. Run npm run eval or npm run build first.',
    )
  }

  const port = await allocatePort(managedHost)
  baseUrl = `http://${managedHost}:${port}`
  const logPath = noReport ? null : path.join(logsRoot, 'app-server.log')
  const parsedBaseUrl = new URL(baseUrl)
  const logStream = logPath ? await createLogStream(logPath) : null
  let exited = false
  let exitCode: number | null = null

  const child = spawn(
    npmCommand,
    ['run', 'start', '--', '--hostname', parsedBaseUrl.hostname, '--port', parsedBaseUrl.port || '3001'],
    {
      cwd: projectRoot,
      env: buildChildEnv(),
      stdio: logStream ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    },
  )

  if (logStream) {
    child.stdout?.on('data', (chunk) => {
      writeChunkWithConsoleFiltering(process.stdout, chunk)
      writeChunk(logStream, chunk)
    })
    child.stderr?.on('data', (chunk) => {
      writeChunkWithConsoleFiltering(process.stderr, chunk)
      writeChunk(logStream, chunk)
    })
  }

  child.on('close', (code) => {
    exited = true
    exitCode = code
    logStream?.end()
  })

  child.on('error', (error) => {
    exited = true
    logStream?.write(`${error}\n`)
    logStream?.end()
  })

  const ready = await waitForServer(baseUrl, 120000, () => exited)

  if (!ready) {
    child.kill('SIGTERM')
    const reason = exitCode != null
      ? `Managed app server exited before becoming healthy (code ${exitCode}).`
      : `Managed app server did not become healthy at ${baseUrl} within 120s.`

    throw new Error(
      logPath
        ? `${reason} See ${toReportRelative(logPath)} for startup logs.`
        : reason,
    )
  }

  return {
    baseUrl,
    logPath: logPath ? toReportRelative(logPath) : null,
    startedByHarness: true,
    stop: async () => {
      if (!exited) {
        child.kill('SIGTERM')
      }
    },
  } satisfies DevServerHandle
}

async function copyDirectoryIfPresent(sourcePath: string, destinationPath: string) {
  if (!(await exists(sourcePath))) {
    return false
  }

  await fsp.rm(destinationPath, { force: true, recursive: true })
  await fsp.cp(sourcePath, destinationPath, { recursive: true })
  return true
}

async function collectUiLayerArtifacts(): Promise<ArtifactCollection> {
  const artifactPaths: string[] = []
  const playwrightReportDestination = path.join(evalRoot, 'playwright-report')
  const testResultsDestination = path.join(evalRoot, 'test-results')

  const copiedPlaywrightReport = await copyDirectoryIfPresent(
    path.join(projectRoot, 'playwright-report'),
    playwrightReportDestination,
  )
  const copiedTestResults = await copyDirectoryIfPresent(
    path.join(projectRoot, 'test-results'),
    testResultsDestination,
  )

  if (copiedPlaywrightReport) {
    const indexPath = path.join(playwrightReportDestination, 'index.html')
    if (await exists(indexPath)) {
      artifactPaths.push(toReportRelative(indexPath))
    }
  }

  if (copiedTestResults && (await exists(testResultsDestination))) {
    artifactPaths.push(toReportRelative(testResultsDestination))
  }

  return {
    artifactPaths,
    failureReason:
      artifactPaths.length === 0
        ? 'UI assertions passed, but no Playwright report or test results were copied into the eval bundle.'
        : null,
  }
}

async function collectUiArtifactLayerArtifacts(): Promise<ArtifactCollection> {
  const artifactPaths: string[] = []
  const manifestPath = path.join(evalRoot, 'ui', 'manifest.json')

  if (!(await exists(manifestPath))) {
    return {
      artifactPaths,
      failureReason: 'UI artifact capture did not produce ./ui/manifest.json.',
    }
  }

  artifactPaths.push(toReportRelative(manifestPath))

  try {
    const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
      items?: Array<{ outputPath?: string }>
    }

    const missingArtifactPaths: string[] = []

    for (const item of manifest.items ?? []) {
      if (!item.outputPath) {
        continue
      }

      const artifactPath = path.join(evalRoot, 'ui', item.outputPath)
      if (await exists(artifactPath)) {
        artifactPaths.push(toReportRelative(artifactPath))
      } else {
        missingArtifactPaths.push(item.outputPath)
      }
    }

    if (missingArtifactPaths.length > 0) {
      return {
        artifactPaths,
        failureReason: `UI artifact manifest references missing files: ${missingArtifactPaths.join(', ')}.`,
      }
    }

    return {
      artifactPaths,
      failureReason:
        artifactPaths.length <= 1
          ? 'UI artifact capture completed, but no screenshots were found beside the manifest.'
          : null,
    }
  } catch {
    return {
      artifactPaths,
      failureReason: 'UI artifact manifest could not be parsed.',
    }
  }
}

function buildLayerSummary(
  name: EvalLayerName,
  commands: CommandExecution[],
  pass: boolean,
  artifactPaths: string[],
  failureReason: string | null,
) {
  if (!pass) {
    const firstFailed = commands.find((command) => !command.pass)
    return `${name} failed${firstFailed ? ` on ${firstFailed.name}` : ''}. ${failureReason ?? 'Review the linked logs or artifacts for the first break.'}`
  }

  switch (name) {
    case 'correctness':
      return `${commands.length}/${commands.length} correctness checks passed. Lint, types, UI-system audit, and build are clean.`
    case 'workflows':
      return `${commands.length}/${commands.length} workflow checks passed. Sourcing/import contract, route smoke, packet review, packet persistence, authenticated server-action workflow, queue-domain mappings, and workflow transitions all behaved as expected.`
    case 'ui':
      return `UI assertions passed. ${artifactPaths.length > 0 ? 'Playwright outputs were copied into the eval bundle.' : 'No UI assertion artifacts were copied.'}`
    case 'ui-artifacts':
      return `${Math.max(artifactPaths.length - 1, 0)} UI screenshots were captured for manual review after the interface settled.`
    default:
      return `${name} completed.`
  }
}

function uniqPaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))]
}

function createEmptyArtifactGenerationChange(): ArtifactGenerationChange {
  return {
    addedPaths: [],
    currentCount: 0,
    delta: 0,
    previousCount: 0,
    removedPaths: [],
  }
}

function createEmptyRegression(): RegressionResult {
  return {
    artifactGenerationChanges: {
      ui: createEmptyArtifactGenerationChange(),
      'ui-artifacts': createEmptyArtifactGenerationChange(),
    },
    available: false,
    comparedToPath: null,
    comparedToTimestamp: null,
    layerScoreChanges: Object.fromEntries(
      layerOrder.map((layerName) => [
        layerName,
        {
          currentPass: false,
          currentScore: 0,
          delta: 0,
          previousPass: false,
          previousScore: 0,
        } satisfies LayerRegressionResult,
      ]),
    ) as Record<EvalLayerName, LayerRegressionResult>,
    newlyFailingLayers: [],
    repeatedWeakSpots: [],
    resolvedFailures: [],
    summary: 'No previous full eval run is available for comparison yet.',
  }
}

async function archiveLatestRun() {
  const previousReportPath = path.join(evalRoot, 'report.json')
  if (!(await exists(previousReportPath))) {
    return {
      archivedReportPath: null,
      previousReport: null,
    }
  }

  const previousReport = await readJsonFile<EvalReport>(previousReportPath)
  const archiveDir = await uniquePath(
    path.join(evalRunsRoot, sanitizeTimestampForPath(previousReport.timestamp)),
  )

  await mkdirp(evalRunsRoot)
  await fsp.rm(archiveDir, { force: true, recursive: true })
  await fsp.cp(evalRoot, archiveDir, { recursive: true })

  return {
    archivedReportPath: path.join(archiveDir, 'report.json'),
    previousReport,
  }
}

function countRelevantArtifacts(layer: LayerResult) {
  return layer.artifactPaths.length
}

function buildArtifactGenerationChange(currentLayer: LayerResult, previousLayer?: LayerResult): ArtifactGenerationChange {
  const currentPaths = currentLayer.artifactPaths
  const previousPaths = previousLayer?.artifactPaths ?? []

  return {
    addedPaths: currentPaths.filter((artifactPath) => !previousPaths.includes(artifactPath)),
    currentCount: countRelevantArtifacts(currentLayer),
    delta: countRelevantArtifacts(currentLayer) - countRelevantArtifacts(previousLayer ?? buildEmptyLayerResult()),
    previousCount: countRelevantArtifacts(previousLayer ?? buildEmptyLayerResult()),
    removedPaths: previousPaths.filter((artifactPath) => !currentPaths.includes(artifactPath)),
  }
}

function buildRegression(
  currentReport: Omit<EvalReport, 'regression'>,
  previousReport: EvalReport | null,
  archivedReportPath: string | null,
): RegressionResult {
  if (!previousReport || !archivedReportPath) {
    return createEmptyRegression()
  }

  const layerScoreChanges = Object.fromEntries(
    layerOrder.map((layerName) => {
      const currentLayer = currentReport.layers[layerName]
      const previousLayer = previousReport.layers[layerName]

      return [
        layerName,
        {
          currentPass: currentLayer.pass,
          currentScore: currentLayer.scoreContribution,
          delta: currentLayer.scoreContribution - previousLayer.scoreContribution,
          previousPass: previousLayer.pass,
          previousScore: previousLayer.scoreContribution,
        } satisfies LayerRegressionResult,
      ]
    }),
  ) as Record<EvalLayerName, LayerRegressionResult>

  const newlyFailingLayers = layerOrder.filter(
    (layerName) => previousReport.layers[layerName].pass && !currentReport.layers[layerName].pass,
  )

  const resolvedFailures = [
    ...layerOrder
      .filter((layerName) => !previousReport.layers[layerName].pass && currentReport.layers[layerName].pass)
      .map((layerName) => `layer:${layerName}`),
    ...previousReport.preflight.checks
      .filter((check) => !check.pass)
      .filter((check) => currentReport.preflight.checks.find((currentCheck) => currentCheck.name === check.name)?.pass)
      .map((check) => `preflight:${check.name}`),
  ]

  const repeatedWeakSpots = [
    ...layerOrder
      .filter((layerName) => !previousReport.layers[layerName].pass && !currentReport.layers[layerName].pass)
      .map((layerName) => `layer:${layerName}`),
    ...currentReport.preflight.checks
      .filter((check) => !check.pass)
      .filter((check) => previousReport.preflight.checks.find((previousCheck) => previousCheck.name === check.name && !previousCheck.pass))
      .map((check) => `preflight:${check.name}`),
  ]

  const artifactGenerationChanges = {
    ui: buildArtifactGenerationChange(currentReport.layers.ui, previousReport.layers.ui),
    'ui-artifacts': buildArtifactGenerationChange(
      currentReport.layers['ui-artifacts'],
      previousReport.layers['ui-artifacts'],
    ),
  }

  const regressionNotes: string[] = []

  if (newlyFailingLayers.length > 0) {
    regressionNotes.push(`New failing layers: ${newlyFailingLayers.join(', ')}.`)
  }

  if (resolvedFailures.length > 0) {
    regressionNotes.push(`Resolved failures: ${resolvedFailures.join(', ')}.`)
  }

  const artifactDeltaNotes = (Object.entries(artifactGenerationChanges) as Array<
    ['ui' | 'ui-artifacts', ArtifactGenerationChange]
  >)
    .filter(([, change]) => change.delta !== 0 || change.addedPaths.length > 0 || change.removedPaths.length > 0)
    .map(([layerName, change]) => {
      const parts = [`${layerName} artifacts ${change.delta >= 0 ? '+' : ''}${change.delta}`]
      if (change.addedPaths.length > 0) {
        parts.push(`${change.addedPaths.length} added`)
      }
      if (change.removedPaths.length > 0) {
        parts.push(`${change.removedPaths.length} removed`)
      }
      return parts.join(', ')
    })

  if (artifactDeltaNotes.length > 0) {
    regressionNotes.push(`Artifact changes: ${artifactDeltaNotes.join('; ')}.`)
  }

  if (repeatedWeakSpots.length > 0) {
    regressionNotes.push(`Repeated weak spots: ${repeatedWeakSpots.join(', ')}.`)
  }

  return {
    artifactGenerationChanges,
    available: true,
    comparedToPath: toReportRelative(archivedReportPath),
    comparedToTimestamp: previousReport.timestamp,
    layerScoreChanges,
    newlyFailingLayers,
    repeatedWeakSpots,
    resolvedFailures,
    summary:
      regressionNotes.join(' ') ||
      'No material regression changes were detected versus the previous full eval run.',
  }
}

function buildLayerFailureHint(
  name: EvalLayerName,
  commands: CommandExecution[],
  failureReason: string | null,
) {
  const failedCommand = commands.find((command) => !command.pass)

  if (!failedCommand) {
    if (failureReason?.includes('managed app server')) {
      return 'The harness could not boot a production app server. This usually points to a startup, environment, or build/runtime mismatch rather than a UI assertion issue.'
    }

    if (name === 'ui-artifacts' && failureReason) {
      return 'The capture run completed, but the eval bundle is incomplete. This usually means the manifest or one of its referenced screenshots was not written where the harness expected it.'
    }

    if (name === 'ui' && failureReason) {
      return 'UI assertions ran, but the expected Playwright outputs were not copied into the eval bundle.'
    }

    return null
  }

  switch (failedCommand.name) {
    case 'lint':
      return 'Likely root cause: static code issues or an ESLint/config load problem.'
    case 'typecheck':
      return 'Likely root cause: a TypeScript type error, module-resolution problem, or tsconfig mismatch.'
    case 'check:ui-system':
      return 'Likely root cause: the UI-system guardrails detected a styling ownership or contract drift.'
    case 'build':
      return 'Likely root cause: a production-only Next.js/build failure, often caused by server/runtime assumptions or invalid imports.'
    case 'smoke:routes':
      return 'Likely root cause: the managed app server served an unexpected response for at least one required route.'
    case 'smoke:packet':
      return 'Likely root cause: the packet flow did not redirect or render the expected review surface.'
    case 'test:ui-contracts':
      return 'Likely root cause: a UI contract regression changed a protected geometry, seam, or interaction state.'
    case 'capture:ui':
      return 'Likely root cause: the screenshot capture flow failed before the manifest or a required image was produced.'
    default:
      return failureReason
        ? `Likely root cause: ${failureReason}`
        : 'Likely root cause: review the failing command log first.'
  }
}

function buildLayerNextLookPaths(
  name: EvalLayerName,
  commands: CommandExecution[],
  artifactPaths: string[],
) {
  const failedCommand = commands.find((command) => !command.pass)

  if (failedCommand) {
    switch (failedCommand.name) {
      case 'test:ui-contracts':
        return uniqPaths([
          artifactPaths.includes('./playwright-report/index.html') ? './playwright-report/index.html' : null,
          artifactPaths.includes('./test-results') ? './test-results' : null,
          failedCommand.logPath,
        ])
      case 'capture:ui':
        return uniqPaths([
          artifactPaths.includes('./ui/manifest.json') ? './ui/manifest.json' : null,
          failedCommand.logPath,
          artifactPaths.find((path) => path.startsWith('./ui/routes/')),
        ])
      default:
        return uniqPaths([failedCommand.logPath, ...artifactPaths])
    }
  }

  if (name === 'ui') {
    return uniqPaths([
      artifactPaths.includes('./playwright-report/index.html') ? './playwright-report/index.html' : null,
      artifactPaths.includes('./test-results') ? './test-results' : null,
    ])
  }

  if (name === 'ui-artifacts') {
    return uniqPaths([
      artifactPaths.includes('./ui/manifest.json') ? './ui/manifest.json' : null,
      artifactPaths.find((path) => path.startsWith('./ui/routes/')),
      artifactPaths.find((path) => path.startsWith('./ui/contracts/')),
    ])
  }

  return uniqPaths(artifactPaths)
}

async function runLayer(name: EvalLayerName, serverHandle?: DevServerHandle) {
  const spec = layerSpecs[name]
  const layerStartedAt = Date.now()
  const layerEnv: NodeJS.ProcessEnv = {}

  if (spec.needsServer) {
    if (!serverHandle) {
      throw new Error(`Layer ${name} requires a managed dev server.`)
    }

    layerEnv.SMOKE_BASE_URL = serverHandle.baseUrl
    layerEnv.PLAYWRIGHT_BASE_URL = serverHandle.baseUrl
    layerEnv.PLAYWRIGHT_SKIP_WEBSERVER = '1'
    layerEnv.SMOKE_JOB_ID = getSmokeJobId()

    if (name === 'ui-artifacts') {
      layerEnv.UI_ARTIFACTS_ROOT = uiArtifactRootRelative
    }
  }

  const commands: CommandExecution[] = []
  for (const command of spec.commands) {
    commands.push(await runCommand(name, command, layerEnv))
  }

  let artifactPaths: string[] = []
  let failureReason: string | null = null
  if (!noReport) {
    if (name === 'ui') {
      const artifacts = await collectUiLayerArtifacts()
      artifactPaths = artifacts.artifactPaths
      failureReason = artifacts.failureReason
    }

    if (name === 'ui-artifacts') {
      const artifacts = await collectUiArtifactLayerArtifacts()
      artifactPaths = artifacts.artifactPaths
      failureReason = artifacts.failureReason
    }
  }

  const failedCommand = commands.find((command) => !command.pass)
  if (!failureReason && failedCommand) {
    failureReason = `Command failed: ${failedCommand.command}.`
  }

  if (!noReport && failedCommand?.logPath) {
    artifactPaths = [...new Set([...artifactPaths, failedCommand.logPath])]
  }

  const pass =
    commands.every((command) => command.pass) &&
    !(name === 'ui-artifacts' && Boolean(failureReason))

  const failureHint = buildLayerFailureHint(name, commands, failureReason)
  const nextLookPaths = buildLayerNextLookPaths(name, commands, artifactPaths)

  return {
    artifactPaths,
    commands: commands.map(
      ({
        command,
        durationMs,
        failureReason: commandFailureReason,
        logPath,
        name: commandName,
        pass: commandPass,
      }) => ({
        command,
        durationMs,
        failureReason: commandFailureReason,
        logPath,
        name: commandName,
        pass: commandPass,
      }),
    ),
    durationMs: Date.now() - layerStartedAt,
    failureHint,
    failureReason,
    nextLookPaths,
    pass,
    scoreContribution: pass ? spec.score : 0,
    summary: buildLayerSummary(name, commands, pass, artifactPaths, failureReason),
  } satisfies LayerResult
}

function buildEmptyLayerResult() {
  return {
    artifactPaths: [],
    commands: [],
    durationMs: 0,
    failureHint: null,
    failureReason: null,
    nextLookPaths: [],
    pass: true,
    scoreContribution: 0,
    summary: 'Layer was not executed in this run.',
  } satisfies LayerResult
}

function createReport(
  preflight: PreflightResult,
  layers: Record<EvalLayerName, LayerResult>,
  regression: RegressionResult,
): EvalReport {
  const totalScore = layerOrder.reduce((sum, layerName) => sum + layers[layerName].scoreContribution, 0)
  const status =
    preflight.pass && requiredLayers.every((layerName) => layers[layerName].pass) ? 'pass' : 'fail'

  return {
    baseUrl,
    coverageCaveats: buildCoverageCaveats(),
    layers,
    maxScore: 100,
    preflight,
    regression,
    status,
    timestamp: new Date().toISOString(),
    totalScore,
  }
}

function buildCoverageCaveats(): CoverageCaveat[] {
  return [
    {
      id: 'ai-generation-quality',
      summary: 'No AI generation quality validation is included yet for packet outputs or generated copy.',
    },
    {
      id: 'server-action-e2e-context',
      summary: 'Workflow smokes do not provide full request/cookie-context end-to-end coverage for all server actions.',
    },
    {
      id: 'live-external-sourcing',
      summary: 'No live external sourcing or import validation runs against third-party job feeds in the harness.',
    },
    {
      id: 'ui-artifacts-review',
      summary: 'UI artifacts confirm review evidence was generated, not that the UI has been visually approved.',
    },
  ]
}

async function writeReport(report: EvalReport) {
  await mkdirp(evalRoot)

  await fsp.writeFile(
    path.join(evalRoot, 'report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  )

  const failingLayers = layerOrder.filter((layerName) => !report.layers[layerName].pass)
  const lines = [
    '# Repo Quality Harness Report',
    '',
    `- Generated: ${report.timestamp}`,
    `- Base URL: ${report.baseUrl}`,
    `- Status: ${report.status.toUpperCase()}`,
    `- Score: ${report.totalScore}/${report.maxScore}`,
    '',
  ]

  lines.push('## Preflight', '', `- Result: ${report.preflight.pass ? 'pass' : 'fail'}`, `- Duration: ${report.preflight.durationMs}ms`, `- Summary: ${report.preflight.summary}`, '')

  for (const check of report.preflight.checks) {
    lines.push(`- ${check.name}: ${check.pass ? 'pass' : 'fail'}`)
    lines.push(`  - Summary: ${check.summary}`)
    if (check.failureReason) {
      lines.push(`  - Why it failed: ${check.failureReason}`)
    }
    if (check.relatedPaths.length > 0) {
      lines.push('  - Related paths:')
      for (const relatedPath of check.relatedPaths) {
        lines.push(`    - [${relatedPath}](${relatedPath})`)
      }
    }
  }
  lines.push('')

  lines.push('## Regression vs Previous Run', '')
  lines.push(`- Summary: ${report.regression.summary}`)

  if (report.regression.available) {
    if (report.regression.comparedToTimestamp) {
      lines.push(`- Previous run: ${report.regression.comparedToTimestamp}`)
    }
    if (report.regression.comparedToPath) {
      lines.push(`- Previous report: [${report.regression.comparedToPath}](${report.regression.comparedToPath})`)
    }

    lines.push('', '| Layer | Previous Score | Current Score | Delta | Previous Result | Current Result |', '| --- | ---: | ---: | ---: | --- | --- |')

    for (const layerName of layerOrder) {
      const change = report.regression.layerScoreChanges[layerName]
      lines.push(
        `| ${layerName} | ${change.previousScore} | ${change.currentScore} | ${change.delta >= 0 ? '+' : ''}${change.delta} | ${change.previousPass ? 'pass' : 'fail'} | ${change.currentPass ? 'pass' : 'fail'} |`,
      )
    }

    lines.push('', `- Newly failing layers: ${report.regression.newlyFailingLayers.length > 0 ? report.regression.newlyFailingLayers.join(', ') : 'none'}`)
    lines.push(`- Resolved failures: ${report.regression.resolvedFailures.length > 0 ? report.regression.resolvedFailures.join(', ') : 'none'}`)
    lines.push(`- Repeated weak spots: ${report.regression.repeatedWeakSpots.length > 0 ? report.regression.repeatedWeakSpots.join(', ') : 'none'}`)
    lines.push('')
    lines.push('### Artifact Generation Changes', '')

    for (const layerName of ['ui', 'ui-artifacts'] as const) {
      const change = report.regression.artifactGenerationChanges[layerName]
      lines.push(`- ${layerName}: previous ${change.previousCount}, current ${change.currentCount}, delta ${change.delta >= 0 ? '+' : ''}${change.delta}`)
      if (change.addedPaths.length > 0) {
        lines.push('  - Added:')
        for (const addedPath of change.addedPaths) {
          lines.push(`    - [${addedPath}](${addedPath})`)
        }
      }
      if (change.removedPaths.length > 0) {
        lines.push('  - Removed:')
        for (const removedPath of change.removedPaths) {
          lines.push(`    - ${removedPath}`)
        }
      }
    }
  }

  lines.push('')

  lines.push('## Coverage Caveats', '')
  for (const caveat of report.coverageCaveats) {
    lines.push(`- ${caveat.summary}`)
  }
  lines.push('')

  if (failingLayers.length > 0) {
    lines.push('## Failing Layers', '')
    for (const layerName of failingLayers) {
      const layer = report.layers[layerName]
      lines.push(`- ${layerName}: ${layer.failureReason ?? layer.summary}`)
      if (layer.failureHint) {
        lines.push(`  - Likely root cause: ${layer.failureHint}`)
      }
      if (layer.nextLookPaths.length > 0) {
        lines.push(`  - Start here: ${layer.nextLookPaths.join(', ')}`)
      }
    }
    lines.push('')
  }

  lines.push(
    '| Layer | Result | Duration | Score | Summary |',
    '| --- | --- | ---: | ---: | --- |',
  )

  for (const layerName of layerOrder) {
    const layer = report.layers[layerName]
    lines.push(
      `| ${layerName} | ${layer.pass ? 'pass' : 'fail'} | ${layer.durationMs}ms | ${layer.scoreContribution} | ${layer.summary.replaceAll('|', '\\|')} |`,
    )
  }

  for (const layerName of layerOrder) {
    const layer = report.layers[layerName]
    lines.push('', `## ${layerName}`, '', `- Summary: ${layer.summary}`)

    if (layer.failureReason) {
      lines.push(`- Why it failed: ${layer.failureReason}`)
    }

    if (layer.failureHint) {
      lines.push(`- Likely root cause: ${layer.failureHint}`)
    }

    if (layer.nextLookPaths.length > 0) {
      lines.push('- Start here:')
      for (const nextPath of layer.nextLookPaths) {
        lines.push(`  - [${nextPath}](${nextPath})`)
      }
    }

    if (layer.commands.length === 0) {
      lines.push('- No commands executed.')
    }

    for (const command of layer.commands) {
      lines.push(
        `- ${command.name}: ${command.pass ? 'pass' : 'fail'} (${command.durationMs}ms)`,
      )

      if (command.failureReason) {
        lines.push(`  - Failure detail: ${command.failureReason}`)
      }

      if (command.logPath) {
        lines.push(`  - Log: [${command.logPath}](${command.logPath})`)
      }
    }

    if (layer.artifactPaths.length > 0) {
      lines.push('- Related artifacts:')
      for (const artifactPath of layer.artifactPaths) {
        lines.push(`  - [${artifactPath}](${artifactPath})`)
      }
    }
  }

  lines.push('')
  await fsp.writeFile(path.join(evalRoot, 'report.md'), `${lines.join('\n')}\n`, 'utf8')
}

const targetLayers = requestedLayer ? [requestedLayer] : layerOrder

let previousReport: EvalReport | null = null
let archivedPreviousReportPath: string | null = null
if (!requestedLayer && !noReport) {
  const archivedRun = await archiveLatestRun()
  previousReport = archivedRun.previousReport
  archivedPreviousReportPath = archivedRun.archivedReportPath
  await fsp.rm(evalRoot, { force: true, recursive: true })
}

const layerResults = Object.fromEntries(
  layerOrder.map((layerName) => [layerName, buildEmptyLayerResult()]),
) as Record<EvalLayerName, LayerResult>
const preflightResult = await runPreflight(targetLayers)

let serverHandle: DevServerHandle | undefined
let serverStartupError: Error | null = null

if (preflightResult.pass) {
  try {
    for (const layerName of targetLayers) {
      if (layerSpecs[layerName].needsServer && !serverHandle && !serverStartupError) {
        try {
          serverHandle = await startManagedAppServer()
          baseUrl = serverHandle.baseUrl
        } catch (error) {
          serverStartupError =
            error instanceof Error ? error : new Error('Unknown app server startup error.')
        }
      }

      if (layerSpecs[layerName].needsServer && serverStartupError) {
        const serverLogPath = toReportRelative(path.join(logsRoot, 'app-server.log'))
        layerResults[layerName] = {
          artifactPaths:
            serverHandle?.logPath ? [serverHandle.logPath] : (await exists(path.join(logsRoot, 'app-server.log')) ? [serverLogPath] : []),
          commands: [],
          durationMs: 0,
          failureHint: 'Likely root cause: the production app server could not start. This usually points to startup, environment, or build/runtime issues before the layer itself even ran.',
          failureReason: serverStartupError.message,
          nextLookPaths:
            serverHandle?.logPath ? [serverHandle.logPath] : (await exists(path.join(logsRoot, 'app-server.log')) ? [serverLogPath] : []),
          pass: false,
          scoreContribution: 0,
          summary: `${layerName} could not start because the managed app server failed.`,
        }
        continue
      }

      layerResults[layerName] = await runLayer(layerName, serverHandle)
    }
  } finally {
    await serverHandle?.stop()
  }
}

const baseReport = createReport(preflightResult, layerResults, createEmptyRegression())
const regression = !requestedLayer && !noReport
  ? buildRegression(baseReport, previousReport, archivedPreviousReportPath)
  : createEmptyRegression()
const report = createReport(preflightResult, layerResults, regression)

if (!noReport) {
  await writeReport(report)
}

const failingRequiredLayers = requiredLayers.filter(
  (layerName) => targetLayers.includes(layerName) && !layerResults[layerName].pass,
)
const optionalUiArtifactFailure =
  targetLayers.includes('ui-artifacts') && !layerResults['ui-artifacts'].pass

if (!preflightResult.pass) {
  process.exit(1)
}

if (requestedLayer) {
  if (
    (requiredLayers.includes(requestedLayer) && failingRequiredLayers.includes(requestedLayer)) ||
    (requestedLayer === 'ui-artifacts' && optionalUiArtifactFailure)
  ) {
    process.exit(1)
  }

  process.exit(0)
}

if (failingRequiredLayers.length > 0) {
  process.exit(1)
}

process.exit(0)
