// src/lib/functions.ts
export type DiscoverFilters = {
  genres?: number[]
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  language?: string
  sortBy?: string
}

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function discoverMovies(params: { page?: number; filters?: DiscoverFilters }) {
  const r = await fetch(`${EDGE_BASE}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: params.page ?? 1,
      filters: params.filters ?? {},
    }),
    mode: 'cors',
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Edge Function returned ${r.status}: ${txt}`);
  }

  const data = await r.json();
  // filtra itens sem pôster
  data.results = (data.results ?? []).filter((m: any) => !!m?.poster_url);
  return data as {
    page: number,
    results: Array<{
      movie_id: number
      tmdb_id: number
      title: string
      year: number | null
      poster_url: string | null
      genres: number[]
    }>
  };
}

export type MovieDetails = {
  vote_average?: number
  runtime?: number
  overview?: string
  age_rating?: string
  genres?: { id: number, name: string }[]
  trailer?: { site: string, key: string } | null
};

export async function getMovieDetails(tmdbId: number): Promise<MovieDetails> {
  const url = `${EDGE_BASE}/movie_details?tmdb_id=${tmdbId}`;
  const r = await fetch(url, { method: 'GET', mode: 'cors' });
  if (!r.ok) throw new Error(`movie_details ${r.status}`);
  return r.json();
}
