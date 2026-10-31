import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Picture } from './Lightbox'

// A story's picture. Most fit the column, as before. A wide picture (a panorama) that would look small
// squeezed to the column's width is shown tall instead, running off the sides, and the reader swipes
// (or uses the arrow buttons, where there's a mouse) to look along it. It decides by the picture's
// shape and the room it has, so nothing is stored: on a wide screen the same picture may simply fit.
// Tapping it opens the whole picture in the lightbox either way.

// At least this wide for its height to count as a panorama, and at least this much wider than the
// column at its panorama height, or it just fits.
const PANORAMA_RATIO = 1.4
const OVERFLOW = 1.4
// A panorama's height is at most this times the column's width, so on a phone it's a little taller than
// square and shows about half of the picture at a time.
const HEIGHT_PER_WIDTH = 1.1
// The slow look along it in reading mode, in pixels per second, within these bounds.
const PAN_SPEED = 70
const PAN_SECONDS = [4, 12] as const
// Outside the panorama's scrolling box, which would clip it.
const RING = 'rounded-2xl ring-4 ring-orange-500 ring-offset-4 ring-offset-transparent'

export function Illustration({
  picture,
  maxHeight,
  start = 'center',
  pan = false,
  onOpen,
  highlight = false,
  className = '',
}: {
  picture: Picture
  // The tallest a picture may be, as a CSS length ("28rem", "60vh").
  maxHeight: string
  // Where a panorama starts: its middle (the story page) or its left edge (reading mode, which then pans).
  start?: 'center' | 'start'
  // Reading mode: look along the panorama once, slowly. Any touch, wheel, or button stops it.
  pan?: boolean
  onOpen: () => void
  // Reading mode's ring around the picture it stopped at.
  highlight?: boolean
  // For the button around the picture (its focus ring).
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState<number | null>(null)
  const [room, setRoom] = useState<{ width: number; maxHeight: number } | null>(null)
  const [ends, setEnds] = useState({ atStart: true, atEnd: false })
  const [looked, setLooked] = useState(false)
  const panning = useRef<number | null>(null)

  // The column's width, and the CSS max height in pixels, kept up to date as the window changes.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const probe = document.createElement('div')
      probe.style.cssText = `position:absolute;visibility:hidden;height:${maxHeight}`
      el.appendChild(probe)
      setRoom({ width: el.clientWidth, maxHeight: probe.offsetHeight })
      probe.remove()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [maxHeight])

  const height = room && Math.min(room.maxHeight, room.width * HEIGHT_PER_WIDTH)
  const panorama =
    ratio !== null && room !== null && height !== null && ratio >= PANORAMA_RATIO && height * ratio > room.width * OVERFLOW

  const updateEnds = () => {
    const el = scroller.current
    if (!el) return
    setEnds({ atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 })
  }

  // Open a panorama at its middle or its left edge.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!panorama || !el) return
    el.scrollLeft = start === 'center' ? (el.scrollWidth - el.clientWidth) / 2 : 0
    updateEnds()
  }, [panorama, start, height])

  const stopPanning = () => {
    if (panning.current !== null) cancelAnimationFrame(panning.current)
    panning.current = null
  }

  // Reading mode: from where it is to the right edge, easing in and out.
  useEffect(() => {
    const el = scroller.current
    if (!pan || !panorama || !el) return
    const from = el.scrollLeft
    const distance = el.scrollWidth - el.clientWidth - from
    if (distance <= 0) return
    const duration = Math.min(PAN_SECONDS[1], Math.max(PAN_SECONDS[0], distance / PAN_SPEED)) * 1000
    const began = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration)
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      el.scrollLeft = from + distance * eased
      panning.current = t < 1 ? requestAnimationFrame(step) : null
    }
    panning.current = requestAnimationFrame(step)
    return stopPanning
  }, [pan, panorama])

  // The reader taking over: stop the pan and drop the hint.
  const takeOver = () => {
    stopPanning()
    setLooked(true)
  }

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    takeOver()
    el.scrollBy({ left: direction * el.clientWidth * 0.6, behavior: 'smooth' })
  }

  const image = (
    <img
      src={picture.url}
      alt={picture.alt}
      onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
      draggable={false}
      className={panorama ? 'block h-full w-auto max-w-none' : 'mx-auto w-auto'}
      style={panorama ? undefined : { maxHeight }}
    />
  )

  if (!panorama) {
    return (
      <div ref={box} className={highlight ? RING : undefined}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View larger: ${picture.alt}`}
          className={`block w-full overflow-hidden rounded-2xl ${className}`}
        >
          {image}
        </button>
      </div>
    )
  }

  // The sides fade where there's more to see.
  const fade = 28
  const mask = `linear-gradient(to right, ${ends.atStart ? '#000' : 'transparent'}, #000 ${fade}px, #000 calc(100% - ${fade}px), ${
    ends.atEnd ? '#000' : 'transparent'
  })`

  return (
    <div ref={box} className={`relative ${highlight ? RING : ''}`}>
      <div
        ref={scroller}
        onScroll={updateEnds}
        onPointerDown={takeOver}
        onWheel={takeOver}
        onTouchStart={takeOver}
        className="scrollbar-none overflow-x-auto overscroll-x-contain rounded-2xl"
        style={{ height: height!, maskImage: mask, WebkitMaskImage: mask }}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View larger: ${picture.alt}. A wide picture: scroll sideways to see all of it.`}
          className={`block h-full w-max rounded-2xl ${className}`}
        >
          {image}
        </button>
      </div>

      {/* Phones: a hint until the reader first swipes. With a mouse: arrow buttons instead. */}
      {!looked && !pan && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/70 px-3 py-1 text-sm font-medium whitespace-nowrap text-white [@media(hover:hover)]:hidden"
        >
          ← Swipe to look around →
        </span>
      )}
      {(['start', 'end'] as const).map((side) => {
        const hidden = side === 'start' ? ends.atStart : ends.atEnd
        return (
          <button
            key={side}
            type="button"
            onClick={() => scrollBy(side === 'start' ? -1 : 1)}
            aria-label={side === 'start' ? 'Look left' : 'Look right'}
            tabIndex={hidden ? -1 : 0}
            className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-stone-800 shadow-md ring-1 ring-stone-900/10 transition hover:bg-white [@media(hover:hover)]:flex ${
              side === 'start' ? 'left-3' : 'right-3'
            } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          >
            {side === 'start' ? '‹' : '›'}
          </button>
        )
      })}
    </div>
  )
}
