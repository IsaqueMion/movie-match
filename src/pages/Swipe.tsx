import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { discoverMovies, getMovieDetails, type MovieDetails, type DiscoverFilters } from '../lib/functions'
import MovieCarousel from '../components/MovieCarousel'
import { Heart, X as XIcon, Share2, Star, Undo2, SlidersHorizontal } from 'lucide-react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import { Toaster, toast } from 'sonner'
import Select from '../components/Select'

type Movie = {
  movie_id: number
  tmdb_id: number
  title: string
  year: number | null
  poster_url: string | null
  genres: number[]
}

const DRAG_LIMIT = 160
const SWIPE_DISTANCE = 120
const SWIPE_VELOCITY = 800
const EXIT_DURATION_MS = 240

type OnlineUser = { id: string; name: string }

const GENRES = [
  { id: 28, name: 'Ação' }, { id: 12, name: 'Aventura' }, { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Família' }, { id: 14, name: 'Fantasia' },
  { id: 36, name: 'História' }, { id: 27, name: 'Terror' }, { id: 10402, name: 'Música' },
  { id: 9648, name: 'Mistério' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Ficção científica' },
  { id: 10770, name: 'TV Movie' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'Guerra' },
  { id: 37, name: 'Faroeste' },
]

export default function Swipe() {
  const { code } = useParams()

  // estado
  const [movies, setMovies] = useState<Movie[]>([])
  const [i, setI] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  // sessão/usuário
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName] = useState('Guest')

  // cache TMDB
  const [detailsCache, setDetailsCache] = useState<Record<number, MovieDetails>>({})

  // aux
  const matchedRef = useRef(new Set<number>())
  const seenRef = useRef(new Set<number>())

  // direção do último swipe (resolve inversões)
  const [lastDir, setLastDir] = useState<'like' | 'dislike' | null>(null)

  // histórico p/ UNDO (guarda movie.id real)
  const historyRef = useRef<number[]>([])

  // banner UNDO
  const [undoMsg, setUndoMsg] = useState<string | null>(null)

  // modal de match
  const [matchModal, setMatchModal] = useState<{ title: string; poster_url: string | null; year?: number | null } | null>(null)

  // guard para clicks rápidos (anti-reentrância)
  const clickGuardRef = useRef(false)

  // presença
  const [online, setOnline] = useState<OnlineUser[]>([])

  // 🔎 filtros
  const currentYear = new Date().getFullYear()
  const DEFAULT_FILTERS: DiscoverFilters = {
    genres: [],
    yearMin: 1990,
    yearMax: currentYear,
    ratingMin: 0,
    language: '',                 // <- "Qualquer"
    sortBy: 'popularity.desc',
  }
  const [filters, setFilters] = useState<DiscoverFilters>({ ...DEFAULT_FILTERS })
  const [openFilters, setOpenFilters] = useState(false)

  const current = movies[i]

  // contagem para chip “N filtros”
  const filtersCount =
    (filters.genres?.length ?? 0) +
    (filters.yearMin ? 1 : 0) +
    (filters.yearMax ? 1 : 0) +
    ((filters.ratingMin ?? 0) > 0 ? 1 : 0) +
    (filters.language && filters.language !== '' ? 1 : 0) +
    (filters.sortBy && filters.sortBy !== 'popularity.desc' ? 1 : 0)

  async function loadPage(pageToLoad: number, f: DiscoverFilters = filters) {
    const data = await discoverMovies({ page: pageToLoad, filters: f })
    const unique = data.results.filter((m: Movie) => !seenRef.current.has(m.movie_id))
    unique.forEach((m: Movie) => seenRef.current.add(m.movie_id))
    if (unique.length > 0) {
      setMovies(prev => [...prev, ...unique])
      setPage(pageToLoad)
    }
    return unique.length
  }

  async function resetAndLoad(
    resume = false,
    f?: DiscoverFilters,
    sessionRef?: string | null
  ) {
    const effective = f ?? filters
    const sid = sessionRef ?? sessionId   // <- usa o sessionId passado
    setLoading(true)
    setMovies([])
    setI(0)
    setPage(1)
    seenRef.current.clear()
    try {
      const target = resume ? loadProgress(sid, effective) : 0
      let acc = 0
      let pageToLoad = 1
      while (acc <= target) {
        const added = await loadPage(pageToLoad, effective)
        if (added === 0) break
        acc += added
        pageToLoad++
        if (pageToLoad > 30) break
      }
      setI(resume ? target : 0)
    } catch (e: any) {
      console.error(e)
      toast.error(`Erro ao carregar filmes: ${e.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    (async () => {
      try {
        if (!code) return
        let { data: userData } = await supabase.auth.getUser()
        if (!userData?.user) {
          const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
          if (authErr) throw authErr
          userData = { user: auth.user! }
        }
        const uid = userData.user!.id
        setUserId(uid)

        const { error: upUserErr } = await supabase.from('users').upsert({ id: uid, display_name: displayName })
        if (upUserErr) throw upUserErr

        const { data: sess, error: sessErr } = await supabase
          .from('sessions').select('id, code').eq('code', code!.toUpperCase()).single()
        if (sessErr) throw sessErr
        setSessionId(sess.id)

        const { error: memErr } = await supabase
          .from('session_members').upsert({ session_id: sess.id, user_id: uid }, { onConflict: 'session_id,user_id' })
        if (memErr) throw memErr

// carregar filtros salvos (se houver) e criar snapshot
    let effectiveFilters: DiscoverFilters = { ...DEFAULT_FILTERS }
    try {
      const { data: sf } = await supabase
        .from('session_filters')
        .select('*')
        .eq('session_id', sess.id)
        .maybeSingle()
      if (sf) {
        effectiveFilters = {
          genres: sf.genres ?? [],
          yearMin: sf.year_min ?? 1990,
          yearMax: sf.year_max ?? currentYear,
          ratingMin: typeof sf.rating_min === 'number' ? Number(sf.rating_min) : 0,
          language: sf.language ?? '',
          sortBy: sf.sort_by ?? 'popularity.desc',
        }
      }
    } catch (e) {
      console.debug('filters load:', e)
    }
    setFilters(effectiveFilters)

    // retoma usando o snapshot (evita rodar com filtros padrão)
    await resetAndLoad(true, effectiveFilters, sess.id)

      } catch (e: any) {
        console.error(e)
        toast.error(`Erro ao preparar a sessão: ${e.message ?? e}`)
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, displayName])

  useEffect(() => {
    (async () => {
      if (!current) return
      const key = current.tmdb_id
      if (detailsCache[key]) return
      try {
        const det = await getMovieDetails(key)
        setDetailsCache(prev => ({ ...prev, [key]: det }))
      } catch (e) {
        console.error('details error', e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.tmdb_id])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`sess-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          if (payload.new?.value !== 1) return
          const movieId = payload.new.movie_id as number

          const { count, error } = await supabase
            .from('reactions')
            .select('user_id', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .eq('movie_id', movieId)
            .eq('value', 1)

          if (error) { console.error('count error', error); return }

          if ((count ?? 0) >= 2 && !matchedRef.current.has(movieId)) {
            matchedRef.current.add(movieId)

            // busca info do filme pelo id REAL
            const { data: mv } = await supabase
              .from('movies')
              .select('title, year, poster_url')
              .eq('id', movieId)
              .maybeSingle()

            const title = mv?.title ?? `Filme #${movieId}`
            setMatchModal({ title, poster_url: mv?.poster_url ?? null, year: mv?.year ?? null })
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, movies, detailsCache])

  // presença
  useEffect(() => {
    if (!sessionId || !userId) return
    const ch = supabase.channel(`presence-${sessionId}`, { config: { presence: { key: userId } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, any[]>
      const arr: OnlineUser[] = []
      Object.values(state).forEach((metas) => {
        metas.forEach((m: any) => arr.push({ id: String(m.user_id ?? m.key ?? ''), name: String(m.display_name ?? 'Guest') }))
      })
      const dedup = Array.from(new Map(arr.map(u => [u.id, u])).values())
      setOnline(dedup)
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ user_id: userId, display_name: displayName, joined_at: new Date().toISOString() })
      }
    })
    return () => { try { ch.untrack() } catch {} supabase.removeChannel(ch) }
  }, [sessionId, userId, displayName])

  async function goNext() {
    const nextIndex = i + 1
    if (nextIndex < movies.length) {
      setI(nextIndex)
      saveProgress(sessionId, filters, nextIndex) // <- salva
      return
    }
    if (loadingMore) return
    setLoadingMore(true)
    try {
      let added = await loadPage(page + 1)
      let tries = 0
      while (added === 0 && tries < 2) {
        tries++
        added = await loadPage(page + 1 + tries)
      }
      if (added > 0) {
        const newIndex = movies.length // próximo item
        setI(newIndex)
        saveProgress(sessionId, filters, newIndex) // <- salva
      }
    } finally {
      setLoadingMore(false)
    }
  }

  async function react(value: 1 | -1) {
    if (!sessionId || !userId || !current) return
    if (clickGuardRef.current || busy) return

    clickGuardRef.current = true
    setBusy(true)
    setLastDir(value === 1 ? 'like' : 'dislike')

    try {
      // 1) Upsert do filme pela UNICIDADE de tmdb_id (não envie 'id' aqui!)
      const { data: upserted, error: movieErr } = await supabase
        .from('movies')
        .upsert(
          {
            tmdb_id: current.tmdb_id,
            title: current.title,
            year: current.year ?? null,
            poster_url: current.poster_url ?? null,
          },
          { onConflict: 'tmdb_id' }
        )
        .select('id')
        .single()

      if (movieErr) throw movieErr
      const movieId = upserted?.id
      if (!movieId) throw new Error('Falha ao obter movie.id')

      // 2) Grava a reação usando o id REAL da tabela movies
      const { error: rxErr } = await supabase
        .from('reactions')
        .upsert(
          { session_id: sessionId, user_id: userId, movie_id: movieId, value },
          { onConflict: 'session_id,user_id,movie_id' }
        )

      if (rxErr) throw rxErr

      // 3) Guarda no histórico (para desfazer) o id REAL
      historyRef.current.push(movieId)
    } catch (e: any) {
      console.error('reactions upsert error:', e)
      toast.error(`Erro ao salvar reação: ${e.message ?? e}`)
    } finally {
      await goNext()
      setTimeout(() => { clickGuardRef.current = false; setBusy(false) }, EXIT_DURATION_MS + 60)
    }
  }

  async function undo() {
    if (!sessionId || !userId || busy) return
    const last = historyRef.current.pop()
    if (!last) return
    setBusy(true)
    try {
      setI(idx => {
        const v = Math.max(0, idx - 1)
        saveProgress(sessionId, filters, v) // <- salva ao desfazer
        return v
      })
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('movie_id', last)
      if (error) throw error
      setUndoMsg('Último swipe desfeito')
      setTimeout(() => setUndoMsg(null), 1800)
    } catch (e: any) {
      console.error(e)
      toast.error(`Não foi possível desfazer: ${e.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  async function shareInvite() {
    const invite = `${window.location.origin}/join?code=${(code ?? '').toUpperCase()}`
    try {
      await navigator.clipboard.writeText(invite)
      toast('Link copiado!', { description: invite })
    } catch {
      toast('Copie o link:', { description: invite })
    }
  }

  // variantes (null => sai para a DIREITA)
  const cardVariants = {
    initial: { opacity: 0, y: 12, scale: 0.985, rotate: 0, x: 0 },
    enter:   { opacity: 1, y: 0,  scale: 1,    rotate: 0, x: 0,
               transition: { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 } },
    exit:    (dir: 'like' | 'dislike' | null) => ({
      x: dir === 'dislike' ? -140 : 140,
      rotate: dir === 'dislike' ? -8 : 8,
      opacity: 0,
      transition: { duration: 0.22, ease: 'easeOut' }
    }),
  } as const

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 overflow-hidden">
        <p className="text-white/90">Carregando sessão…</p>
        <Toaster richColors position="bottom-center" />
      </main>
    )
  }

  const det = current ? detailsCache[current.tmdb_id] : undefined

  // helpers sliders (yearMin/yearMax com dois ranges)
  const [yearMinLocal, yearMaxLocal] = [
    filters.yearMin ?? 1990,
    filters.yearMax ?? currentYear,
  ]
  const clampYear = (v: number) => Math.max(1900, Math.min(currentYear, v))

  return (
    <main className="min-h-dvh flex flex-col bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 overflow-hidden">
      {/* Top bar (compacta) */}
      <div className="shrink-0 px-3 pt-2">
        <div className="max-w-md mx-auto flex items-center justify-between rounded-xl bg-white/5 backdrop-blur px-2.5 py-1.5 ring-1 ring-white/10">
          <div className="flex items-center gap-2 min-w-0 text-xs text-white/80">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white">
              Sessão <span className="font-semibold">{code}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {online.length} online
            </span>
            {filtersCount > 0 && (
              <button
                onClick={() => setOpenFilters(true)}
                className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/15"
                title="Editar filtros"
              >
                {filtersCount} filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setOpenFilters(true)}
              title="Filtros"
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={shareInvite}
              title="Compartilhar link"
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              to={`/s/${code}/matches`}
              title="Ver matches"
              className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Star className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* centro */}
      <div className="flex-1 px-4 pb-3 overflow-hidden">
        <div className="w-full max-w-md mx-auto h-[calc(100dvh-112px)]">
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait" initial={false} onExitComplete={() => setLastDir(null)}>
                {current ? (
                  <SwipeCard
                    key={current.movie_id}
                    movie={current}
                    details={det}
                    variants={cardVariants}
                    exitDir={lastDir}
                    onDragState={setDragging}
                    onDecision={(v) => react(v)}
                  />
                ) : (
                  <motion.div key="empty" className="h-full grid place-items-center text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="text-center">
                      <p>Acabaram os filmes deste lote 😉</p>
                      {loadingMore ? <p className="text-white/60 mt-1">Buscando mais filmes…</p> : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center justify-center gap-5">
          <motion.button
            onClick={() => react(-1)}
            disabled={busy || dragging || !current}
            className="w-16 h-16 grid place-items-center rounded-full bg-red-500 text-white shadow-xl disabled:opacity-60"
            aria-label="Deslike"
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92, rotate: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <XIcon className="w-8 h-8" />
          </motion.button>

          <motion.button
            onClick={() => undo()}
            disabled={busy || dragging || historyRef.current.length === 0}
            className="w-12 h-12 grid place-items-center rounded-full bg-white/10 text-white shadow-lg disabled:opacity-40"
            aria-label="Desfazer"
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} title="Desfazer (Backspace)"
          >
            <Undo2 className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={() => react(1)}
            disabled={busy || dragging || !current}
            className="w-16 h-16 grid place-items-center rounded-full bg-emerald-500 text-white shadow-xl disabled:opacity-60"
            aria-label="Like"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92, rotate: 6 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <Heart className="w-8 h-8" />
          </motion.button>
        </div>
      </div>

      {/* Banner topo UNDO */}
      <AnimatePresence>
        {undoMsg && (
          <div className="fixed top-3 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
              className="pointer-events-auto w-fit max-w-[92vw] px-3 py-1.5 rounded-md bg-white/90 text-neutral-900 text-sm text-center shadow">
              {undoMsg}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Filtros — versão aprimorada */}
      <AnimatePresence>
        {openFilters && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpenFilters(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative z-10 w-[min(92vw,38rem)] max-h-[90dvh] overflow-auto rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Filtros</h3>
                <button
                  className="text-sm px-2 py-1 rounded-md bg-white/10 hover:bg-white/15"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  title="Limpar todos os filtros"
                >
                  Limpar
                </button>
              </div>

              {/* Gêneros */}
              <div className="mb-4">
                <div className="text-sm mb-1">Gêneros</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GENRES.map(g => {
                    const checked = filters.genres?.includes(g.id) ?? false
                    return (
                      <label key={g.id} className={`text-sm px-2 py-1 rounded-md border ${checked ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10'} cursor-pointer inline-flex items-center gap-2`}>
                        <input
                          type="checkbox"
                          className="accent-emerald-500"
                          checked={checked}
                          onChange={(e) => {
                            setFilters(f => {
                              const set = new Set(f.genres ?? [])
                              if (e.target.checked) set.add(g.id); else set.delete(g.id)
                              return { ...f, genres: Array.from(set) }
                            })
                          }}
                        />
                        {g.name}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Ano (range duplo) */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">Ano (intervalo)</div>
                  <div className="text-xs text-white/70">
                    {yearMinLocal} – {yearMaxLocal}
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    type="range"
                    min={1900}
                    max={currentYear}
                    value={yearMinLocal}
                    onChange={(e) => {
                      const v = clampYear(Number(e.target.value || 1900))
                      setFilters(f => ({ ...f, yearMin: Math.min(v, f.yearMax ?? currentYear) }))
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={1900}
                    max={currentYear}
                    value={yearMaxLocal}
                    onChange={(e) => {
                      const v = clampYear(Number(e.target.value || currentYear))
                      setFilters(f => ({ ...f, yearMax: Math.max(v, f.yearMin ?? 1900) }))
                    }}
                    className="w-full mt-1"
                  />
                </div>
              </div>

              {/* Nota mínima + Idioma + Ordenar */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Nota mínima</label>
                  <div className="text-xs text-white/70 mb-1">≥ {filters.ratingMin ?? 0}</div>
                  <input
                    type="range" min={0} max={10} step={0.5}
                    value={filters.ratingMin ?? 0}
                    onChange={e => setFilters(f => ({ ...f, ratingMin: Number(e.target.value || 0) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Idioma original</label>
                  <Select
                    value={filters.language ?? ''}
                    onChange={(v) => setFilters((f) => ({ ...f, language: v }))}
                    options={[
                      { value: '',   label: 'Qualquer' },
                      { value: 'pt', label: 'Português' },
                      { value: 'en', label: 'Inglês' },
                      { value: 'es', label: 'Espanhol' },
                      { value: 'fr', label: 'Francês' },
                      { value: 'de', label: 'Alemão' },
                      { value: 'it', label: 'Italiano' },
                      { value: 'ja', label: 'Japonês' },
                      { value: 'ko', label: 'Coreano' },
                      { value: 'hi', label: 'Hindi' },
                      { value: 'ru', label: 'Russo' },
                      { value: 'zh', label: 'Chinês' },
                      { value: 'ar', label: 'Árabe' },
                    ]}
                    className=""
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Ordenar por</label>
                  <Select
                    value={filters.sortBy ?? 'popularity.desc'}
                    onChange={(v) => setFilters((f) => ({ ...f, sortBy: v }))}
                    options={[
                      { value: 'popularity.desc',           label: 'Popularidade (desc)' },
                      { value: 'popularity.asc',            label: 'Popularidade (asc)'  },
                      { value: 'vote_average.desc',         label: 'Nota (desc)'         },
                      { value: 'vote_average.asc',          label: 'Nota (asc)'          },
                      { value: 'primary_release_date.desc', label: 'Lançamento (recente)' },
                      { value: 'primary_release_date.asc',  label: 'Lançamento (antigo)'  },
                      { value: 'revenue.desc',              label: 'Receita (desc)'      },
                      { value: 'revenue.asc',               label: 'Receita (asc)'       },
                    ]}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                  onClick={() => setOpenFilters(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={async () => {
                    setOpenFilters(false)
                    const fSnap = { ...filters } // snapshot estável
                    if (sessionId && userId) {
                      try {
                        await supabase.from('session_filters').upsert({
                          session_id: sessionId,
                          genres: fSnap.genres ?? [],
                          year_min: fSnap.yearMin ?? 1990,
                          year_max: fSnap.yearMax ?? currentYear,
                          rating_min: fSnap.ratingMin ?? 0,
                          language: fSnap.language ?? '',
                          sort_by: fSnap.sortBy ?? 'popularity.desc',
                          updated_by: userId,
                        }, { onConflict: 'session_id' })
                      } catch (e) {
                        console.debug('filters save:', e)
                      }
                    }
                    clearProgress(sessionId, fSnap)
                    await resetAndLoad(false, fSnap, sessionId)
                  }}
                >
                  Aplicar filtros
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Match */}
      <AnimatePresence>
        {matchModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMatchModal(null)} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative z-10 w-[min(92vw,28rem)] rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-4 text-white"
            >
              <div className="flex items-center gap-3">
                {matchModal.poster_url ? (
                  <img src={matchModal.poster_url} alt={matchModal.title} className="w-16 h-24 object-cover rounded-md ring-1 ring-white/10" />
                ) : null}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">Deu match!</h3>
                  <p className="text-sm text-white/80 truncate">
                    {matchModal.title} {matchModal.year ? <span className="text-white/60">({matchModal.year})</span> : null}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setMatchModal(null)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">Continuar</button>
                <Link to={`/s/${code}/matches`} className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => setMatchModal(null)}>Ver matches</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster richColors position="bottom-center" />
    </main>
  )
}

/* ========= Persistência de progresso (por sessão + filtros) ========= */
function filtersSig(f: DiscoverFilters) {
  return [
    (f.genres ?? []).join(','),
    f.yearMin ?? '',
    f.yearMax ?? '',
    f.ratingMin ?? '',
    f.language ?? '',
    f.sortBy ?? ''
  ].join('|')
}
function progressKey(sessionId: string | null, f: DiscoverFilters) {
  return sessionId ? `mm_prog:v1:${sessionId}:${filtersSig(f)}` : ''
}
function saveProgress(sessionId: string | null, f: DiscoverFilters, idx: number) {
  try {
    const k = progressKey(sessionId, f)
    if (!k) return
    localStorage.setItem(k, JSON.stringify({ i: idx }))
  } catch {}
}
function loadProgress(sessionId: string | null, f: DiscoverFilters): number {
  try {
    const k = progressKey(sessionId, f)
    if (!k) return 0
    const raw = localStorage.getItem(k)
    if (!raw) return 0
    const obj = JSON.parse(raw)
    return Number.isFinite(obj?.i) ? obj.i : 0
  } catch { return 0 }
}
function clearProgress(sessionId: string | null, f: DiscoverFilters) {
  try {
    const k = progressKey(sessionId, f)
    if (k) localStorage.removeItem(k)
  } catch {}
}

/** Card com motionValue próprio */
function SwipeCard({
  movie, details, variants, exitDir, onDragState, onDecision,
}: {
  movie: Movie
  details?: MovieDetails
  variants: any
  exitDir: 'like' | 'dislike' | null
  onDragState: (dragging: boolean) => void
  onDecision: (value: 1 | -1) => void
}) {
  const x = useMotionValue(0)
  const likeOpacity = useTransform(x, [40, DRAG_LIMIT], [0, 1])
  const dislikeOpacity = useTransform(x, [-DRAG_LIMIT, -40], [1, 0])
  useEffect(() => { x.set(0) }, [x])

  return (
    <motion.div
      className="h-full will-change-transform relative"
      variants={variants} custom={exitDir}
      initial="initial" animate="enter" exit="exit"
      style={{ x }} drag="x" dragElastic={0.2} dragConstraints={{ left: -DRAG_LIMIT, right: DRAG_LIMIT }}
      onDragStart={() => onDragState(true)}
      onDragEnd={(_, info) => {
        onDragState(false)
        const passDistance = Math.abs(info.offset.x) > SWIPE_DISTANCE
        const passVelocity = Math.abs(info.velocity.x) > SWIPE_VELOCITY
        if (passDistance || passVelocity) onDecision(info.offset.x > 0 ? 1 : -1)
      }}
    >
      {/* Overlay feedback */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-4">
        <motion.div style={{ opacity: dislikeOpacity }} className="rounded-lg border-2 border-red-500/70 text-red-500/90 px-3 py-1.5 font-semibold rotate-[-8deg] bg-black/20">
          <div className="flex items-center gap-1"><XIcon className="w-5 h-5" /><span>NOPE</span></div>
        </motion.div>
        <motion.div style={{ opacity: likeOpacity }} className="rounded-lg border-2 border-emerald-500/70 text-emerald-400 px-3 py-1.5 font-semibold rotate-[8deg] bg-black/20">
          <div className="flex items-center gap-1"><Heart className="w-5 h-5" /><span>LIKE</span></div>
        </motion.div>
      </div>

      {/* Conteúdo */}
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0">
          <MovieCarousel title={movie.title} year={movie.year} poster_url={movie.poster_url || ''} details={details} fullHeight />
        </div>

        {/* Meta compacta */}
        <div className="mt-1 text-white shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold leading-tight line-clamp-1">
              {movie.title} {movie.year ? <span className="text-white/60">({movie.year})</span> : null}
            </h3>
            <div className="ml-3 inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[13px]">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="tabular-nums">{(details?.vote_average ?? null) ? details!.vote_average!.toFixed(1) : '—'}</span>
            </div>
          </div>

          {details?.genres?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {details.genres.slice(0, 3).map(g => (
                <span key={g.id} className="text-[11px] rounded-full bg-white/10 px-2 py-0.5 text-white/90">{g.name}</span>
              ))}
            </div>
          ) : null}

          <div className="mt-1">
            <span className="text-[11px] text-white/70 mr-1.5">Classificação:</span>
            <span className="text-[11px] inline-flex items-center rounded-md bg-white/10 px-2 py-0.5">
              {details?.age_rating?.trim() || '—'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
