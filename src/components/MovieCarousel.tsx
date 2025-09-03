import { useEffect, useMemo, useState } from 'react'

type Item = { title: string; year: number | null; poster_url: string }

export default function HomeCarousel({ items }: { items: Item[] }) {
  const slides = useMemo(() => items.filter(i => !!i.poster_url), [items])
  const [i, setI] = useState(0)

  // auto play
  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setI(s => (s + 1) % slides.length), 4000)
    return () => clearInterval(t)
  }, [slides.length])

  const next = () => setI(s => (s + 1) % slides.length)
  const prev = () => setI(s => (s - 1 + slides.length) % slides.length)

  const cur = slides[i]

  return (
    <div className="relative isolate w-full max-w-4xl mx-auto aspect-[16/9] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-xl">
      {/* imagem de fundo */}
      {slides.map((s, idx) => (
        <img
          key={`${s.title}-${idx}`}
          src={s.poster_url}
          alt={s.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: idx === i ? 1 : 0 }}
          crossOrigin="anonymous"
        />
      ))}

      {/* gradiente e texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
      {cur && (
        <div className="absolute left-6 bottom-6 right-6 text-white drop-shadow">
          <h3 className="text-2xl sm:text-3xl font-semibold truncate">{cur.title}{cur.year ? ` (${cur.year})` : ''}</h3>
        </div>
      )}

      {/* setas */}
      {slides.length > 1 && (
        <>
          <button onClick={prev} aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-40 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur text-white">
            ‹
          </button>
          <button onClick={next} aria-label="Próximo"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-40 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur text-white">
            ›
          </button>
        </>
      )}

      {/* dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {slides.map((_, idx) => (
            <div key={idx} className={`w-2.5 h-2.5 rounded-full ${idx === i ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
