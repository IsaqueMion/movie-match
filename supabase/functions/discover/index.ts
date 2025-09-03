import './_types.d.ts'

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', // troque pelo seu domínio real
  'https://movie-match-rf6c-woad.vercel.app/',
])

function cors(origin: string) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}
type Body = {
  page?: number
  filters?: {
    genres?: number[]
    yearMin?: number
    yearMax?: number
    ratingMin?: number   // 0..10
    language?: string    // "pt", "en"...
    sortBy?: string      // "popularity.desc" (padrão)
  }
}

const TMDB = "https://api.themoviedb.org/3"
const IMG  = "https://image.tmdb.org/t/p/w500"

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(origin) })
  }
  // opcional: bloquear de vez origens não permitidas
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403, headers: cors(origin) })
  }

  try {
    const { page = 1, filters = {} } = (await req.json()) as Body

    // aceita TMDB_KEY ou TMDB_API_KEY
    const apiKey = Deno.env.get("TMDB_KEY") || Deno.env.get("TMDB_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TMDB_KEY ausente nas secrets" }), {
        status: 500, headers: { "Content-Type": "application/json", ...cors() },
      })
    }

    const params = new URLSearchParams()
    params.set("api_key", apiKey)
    params.set("page", String(page))
    params.set("include_adult", "false")
    params.set("include_video", "false")
    params.set("language", "pt-BR")
    params.set("sort_by", filters.sortBy || "popularity.desc")

    if (filters.genres && filters.genres.length > 0) {
      params.set("with_genres", filters.genres.join(","))
    }
    if (filters.yearMin) {
      params.set("primary_release_date.gte", `${filters.yearMin}-01-01`)
    }
    if (filters.yearMax) {
      params.set("primary_release_date.lte", `${filters.yearMax}-12-31`)
    }
    if (typeof filters.ratingMin === "number") {
      params.set("vote_average.gte", String(filters.ratingMin))
      params.set("vote_count.gte", "50")
    }
    if (filters.language && /^[a-z]{2}$/i.test(filters.language)) {
      params.set("with_original_language", filters.language.toLowerCase())
    }

    const url = `${TMDB}/discover/movie?${params.toString()}`
    const r = await fetch(url)
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`TMDB error ${r.status}: ${text}`)
    }
    const data = await r.json()

    const results = (data.results ?? []).map((m: any) => {
      const tmdb_id   = m.id
      const title     = m.title ?? m.name ?? "Sem título"
      const year      = m.release_date ? Number(String(m.release_date).slice(0, 4)) : null
      const posterUrl = m.poster_path ? `${IMG}${m.poster_path}` : null
      return {
        movie_id: tmdb_id,  // usar TMDB ID como ID estável
        tmdb_id,
        title,
        year,
        poster_url: posterUrl,
        genres: Array.isArray(m.genre_ids) ? m.genre_ids : [],
      }
    })

    return new Response(JSON.stringify({ page, results }), {
      headers: { "Content-Type": "application/json", ...cors() },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400, headers: { "Content-Type": "application/json", ...cors() },
    })
  }
})
