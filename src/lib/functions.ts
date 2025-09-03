// src/lib/functions.ts
import { supabase } from '../supabase'

export type DiscoverFilters = {
  genres?: number[]
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  language?: string // 'pt', 'en', '' (qualquer)
  sortBy?: string   // ex: 'popularity.desc'
}

export type DiscoverResponse = {
  page: number
  results: Array<{
    movie_id: number
    tmdb_id: number
    title: string
    year: number | null
    poster_url: string | null
    genres: number[]
  }>
}

export type MovieDetails = {
  id: number
  title: string
  overview?: string
  runtime?: number
  vote_average?: number
  genres?: { id: number; name: string }[]
  trailer?: { site: 'YouTube' | string; key: string } | null
  age_rating?: string
}

const VITE_URL  = import.meta.env.VITE_SUPABASE_URL as string
const VITE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function invokeOrFetch<T>(fn: 'discover' | 'movie_details', body: any): Promise<T> {
  // 1) tenta pelo client oficial
  try {
    const { data, error } = await supabase.functions.invoke<T>(fn, { body })
    if (error) throw error
    if (!data) throw new Error('Resposta vazia')
    return data
  } catch (e) {
    // 2) fallback: fetch direto (ajuda em produção se algo do client bloquear)
    const url = `${VITE_URL}/functions/v1/${fn}`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // autorização é obrigatória nas Edge Functions do Supabase
        'Authorization': `Bearer ${VITE_ANON}`,
        'apikey': VITE_ANON,
      },
      body: JSON.stringify(body ?? {}),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new Error(`Edge ${fn} ${r.status}: ${text}`)
    }
    return (await r.json()) as T
  }
}

export async function discoverMovies(args: { page?: number; filters?: DiscoverFilters }): Promise<DiscoverResponse> {
  const page = args.page ?? 1
  const filters = args.filters ?? {}
  return invokeOrFetch<DiscoverResponse>('discover', { page, filters })
}

export async function getMovieDetails(tmdbId: number): Promise<MovieDetails> {
  return invokeOrFetch<MovieDetails>('movie_details', { tmdb_id: tmdbId })
}
