import axios from 'axios'
import { supabase } from './supabase'

// Relative baseURL by default so requests go to the same origin and ride the Vite
// dev proxy (see vite.config.ts) — this is what lets a single tunnel serve both the
// app and its /api calls. Set VITE_API_URL to override (e.g. a separate API host).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  
  return config
})
