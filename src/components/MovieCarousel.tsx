import { useEffect, useMemo, useState } from 'react'
import type { MovieDetails } from '../lib/functions'

type Props = {
  title: string
  year: number | null
  poster_url: string
  details?: MovieDetails
  fullHeight?: boolean
}

type SlideKey = 'poster' | 'trailer' | 'synopsis'

export default function MovieCarousel({ title, year, poster_url, details, fullHeight = true }: Props) {
  const hasTrailer = details?.trailer?.site === 'YouTube' && !!details?.trailer?.key

  const slides = useMemo<{ key: SlideKey }[]>(() => {
    const arr: { key: SlideKey }[] = [{ key: 'poster' }]
    if (hasTrailer) arr.push({ key: 'trailer' })
    arr.push({ key: 'synopsis' })
    return arr
  }, [hasTrailer])

  const [slide, setSlide] = useState(0)
  useEffect(() => {
    if (slide > slides.length - 1) setSlide(0)
  }, [slides.length, slide])

  const next = () => setSlide((s) => (s + 1) % slides.length)
  const prev = () => setSlide((s) => (s - 1 + slides.length) % slides.length)

  const youtubeEmbed = hasTrailer ? `https://www.youtube.com/embed/${details!.trailer!.key}?playsinline=1&rel=0` : null
  const slideKey = slides[slide].key

  return (
    <div className="w-full h-full select-none">
      <div className="relative isolate h-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
        <div className={`relative h-full ${fullHeight ? '' : 'min-h-[520px]'} bg-neutral-950 text-white`}>

          {/* Poster */}
          <FadeSlide visible={slideKey === 'poster'}>
            <div className="w-full h-full flex items-center justify-center bg-black p-2">
              <img
                src={poster_url}
                alt={title}
                className="max-h-full max-w-full object-contain"
                draggable={false}
                crossOrigin="anonymous"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  if (!img.dataset.retry && poster_url.includes('/w500/')) {
                    img.dataset.retry = '1'
                    img.src = poster_url.replace('/w500/', '/original/')
                  }
                }}
              />
            </div>
          </FadeSlide>

          {/* Trailer */}
          <FadeSlide visible={slideKey === 'trailer'}>
            {youtubeEmbed ? (
              <div className="w-full h-full flex items-center justify-center bg-black pb-24">
                <div className="relative h-full aspect-[9/16] max-h-full z-10">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={youtubeEmbed}
                    title={`${title} trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ zIndex: 10 }}
                  />
                </div>
              </div>
            ) : (
              <Skeleton>Carregando trailer…</Skeleton>
            )}
          </FadeSlide>

          {/* Sinopse */}
          <FadeSlide visible={slideKey === 'synopsis'}>
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full max-w-sm mx-auto bg-white text-gray-900 p-4 rounded-xl shadow-lg">
                <h3 className="font-semibold text-lg">{title}{year ? ` (${year})` : ''}</h3>
                <div className="mt-0.5 text-sm text-gray-600">
                  {details?.runtime ? `${details.runtime} min` : '—'}
                  {details?.genres?.length ? ` • ${details.genres.map(g => g.name).join(' • ')}` : ''}
                </div>
                <div className="mt-3 text-sm leading-relaxed max-h-64 overflow-y-auto pr-1">
                  {details?.overview || <Skeleton>Carregando sinopse…</Skeleton>}
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* setas (sempre acima) */}
          {slides.length > 1 && (
            <>
              <button
                onClick={prev}
                className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 z-40 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur"
                aria-label="Anterior"
              >‹</button>
              <button
                onClick={next}
                className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 z-40 bg-white/15 hover:bg-white/25 transition px-3 py-2 rounded-full backdrop-blur"
                aria-label="Próximo"
              >›</button>
            </>
          )}

          {/* dots (esconde no trailer) */}
          {slides.length > 1 && slideKey !== 'trailer' && (
            <div className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex gap-2 bg-black/20 rounded-full px-2 py-1 backdrop-blur">
              {slides.map((s, idx) => (
                <button
                  key={s.key}
                  onClick={() => setSlide(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition ${idx === slide ? 'bg-white' : 'bg-white/50'}`}
                  aria-label={`Ir para ${s.key}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FadeSlide({ visible, children }: { visible: boolean, children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, zIndex: visible ? 10 : 0, pointerEvents: visible ? 'auto' as const : 'none' as const }}
    >
      {children}
    </div>
  )
}

function Skeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          {children ? <div className="text-xs text-gray-500">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}
