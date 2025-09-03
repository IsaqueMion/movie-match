import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tmdb_id } = await req.json().catch(() => ({}));
    if (!tmdb_id) {
      return new Response(JSON.stringify({ error: "tmdb_id is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const apiKey = Deno.env.get("TMDB_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY not set" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // detalhes + vídeos + classificações
    const params = new URLSearchParams({
      api_key: apiKey,
      language: "pt-BR",
      append_to_response: "videos,release_dates",
      include_video_language: "pt-BR,en-US",
    });

    const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdb_id}?${params.toString()}`);
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: `TMDb ${r.status}: ${txt}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const data = await r.json();

    const overview = data?.overview ?? "";
    const runtime = data?.runtime ?? null;
    const genres = Array.isArray(data?.genres) ? data.genres.map((g: any) => ({ id: g.id, name: g.name })) : [];
    const backdrop_url = data?.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : null;
    const vote_average = typeof data?.vote_average === "number" ? data.vote_average : null;
    const vote_count = typeof data?.vote_count === "number" ? data.vote_count : null;

    // escolher trailer do YouTube
    let trailer: { site: string; key: string; name: string } | null = null;
    const vids = (data?.videos?.results ?? []).filter((v: any) => v.site === "YouTube");
    trailer =
      vids.find((v: any) => v.type === "Trailer" && v.official) ||
      vids.find((v: any) => v.type === "Trailer") ||
      vids.find((v: any) => v.type === "Teaser") ||
      null;

    // classificação indicativa (BR prioritário, senão US)
    let age_rating: string | null = null;
    try {
      const results = data?.release_dates?.results ?? [];
      const pick = (cc: string) => {
        const c = results.find((r: any) => r.iso_3166_1 === cc);
        if (!c) return null;
        const arr = c.release_dates || [];
        // Preferir tipo 3 (theatrical) com certification não-vazio, senão qualquer não-vazio
        const best = arr.find((d: any) => d.type === 3 && d.certification) || arr.find((d: any) => d.certification);
        return best?.certification || null;
      };
      age_rating = pick("BR") || pick("US") || null;
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      overview, runtime, genres, backdrop_url, trailer, vote_average, vote_count, age_rating
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
