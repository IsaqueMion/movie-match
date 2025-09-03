import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'

type UIMatch = {
  movie_id: number
  title: string
  year: number | null
  poster_url: string | null
}

export default function Matches() {
  const { code } = useParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<UIMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        // 1) sessão
        const { data: sess, error: e1 } = await supabase
          .from('sessions')
          .select('id, code')
          .eq('code', (code ?? '').toUpperCase())
          .single()
        if (e1 || !sess) throw e1 ?? new Error('Sessão não encontrada')
        setSessionId(sess.id)

        // 2) carrega matches a partir de reactions (>=2 likes)
        await loadFromReactions(sess.id)

        // 3) realtime: qualquer mudança em reactions recalcula
        const ch = supabase
          .channel(`reactions-${sess.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reactions', filter: `session_id=eq.${sess.id}` },
            () => loadFromReactions(sess.id)
          )
          .subscribe()

        return () => { supabase.removeChannel(ch) }
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function loadFromReactions(sessId: string) {
    // pega todas as reações=like desta sessão
    const { data: reacts, error } = await supabase
      .from('reactions')
      .select('movie_id, user_id, value')
      .eq('session_id', sessId)
      .eq('value', 1)
    if (error) { console.error(error); return }

    // conta likes distintos por filme
    const countByMovie = new Map<number, Set<string>>()
    for (const r of reacts ?? []) {
      const set = countByMovie.get(r.movie_id) ?? new Set<string>()
      set.add(r.user_id)
      countByMovie.set(r.movie_id, set)
    }
    const matchedIds = [...countByMovie.entries()]
      .filter(([, set]) => set.size >= 2)
      .map(([movie_id]) => movie_id)

    if (matchedIds.length === 0) { setItems([]); return }

    // busca títulos/posters na tabela movies (preenchida no swipe)
    const { data: movies, error: e2 } = await supabase
      .from('movies')
      .select('id, title, year, poster_url')
      .in('id', matchedIds)
    if (e2) { console.error(e2); return }

    // ordena por título (ou, se quiser, pelo id)
    const byId = new Map(movies?.map(m => [m.id, m]) ?? [])
    const list: UIMatch[] = matchedIds
      .map(id => {
        const m = byId.get(id)
        return {
          movie_id: id,
          title: m?.title ?? `Filme #${id}`,
          year: m?.year ?? null,
          poster_url: m?.poster_url ?? null,
        }
      })
      .sort((a, b) => a.title.localeCompare(b.title))

    setItems(list)
  }

  return (
    <main className="min-h-dvh p-4 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 text-white">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Matches</h1>
          <Link to={`/s/${code}`} className="text-sm px-3 py-1 rounded-md bg-white/10 hover:bg-white/20">Voltar</Link>
        </div>

        {loading && items.length === 0 ? (
          <p className="text-white/80">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-white/80">Ainda não há matches. Dê like no mesmo filme a partir de duas contas.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {items.map(it => (
              <li key={it.movie_id} className="rounded-lg bg-white/5 ring-1 ring-white/10 overflow-hidden">
                {it.poster_url ? (
                  <img src={it.poster_url} alt={it.title} className="w-full aspect-[2/3] object-contain bg-black" />
                ) : (
                  <div className="w-full aspect-[2/3] grid place-items-center bg-black/60 text-white/70">Sem poster</div>
                )}
                <div className="p-2">
                  <div className="text-sm font-medium leading-tight line-clamp-2">{it.title}</div>
                  {it.year ? <div className="text-xs text-white/60">{it.year}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
