import { supabase } from '../supabase'

export function getFunctionsUrl() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const ref = new URL(url).host.split('.')[0];
  return `https://${ref}.functions.supabase.co`;
}

export type DiscoverFilters = {
  genres?: number[]
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  language?: string
  sortBy?: string
}

export async function discoverMovies(params: { page: number; filters?: DiscoverFilters }) {
  const { page, filters } = params
  const { data, error } = await supabase.functions.invoke('discover', {
    body: { page, filters },
  })
  if (error) throw error
  return data as { page: number; results: any[] }
}

export type MovieDetails = {
  overview: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  backdrop_url: string | null;
  trailer: { site: string; key: string; name: string } | null;
  vote_average: number | null;
  vote_count: number | null;
  age_rating: string | null; // << novo
};

export async function getMovieDetails(tmdb_id: number) {
  const res = await fetch(`${getFunctionsUrl()}/movie_details`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ tmdb_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<MovieDetails>;
}
