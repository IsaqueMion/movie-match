import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { discoverMovies } from '../lib/functions'
import HomeCarousel from '../components/HomeCarousel'

type Card = { title: string; year: number | null; poster_url: string }

export default function Landing() {
  const [items, setItems] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const data = await discoverMovies({ page: 1, filters: {} })
        const pick = (data.results ?? [])
          .filter(r => !!r.poster_url)
          .slice(0, 8)
          .map(r => ({ title: r.title, year: r.year, poster_url: r.poster_url! }))
        setItems(pick)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <main className="min-h-dvh bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">MovieMatch</h1>
          <div className="flex gap-2">
            <Link to="/create" className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600">Criar sessão</Link>
            <Link to="/join" className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15">Entrar</Link>
          </div>
        </header>

        <section className="mt-6">
          {loading ? (
            <div className="h-[40vh] grid place-items-center text-white/80">Carregando…</div>
          ) : items.length ? (
            <HomeCarousel items={items} />
          ) : (
            <div className="h-[40vh] grid place-items-center text-white/70">Sem destaques agora.</div>
          )}
        </section>
      </div>
    </main>
  )
}
