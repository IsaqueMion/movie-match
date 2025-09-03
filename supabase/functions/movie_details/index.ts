// Edge Function: movie_details (CORS aberto)
// Uso: GET ?tmdb_id=XXXX

const TMDB = "https://api.themoviedb.org/3";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const apiKey = Deno.env.get("TMDB_KEY") || Deno.env.get("TMDB_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TMDB_KEY ausente nas secrets" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const u = new URL(req.url);
    const tmdbId = Number(u.searchParams.get("tmdb_id") || "0");
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return new Response(JSON.stringify({ error: "tmdb_id inválido" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // 1) detalhes gerais
    const detailsUrl = `${TMDB}/movie/${tmdbId}?api_key=${apiKey}&language=pt-BR`;
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) throw new Error(`TMDB details ${detailsRes.status}: ${await detailsRes.text()}`);
    const details = await detailsRes.json();

    // 2) vídeos (trailer)
    const vidsUrl = `${TMDB}/movie/${tmdbId}/videos?api_key=${apiKey}&language=pt-BR`;
    const vidsRes = await fetch(vidsUrl);
    const vids = vidsRes.ok ? await vidsRes.json() : { results: [] as any[] };
    const yt = (vids.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Trailer");
    const trailer = yt ? { site: "YouTube", key: String(yt.key) } : null;

    // 3) classificação etária (tenta BR, senão US)
    const relUrl = `${TMDB}/movie/${tmdbId}/release_dates?api_key=${apiKey}`;
    const relRes = await fetch(relUrl);
    let age = "";
    if (relRes.ok) {
      const rel = await relRes.json();
      const findCert = (cc: string) => {
        const entry = (rel.results ?? []).find((r: any) => r.iso_3166_1 === cc);
        const cert  = entry?.release_dates?.find((d: any) => d.certification)?.certification ?? "";
        return String(cert ?? "");
      };
      age = findCert("BR") || findCert("US") || "";
    }

    const out = {
      vote_average: typeof details.vote_average === "number" ? details.vote_average : undefined,
      runtime:      typeof details.runtime === "number" ? details.runtime : undefined,
      overview:     typeof details.overview === "string" ? details.overview : "",
      genres:       Array.isArray(details.genres) ? details.genres.map((g: any) => ({ id: g.id, name: g.name })) : [],
      age_rating:   age,
      trailer,
    };

    return new Response(JSON.stringify(out), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600, s-maxage=1800",
        ...corsHeaders(),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
});
