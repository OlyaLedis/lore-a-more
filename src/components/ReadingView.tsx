import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { byline } from '../format'
import { CloseIcon } from './Icons'
import { Illustration } from './Illustration'
import { Lightbox, type Picture } from './Lightbox'

export type ReadingScene = {
  id: string
  text: string
  illustrations: { alt: string; credit?: string; url: string | null }[]
}

type PlayState = 'idle' | 'playing' | 'paused' | 'waiting' | 'finished'

// Pixels per second for each speed step. Slow enough to read aloud to a child.
const SPEEDS = [10, 16, 24, 34, 48]
const SPEED_LABELS = ['Slowest', 'Slow', 'Medium', 'Fast', 'Fastest']
const SIZES = ['text-2xl sm:text-3xl', 'text-3xl sm:text-4xl', 'text-4xl sm:text-5xl']
// The reading line, as a fraction of the visible height: the paragraph crossing it is "current",
// and auto-scroll stops when a picture reaches it.
const READING_LINE = 0.38
const PREFS_KEY = 'storyplace.reading'

type Prefs = { speed: number; size: number; theme: 'dark' | 'light' }

function loadPrefs(): Prefs {
  const fallback: Prefs = { speed: 1, size: 1, theme: 'dark' }
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>
    return {
      speed: saved.speed !== undefined && saved.speed >= 0 && saved.speed < SPEEDS.length ? saved.speed : fallback.speed,
      size: saved.size !== undefined && saved.size >= 0 && saved.size < SIZES.length ? saved.size : fallback.size,
      theme: saved.theme === 'light' ? 'light' : fallback.theme,
    }
  } catch {
    return fallback
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private browsing: preferences just aren't remembered.
  }
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function paragraphsOf(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// Full-screen reading mode: large type, optional slow auto-scroll that stops at each picture and
// whenever the reader scrolls, and a remembered position. Works fully by hand, too.
export function ReadingView({
  title,
  author,
  scenes,
  initialAnchor,
  onPosition,
  onClose,
  closeLabel = 'Close',
}: {
  title: string
  author?: string
  scenes: ReadingScene[]
  // Where to start, from a saved position. Ignored if that point no longer exists.
  initialAnchor?: string | null
  // Called as the reader moves, with an anchor like "s2:3" (scene s2, block 3).
  onPosition?: (anchor: string) => void
  onClose: () => void
  closeLabel?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [state, setState] = useState<PlayState>('idle')
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [enlarged, setEnlarged] = useState<Picture | null>(null)
  // Pictures the reader has already been shown, so auto-scroll doesn't stop at them again.
  const seenPictures = useRef(new Set<string>())
  // The manual-scroll listener reads the current state without re-subscribing on every change.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const dark = prefs.theme === 'dark'

  function updatePrefs(next: Partial<Prefs>) {
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    savePrefs(merged)
  }

  const blocks = useMemo(
    () =>
      scenes.map((scene) => ({
        scene,
        paragraphs: paragraphsOf(scene.text),
      })),
    [scenes],
  )

  // Everything above the reading line counts as seen when the reader starts or resumes.
  const markPicturesAboveLineSeen = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const line = el.getBoundingClientRect().top + el.clientHeight * READING_LINE
    el.querySelectorAll<HTMLElement>('[data-picture]').forEach((pic) => {
      if (pic.getBoundingClientRect().top <= line + 1) seenPictures.current.add(pic.dataset.anchor!)
    })
  }, [])

  // Auto-scroll loop.
  useEffect(() => {
    if (state !== 'playing') return
    const el = scrollRef.current
    if (!el) return
    let frame = 0
    let last = performance.now()
    let carry = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      carry += SPEEDS[prefs.speed] * dt
      const step = Math.floor(carry)
      if (step >= 1) {
        el.scrollTop += step
        carry -= step
      }
      // Stop at the next picture so the reader can look before going on.
      const line = el.getBoundingClientRect().top + el.clientHeight * READING_LINE
      for (const pic of el.querySelectorAll<HTMLElement>('[data-picture]')) {
        const anchor = pic.dataset.anchor!
        if (seenPictures.current.has(anchor)) continue
        const rect = pic.getBoundingClientRect()
        if (rect.top <= line && rect.bottom > el.getBoundingClientRect().top) {
          seenPictures.current.add(anchor)
          setWaitingFor(anchor)
          setState('waiting')
          return
        }
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setState('finished')
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state, prefs.speed])

  // Any manual scrolling pauses auto-scroll, so the page never moves against the reader.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pauseForReader = () => {
      if (stateRef.current === 'playing') {
        setState('paused')
        setNotice('Paused because you scrolled. Resume when you’re ready.')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) pauseForReader()
    }
    // Pressing on the scrollbar targets the scroll container itself.
    const onPointer = (e: PointerEvent) => e.target === el && pauseForReader()
    el.addEventListener('wheel', pauseForReader, { passive: true })
    el.addEventListener('touchmove', pauseForReader, { passive: true })
    el.addEventListener('keydown', onKey)
    el.addEventListener('pointerdown', onPointer)
    return () => {
      el.removeEventListener('wheel', pauseForReader)
      el.removeEventListener('touchmove', pauseForReader)
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  // Track the paragraph or picture at the reading line, and overall progress.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? el.scrollTop / max : 1)
      const line = el.getBoundingClientRect().top + el.clientHeight * READING_LINE
      let current: string | null = null
      for (const node of el.querySelectorAll<HTMLElement>('[data-anchor]')) {
        if (node.getBoundingClientRect().top <= line) current = node.dataset.anchor!
        else break
      }
      setActive((prev) => (prev === current ? prev : current))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [blocks, prefs.size])

  // Report the position, at most every second and a half.
  useEffect(() => {
    if (!active || !onPosition) return
    const timer = setTimeout(() => onPosition(active), 1500)
    return () => clearTimeout(timer)
  }, [active, onPosition])

  // Return to a saved position once, on open.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !initialAnchor) return
    restored.current = true
    const el = scrollRef.current
    const target = el?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(initialAnchor)}"]`)
    if (!el || !target || target === el.querySelector('[data-anchor]')) return
    el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight * READING_LINE + 4
    markPicturesAboveLineSeen()
    setNotice('Picked up where you left off.')
  }, [initialAnchor, markPicturesAboveLineSeen])

  const scrollToTop = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    seenPictures.current.clear()
    setState('idle')
    setNotice(null)
  }

  // With reduced motion there's no continuous scrolling: "Next" jumps to the next paragraph.
  const stepForward = () => {
    const el = scrollRef.current
    if (!el) return
    const line = el.getBoundingClientRect().top + el.clientHeight * READING_LINE
    const next = [...el.querySelectorAll<HTMLElement>('[data-anchor]')].find(
      (node) => node.getBoundingClientRect().top > line + 4,
    )
    if (!next) {
      setState('finished')
      return
    }
    el.scrollTop += next.getBoundingClientRect().top - line
  }

  const play = () => {
    setNotice(null)
    setWaitingFor(null)
    markPicturesAboveLineSeen()
    setState('playing')
  }

  const toggle = () => {
    if (reducedMotion) return stepForward()
    if (state === 'playing') return setState('paused')
    if (state === 'finished') {
      scrollToTop()
      return
    }
    play()
  }

  // Space plays and pauses, like other media; Escape leaves reading mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (enlarged) return
      const target = e.target as HTMLElement
      if (target.closest('button, input, select, textarea, a')) return
      if (e.key === ' ') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Keep the page behind from scrolling while reading mode is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    scrollRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const mainLabel = reducedMotion
    ? state === 'finished'
      ? 'The end'
      : 'Next'
    : state === 'playing'
      ? 'Pause'
      : state === 'paused'
        ? 'Resume'
        : state === 'waiting'
          ? 'Continue reading'
          : state === 'finished'
            ? 'Read again'
            : 'Start'

  const textClass = dark ? 'text-stone-50' : 'text-stone-950'
  const quiet = dark ? 'text-stone-400' : 'text-stone-600'
  // The light page is ivory paper; illustrations are multiplied onto it, so their white paper turns
  // ivory with no visible edge.
  const surface = dark ? 'bg-stone-950' : 'bg-paper'
  const bar = dark ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-paper'
  const chip = dark
    ? 'border-stone-700 text-stone-100 hover:bg-stone-800'
    : 'border-stone-300 text-stone-900 hover:bg-stone-100'

  const dimmed = (anchor: string) =>
    // The current paragraph is full strength; the rest stay readable but quieter.
    active !== null && active !== anchor && state !== 'idle' ? 'opacity-55' : 'opacity-100'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${title}`}
      className={`fixed inset-0 z-50 flex flex-col ${surface} ${textClass}`}
    >
      <header className={`flex shrink-0 items-center gap-3 border-b px-4 py-2.5 ${bar}`}>
        <p className={`min-w-0 flex-1 truncate text-sm font-medium ${quiet}`}>{title}</p>
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className={`h-1.5 w-16 shrink-0 overflow-hidden rounded-full sm:w-32 ${dark ? 'bg-stone-800' : 'bg-stone-200'}`}
        >
          <div className="h-full bg-orange-500" style={{ width: `${progress * 100}%` }} />
        </div>
        {/* Top right, where a close button is expected. Escape closes too. */}
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 text-sm font-semibold ${
            dark ? 'bg-white text-stone-900 hover:bg-stone-200' : 'bg-stone-900 text-white hover:bg-stone-700'
          }`}
        >
          <CloseIcon className="h-4 w-4" />
          {closeLabel}
        </button>
      </header>

      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Story text"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
      >
        <div className="mx-auto max-w-3xl px-6 pb-[60vh] pt-[18vh] sm:px-10">
          <h1 className="font-serif text-4xl font-bold leading-tight sm:text-6xl">{title}</h1>
          <p className={`mt-3 text-lg ${quiet}`}>{byline(author)}</p>

          {blocks.map(({ scene, paragraphs }, sceneIndex) => {
              const figures = scene.illustrations.map((ill, i) => {
                if (!ill.url) return null
                const anchor = `${scene.id}:p${i}`
                const waiting = waitingFor === anchor && state === 'waiting'
                const picture = { url: ill.url, alt: ill.alt, credit: ill.credit }
                return (
                    <figure key={anchor} data-anchor={anchor} data-picture className="mb-12">
                      <Illustration
                        picture={picture}
                        maxHeight="60vh"
                        start="start"
                        pan={waiting}
                        onOpen={() => {
                          if (state === 'playing') setState('paused')
                          setEnlarged(picture)
                        }}
                        highlight={waiting}
                        multiply={!dark}
                        className="focus-visible:outline-4 focus-visible:outline-orange-500"
                      />
                      <figcaption className={`mt-3 text-base ${quiet}`}>
                        {ill.credit ? `Illustration: ${ill.credit}` : ill.alt}
                      </figcaption>
                      {waiting && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => setEnlarged(picture)}
                            className={`rounded-full border px-5 py-2.5 font-semibold ${chip}`}
                          >
                            View larger
                          </button>
                          <button
                            type="button"
                            onClick={play}
                            className="rounded-full bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-500"
                          >
                            Continue reading
                          </button>
                        </div>
                      )}
                    </figure>
                  )
                })
              return (
              <section key={scene.id} aria-label={`Scene ${sceneIndex + 1}`} className="mt-16">
                {sceneIndex > 0 && (
                  <div aria-hidden className={`mb-16 text-center text-2xl ${quiet}`}>
                    ✦
                  </div>
                )}
                {/* The story opens with its first picture, above the first paragraph. */}
                {sceneIndex === 0 && figures[0]}
                {paragraphs.map((text, i) => {
                  const anchor = `${scene.id}:${i}`
                  return (
                    <p
                      key={anchor}
                      data-anchor={anchor}
                      className={`mb-10 whitespace-pre-line font-semibold leading-[1.45] tracking-tight transition-opacity duration-500 motion-reduce:transition-none ${
                        SIZES[prefs.size]
                      } ${dimmed(anchor)}`}
                    >
                      {text}
                    </p>
                  )
                })}
                {sceneIndex === 0 ? figures.slice(1) : figures}
              </section>
            )
          })}

          <div className="mt-20 text-center">
            <p className="font-serif text-3xl font-semibold">The end</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={scrollToTop} className={`rounded-full border px-5 py-2.5 font-semibold ${chip}`}>
                Read again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-500"
              >
                {closeLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls sit below the text area, so they never cover the story. */}
      <footer className={`shrink-0 border-t px-4 ${dark ? '' : 'shadow-[0_-2px_8px_rgba(0,0,0,0.04)]'} pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${bar}`}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={reducedMotion && state === 'finished'}
            className="min-w-32 rounded-full bg-orange-600 px-6 py-3 text-lg font-bold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {mainLabel}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {!reducedMotion && (
              <Stepper
                label="Speed"
                value={SPEED_LABELS[prefs.speed]}
                onLess={() => updatePrefs({ speed: Math.max(0, prefs.speed - 1) })}
                onMore={() => updatePrefs({ speed: Math.min(SPEEDS.length - 1, prefs.speed + 1) })}
                canLess={prefs.speed > 0}
                canMore={prefs.speed < SPEEDS.length - 1}
                chip={chip}
                lessText="Slower"
                moreText="Faster"
              />
            )}
            <Stepper
              label="Text size"
              value={<span aria-hidden>Aa</span>}
              onLess={() => updatePrefs({ size: Math.max(0, prefs.size - 1) })}
              onMore={() => updatePrefs({ size: Math.min(SIZES.length - 1, prefs.size + 1) })}
              canLess={prefs.size > 0}
              canMore={prefs.size < SIZES.length - 1}
              chip={chip}
              lessText="Smaller text"
              moreText="Larger text"
            />
            <button
              type="button"
              onClick={() => updatePrefs({ theme: dark ? 'light' : 'dark' })}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium ${chip}`}
            >
              {dark ? 'Light page' : 'Dark page'}
            </button>
          </div>
        </div>
        <p role="status" aria-live="polite" className={`mx-auto mt-2 max-w-3xl text-sm ${quiet} empty:hidden`}>
          {state === 'waiting'
            ? 'Stopped at a picture. Take a look, then continue when you’re ready.'
            : (notice ?? (reducedMotion && state === 'idle' ? 'Automatic scrolling is off because your device prefers reduced motion. Use Next or scroll yourself.' : ''))}
          {notice === 'Picked up where you left off.' && state !== 'waiting' && (
            <button type="button" onClick={scrollToTop} className="ml-2 font-semibold underline">
              Start from the beginning
            </button>
          )}
        </p>
      </footer>

      <Lightbox picture={enlarged} onClose={() => setEnlarged(null)} />
    </div>
  )
}

function Stepper({
  label,
  value,
  onLess,
  onMore,
  canLess,
  canMore,
  chip,
  lessText,
  moreText,
}: {
  label: string
  value: ReactNode
  onLess: () => void
  onMore: () => void
  canLess: boolean
  canMore: boolean
  chip: string
  lessText: string
  moreText: string
}) {
  return (
    <div role="group" aria-label={label} className={`flex items-center rounded-full border ${chip}`}>
      <button type="button" onClick={onLess} disabled={!canLess} aria-label={lessText} className="px-3 py-2 text-lg leading-none disabled:opacity-30">
        −
      </button>
      <span className="min-w-16 text-center text-sm font-medium" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={onMore} disabled={!canMore} aria-label={moreText} className="px-3 py-2 text-lg leading-none disabled:opacity-30">
        +
      </button>
    </div>
  )
}
