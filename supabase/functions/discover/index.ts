// Edge Function: discover
// - CORS: libera localhost:5173 e *.vercel.app (previews/prod da Vercel)
// - Filtros: genres[], yearMin, yearMax, ratingMin (0..10), language ("pt","en"...), sortBy
// - Retorno: { page, results[] } com poster_url pronto

type Body = {
  page?: number
  filters?: {
    genres?: number[]
    yearMin?: number
    yearMax?: number
    ratingMin?: number   // 0..10
    language?: string    // "pt", "en", ...
    sortBy?: string      // ex: "popularity.desc" (padrão)
  }
}

const TMDB = "https://api.themoviedb.org/3";
const IMG  = "https://image.tmdb.org/t/p/w500";

// ---------- CORS ----------
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "http://localhost:5173") return true;
  try {
    const u = new URL(origin);
    // libera qualquer domínio *.vercel.app (production + preview)
    return u.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/**
 * Para testes: se a origem não estiver na allowlist,
 * usamos '*' para não quebrar o preflight.
 * (Depois você pode trocar '*' por um domínio fixo.)
 */
function corsHeaders(origin: string | null) {
  const allow = isAllowedOrigin(origin) ? (origin as string) : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
// -------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    // Aceita POST (padrão). Se vier GET, tenta ler query (fallback simples).
    let payload: Body;
    if (req.method === "POST") {
      payload = (await req.json()) as Body;
    } else {
      const u = new URL(req.url);
      payload = {
        page: Number(u.searchParams.get("page") ?? "1") || 1,
        filters: {},
      };
    }

    const { page = 1, filters = {} } = payload;

    // Chave TMDB nas secrets: TMDB_KEY (ou TMDB_API_KEY)
    const apiKey = Deno.env.get("TMDB_KEY") || Deno.env.get("TMDB_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TMDB_KEY ausente nas secrets" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
      );
    }

    // Monta query TMDB
    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("page", String(page));
    params.set("include_adult", "false");
    params.set("include_video", "false");
    // Idioma de retorno dos textos (títulos/overview) — ajuste se quiser
    params.set("language", "pt-BR");

    // Ordenação (padrão: popularidade)
    params.set("sort_by", filters.sortBy || "popularity.desc");

    // Filtros opcionais
    if (filters.genres && filters.genres.length > 0) {
      params.set("with_genres", filters.genres.join(","));
    }
    if (filters.yearMin) {
      params.set("primary_release_date.gte", `${filters.yearMin}-01-01`);
    }
    if (filters.yearMax) {
      params.set("primary_release_date.lte", `${filters.yearMax}-12-31`);
    }
    if (typeof filters.ratingMin === "number") {
      params.set("vote_average.gte", String(filters.ratingMin));
      // evita muitos títulos obscuros sem votos
      params.set("vote_count.gte", "50");
    }
    if (filters.language && /^[a-z]{2}$/i.test(filters.language)) {
      params.set("with_original_language", filters.language.toLowerCase());
    }

    const url = `${TMDB}/discover/movie?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`TMDB error ${r.status}: ${text}`);
    }
    const data = await r.json();

    // Mapeia resultado (usa tmdb_id também como movie_id "estável" do catálogo)
    const results = (data.results ?? []).map((m: any) => {
      const tmdb_id   = m.id;
      const title     = m.title ?? m.name ?? "Sem título";
      const year      = m.release_date ? Number(String(m.release_date).slice(0, 4)) : null;
      const posterUrl = m.poster_path ? `${IMG}${m.poster_path}` : null;
      const genresArr = Array.isArray(m.genre_ids) ? m.genre_ids : [];
      return {
        movie_id: tmdb_id,
        tmdb_id,
        title,
        year,
        poster_url: posterUrl,
        genres: genresArr,
      };
    });

    return new Response(
      JSON.stringify({ page, results }),
      {
        headers: {
          "Content-Type": "application/json",
          // cache leve no edge (opcional)
          "Cache-Control": "public, max-age=60, s-maxage=300",
          ...corsHeaders(origin),
        },
      }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } }
    );
  }
});
