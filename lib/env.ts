const requiredEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

type RequiredEnvKey = (typeof requiredEnvKeys)[number]

function getRequiredEnv(key: RequiredEnvKey) {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function hasSupabaseEnv() {
  return requiredEnvKeys.every((key) => Boolean(process.env[key]))
}

export function getSupabaseEnv() {
  return {
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  }
}
