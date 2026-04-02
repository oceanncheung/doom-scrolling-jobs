const publicEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const

type PublicEnvKey = (typeof publicEnvKeys)[number]

function getRequiredEnv(key: PublicEnvKey | 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY') {
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
  return hasSupabasePublicEnv() && Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabasePublicEnv() {
  return {
    publishableKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  }
}

export function getSupabaseServerEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SECRET_KEY || getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  }
}
