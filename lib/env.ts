const publicEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

const serverEnvKeys = [...publicEnvKeys, 'SUPABASE_SERVICE_ROLE_KEY'] as const

type PublicEnvKey = (typeof publicEnvKeys)[number]
type ServerEnvKey = (typeof serverEnvKeys)[number]

function getRequiredEnv(key: PublicEnvKey | ServerEnvKey) {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function hasSupabasePublicEnv() {
  return publicEnvKeys.every((key) => Boolean(process.env[key]))
}

export function hasSupabaseServerEnv() {
  return serverEnvKeys.every((key) => Boolean(process.env[key]))
}

export function getSupabasePublicEnv() {
  return {
    publishableKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  }
}

export function getSupabaseServerEnv() {
  return {
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  }
}
