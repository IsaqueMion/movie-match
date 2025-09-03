import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clapperboard, Heart, Users, Play, Film, Sparkles } from 'lucide-react'
import { discoverMovies } from '../lib/functions'

type CarouselItem = {
  title: string
  year: number | null
  poster_url: string
}

export default function Landing() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  function handleJoin() {
    const c = code.trim().toUpperCase()
    if (!c) navigate('/join')
    else navigate(`/join?code=${encodeURIComponent(c)}`)
  }

  // ------------------------------
  // Carrossel (puxa da Edge Function "discover")
  // ------------------------------
  const [items, setItems] = useState<CarouselItem[]>([])
  const [idx, setIdx] = useState(0)
  const [loadingCarousel, setLoadingCarousel] = useState(true)
  const pausedRef = useRef(false)

  useEffect(() => {
    (async () => {
      try {
          const randomPage = 1 + Math.floor(Math.random() * 5)
          const data = await discoverMovies({ page: randomPage, filters: {} })
          const list = (data?.results ?? [])
            .filter((m: any) => m?.poster_url)
            .slice(0, 8) // menos carga
            .map((m: any) => ({ title: m.title, year: m.year ?? null, poster_url: m.poster_url }))
          if (list.length > 0) setItems(list)
      } catch (e) {
         console.error('discoverMovies failed:', e)
        } finally {
          setLoadingCarousel(false)
        }
      })()
  }, [])

  // autoplay
  useEffect(() => {
    if (!items.length) return
    const t = setInterval(() => {
      if (!pausedRef.current) {
        setIdx((i) => (i + 1) % items.length)
      }
    }, 3200)
    return () => clearInterval(t)
  }, [items])

  const current = items[idx]
  const hasCarousel = items.length > 0

  // pontinhos
  const dots = useMemo(() => {
    const MAX = Math.min(6, items.length) // não lotar
    if (MAX <= 1) return null
    // exibir janela deslizante de dots (quando muitas imagens)
    const start = Math.min(Math.max(0, idx - Math.floor(MAX / 2)), Math.max(0, items.length - MAX))
    const visible = items.slice(start, start + MAX)
    return { start, visible, max: MAX }
  }, [items, idx])

  return (
    <div className="relative min-h-dvh overflow-hidden bg-neutral-950 text-white">
      {/* --- BACKGROUND --- */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-850" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-pink-500/15 blur-[110px]" />
        <svg aria-hidden className="absolute inset-0 opacity-[0.05]" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      {/* --- HEADER --- */}
      <header className="px-4 pt-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
              <Clapperboard className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">MovieMatch</span>
          </Link>

          <nav className="hidden gap-2 sm:flex">
            <a href="#como-funciona" className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">Como funciona</a>
            <a href="#recursos" className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">Recursos</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
            >
              <Sparkles className="h-4 w-4" />
              Criar sessão
            </Link>
          </div>
        </div>
      </header>

      {/* --- HERO --- */}
      <main className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-2 md:gap-12 md:pt-14">
        {/* Texto esquerda */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-6"
        >
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Dê <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">match</span> no filme perfeito
          </h1>
          <p className="max-w-prose text-lg text-white/80">
            Convide amigos, deslize para o lado e encontre o filme em que todos dão <span className="text-emerald-300">like</span>.
            Simples, fácil e sem briga.
          </p>

          {/* CTA */}
          <div className="mt-6 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => (e.key === 'Enter' ? handleJoin() : undefined)}
                placeholder="Digite o código da sessão (ex.: 7F9XQ2)"
                className="h-11 w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 text-white outline-none placeholder:text-white/40"
              />
              <button
                onClick={handleJoin}
                className="h-11 shrink-0 rounded-lg bg-white/10 px-4 font-medium text-white ring-1 ring-white/10 hover:bg-white/15"
              >
                Entrar
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="hidden h-px flex-1 bg-white/10 sm:block" />
              <span className="text-xs text-white/60">ou</span>
              <div className="hidden h-px flex-1 bg-white/10 sm:block" />
              <Link
                to="/create"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                <Sparkles className="h-4 w-4" />
                Criar nova sessão
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-sm text-white/70">
              <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">Sem cadastro</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">Tempo real</span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">Funciona no navegador</span>
            </div>
          </div>
        </motion.div>

        {/* Carrossel direita */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          className="relative"
        >
          <div
            className="relative mx-auto w-[min(28rem,92vw)] overflow-hidden rounded-3xl bg-neutral-900/60 ring-1 ring-white/10 shadow-xl"
            onMouseEnter={() => (pausedRef.current = true)}
            onMouseLeave={() => (pausedRef.current = false)}
          >
            {/* topo mock */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Users className="h-4 w-4 text-emerald-300" />
                3 online
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-xs ring-1 ring-white/10">
                <Heart className="h-3.5 w-3.5 text-emerald-300" /> Match instantâneo
              </div>
            </div>

            {/* Poster com fade */}
            <div className="px-4 pb-4">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 relative bg-neutral-800">
                <AnimatePresence mode="wait" initial={false}>
                  {loadingCarousel ? (
                    <motion.div
                      key="skeleton"
                      className="absolute inset-0"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <SkeletonPoster />
                    </motion.div>
                  ) : hasCarousel ? (
                    <motion.img
                      key={current.poster_url}
                      src={current.poster_url}
                      alt={current.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      initial={{ opacity: 0.0, scale: 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0.0, scale: 1.02 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <motion.div
                      key="fallback"
                      className="absolute inset-0 grid place-items-center text-white/50"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <Film className="h-16 w-16" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* gradiente de leitura no rodapé do pôster */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-900/80 to-transparent" />
              </div>

              {/* Título + dots */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h3
                      key={hasCarousel ? `${current.title}-${current.year ?? ''}` : 'placeholder-title'}
                      className="truncate text-base font-semibold"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                    >
                      {hasCarousel ? (
                        <>
                          {current.title} {current.year ? <span className="text-white/60">({current.year})</span> : null}
                        </>
                      ) : (
                        'Um Filme Qualquer (2024)'
                      )}
                    </motion.h3>
                  </AnimatePresence>
                  <p className="mt-1 flex flex-wrap gap-1 text-xs text-white/70">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">Sugerido</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">Aleatório</span>
                  </p>
                </div>

                {/* dots */}
                {dots && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {dots.visible.map((_, k) => {
                      const realIndex = dots.start + k
                      const active = realIndex === idx
                      return (
                        <button
                          key={realIndex}
                          onClick={() => setIdx(realIndex)}
                          className={`h-2 w-2 rounded-full transition-all ${
                            active ? 'w-4 bg-white' : 'bg-white/40 hover:bg-white/60'
                          }`}
                          aria-label={`Ir ao slide ${realIndex + 1}`}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ações mock (puramente estético) */}
              <div className="mt-4 flex items-center justify-center gap-4 pb-2">
                <button className="grid h-12 w-12 place-items-center rounded-full bg-red-500 text-white shadow-lg">
                  ✕
                </button>
                <button className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white shadow-lg ring-1 ring-white/10">
                  <Play className="h-5 w-5" />
                </button>
                <button className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
                  ❤
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* --- COMO FUNCIONA --- */}
      <section id="como-funciona" className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="mb-6 text-center text-xl font-semibold text-white/90 md:text-2xl">Como funciona</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Users className="h-5 w-5 text-emerald-300" />}
            title="Crie e convide"
            desc="Gere um código de sessão e compartilhe com quem vai assistir com você."
          />
          <Card
            icon={<Heart className="h-5 w-5 text-emerald-300" />}
            title="Dê like ou dislike"
            desc="Deslize pelo catálogo; quando duas pessoas curtirem o mesmo filme, é match!"
          />
          <Card
            icon={<Play className="h-5 w-5 text-emerald-300" />}
            title="É hora do play"
            desc="Veja a lista de matches e escolha o que todo mundo topa assistir."
          />
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="px-4 pb-8">
        <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10 backdrop-blur">
          <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-white/80" />
              <span>MovieMatch • encontre o filme em comum</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="#recursos" className="hover:text-white">Recursos</a>
              <Link to="/create" className="hover:text-white">Criar sessão</Link>
              <Link to="/join" className="hover:text-white">Entrar</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Card({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/10">
        {icon}
        <span className="text-sm font-medium text-white/90">{title}</span>
      </div>
      <p className="text-sm text-white/70">{desc}</p>
    </div>
  )
}

function SkeletonPoster() {
  return (
    <div className="h-full w-full">
      <div className="absolute inset-0 animate-pulse bg-neutral-800" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
    </div>
  )
}
