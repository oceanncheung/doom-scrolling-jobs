import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from '@/lib/env'

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv()

  return createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
