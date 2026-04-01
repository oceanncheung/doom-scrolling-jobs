import { createBrowserClient } from '@supabase/ssr'

import { getSupabaseEnv } from '@/lib/env'

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv()

  return createBrowserClient(url, publishableKey)
}
