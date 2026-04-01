import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getSupabasePublicEnv } from '@/lib/env'

export function createClient() {
  const { publishableKey, url } = getSupabasePublicEnv()

  return createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
