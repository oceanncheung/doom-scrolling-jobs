import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getSupabaseServerEnv } from '@/lib/env'

export function createClient() {
  const { serviceRoleKey, url } = getSupabaseServerEnv()

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
