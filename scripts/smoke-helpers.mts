import fs from 'node:fs'
import path from 'node:path'

import { defaultOperator } from '@/lib/config/runtime'
import { activeOperatorCookieName, listOperators } from '@/lib/data/operators'
import { hasSupabaseServerEnv } from '@/lib/env'

export const defaultSmokeBaseUrl = 'http://127.0.0.1:3001'
export const defaultSmokeJobId = 'ec47ed58-6782-46e4-8ce7-4b3241ef345c'
export const defaultSeededSmokeJobId = '66666666-6666-4666-8666-666666666666'

function loadEnvFile(filename: string) {
  const filepath = path.join(process.cwd(), filename)

  if (!fs.existsSync(filepath)) {
    return
  }

  for (const line of fs.readFileSync(filepath, 'utf8').split(/\n+/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

export function getSmokeBaseUrl() {
  return (process.env.SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || defaultSmokeBaseUrl).replace(/\/$/, '')
}

export function getSmokeJobId(input?: string) {
  return (
    input ||
    process.env.SMOKE_JOB_ID ||
    (hasSupabaseServerEnv() ? defaultSmokeJobId : defaultSeededSmokeJobId)
  )
}

async function resolveSmokeOperatorValue() {
  const override = process.env.SMOKE_OPERATOR_ID?.trim()

  if (override) {
    return override
  }

  if (!hasSupabaseServerEnv()) {
    return defaultOperator.userId
  }

  const operators = await listOperators()
  const firstOperator = operators[0]

  if (!firstOperator) {
    throw new Error('No operators are available for smoke authentication.')
  }

  return firstOperator.id
}

export async function getSmokeOperatorId() {
  return resolveSmokeOperatorValue()
}

export async function getSmokeCookieHeader() {
  const operatorValue = await getSmokeOperatorId()
  return `${activeOperatorCookieName}=${operatorValue}`
}

export async function getSmokeHeaders(extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders)
  const cookie = await getSmokeCookieHeader()

  if (cookie && !headers.has('cookie')) {
    headers.set('cookie', cookie)
  }

  return headers
}

export async function fetchSmoke(pathname: string, init?: RequestInit) {
  const headers = await getSmokeHeaders(init?.headers)

  return fetch(`${getSmokeBaseUrl()}${pathname}`, {
    ...init,
    headers,
  })
}
