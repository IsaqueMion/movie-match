// Edge Function: discover (CORS liberado para testes: '*' )

type Body = {
  page?: number
  filters?: {
    genres?: number[]
    yearMin?: number
    yearMax?: number
    ratingMin?: number
    language?: string
    sortBy?: string
  }
}

const TMDB = "https://api.themoviedb.org/3";
const IMG  = "https://image.tmdb.org/t/p/w500";

// CORS simples e universal (teste)
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  // PRE-FLIGHT
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // corpo (POST) ou fallback simples (GET)
    let payload: Body = { page: 1, filters: {} };
    if (req.method === "POST") {
      payload = (await req.json()) as Body;
    } else {
      const u = new URL(req.url);
      payload.page = Number(u.searchParams.get("page") ?? "1") || 1;
    }

    const { page = 1, filters = {} } = payload;

    // chave TMDB via secrets
    const apiKey = Deno.env.get("TMDB_KEY") || Deno.env.get("TMDB_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TMDB_KEY ausente nas secrets" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // monta query
    const p = new URLSearchParams();
    p.set("api_key", apiKey);
    p.set("page", String(page));
    p.set("include_adult", "false");
    p.set("include_video", "false");
    p.set("language", "pt-BR");
    p.set("sort_by", filters.sortBy || "popularity.desc");

    if (filters.genres?.length) p.set("with_genres", filters.genres.join(","));
    if (filters.yearMin)        p.set("primary_release_date.gte", `${filters.yearMin}-01-01`);
    if (filters.yearMax)        p.set("primary_release_date.lte", `${filters.yearMax}-12-31`);
    if (typeof filters.ratingMin === "number") {
      p.set("vote_average.gte", String(filters.ratingMin));
      p.set("vote_count.gte", "50");
    }
    if (filters.language && /^[a-z]{2}$/i.test(filters.language)) {
      p.set("with_original_language", filters.language.toLowerCase());
    }

    const url = `${TMDB}/discover/movie?${p.toString()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TMDB error ${r.status}: ${await r.text()}`);

    const data = await r.json();

    const results = (data.results ?? []).map((m: any) => ({
      movie_id: m.id,
      tmdb_id:  m.id,
      title:    m.title ?? m.name ?? "Sem título",
      year:     m.release_date ? Number(String(m.release_date).slice(0, 4)) : null,
      poster_url: m.poster_path ? `${IMG}${m.poster_path}` : null,
      genres:   Array.isArray(m.genre_ids) ? m.genre_ids : [],
    }));

    return new Response(JSON.stringify({ page, results }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        ...corsHeaders(),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
});
