import { createDemoApi } from './demoApi'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const configured = !!url && !!key && !url.includes('xxxxxxxx')

/** Supabase bila .env sudah diisi, selain itu mode demo (localStorage) */
export const api: Api = configured ? createSupabaseApi(url!, key!) : createDemoApi()
