import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { dotLink, layoutPlaces, type StoryPlace } from '../placesMap'
import { storyPath } from '../storyLinks'

// The illustrator page's banner: a watercolour with a dot at each place their stories happen, each dot
// opening its story (src/placesMap.ts works out where the dots go and what they're called). It measures
// itself so the dots fit at any width; on a phone the dots keep further right, clear of the portrait.
export function PlacesBanner({
  image,
  imageStyle,
  places,
  name,
  className = '',
}: {
  image: string
  imageStyle?: CSSProperties
  places: StoryPlace[]
  name: string
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const narrow = size.width < 520
  const dots = layoutPlaces(places, size, narrow ? { left: 0.42, right: 0.8, top: 0.18, bottom: 0.6 } : { left: 0.3, right: 0.86, top: 0.2, bottom: 0.74 })

  return (
    <div ref={box} className={`relative overflow-hidden bg-stone-200 ${className}`}>
      <img aria-hidden src={image} alt="" style={imageStyle} className="absolute inset-0 h-full w-full object-cover" />
      {/* A soft shade so the white dots and names read on any part of the watercolour. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 to-black/0" />
      {dots.length > 0 && (
        <nav aria-label={`Where ${name}’s stories happen`}>
          <ul>
            {dots.map((dot) => {
              const first = dot.stories[0]
              const titles = dot.stories.map((s) => s.title).join('; ')
              const description =
                dot.stories.length === 1
                  ? `${first.title}, ${first.place}`
                  : `${dot.stories.length} stories${dot.label ? ` in ${dot.label}` : ''}: ${titles}. Show them on the map`
              return (
                <li key={first._id}>
                  <Link
                    to={dotLink(dot, storyPath)}
                    title={description}
                    aria-label={description}
                    style={{ left: dot.x, top: dot.y }}
                    className={`group absolute flex -translate-y-1/2 items-center gap-2 rounded-full text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                      dot.labelLeft ? '-translate-x-[calc(100%-7px)] flex-row-reverse' : '-translate-x-[7px]'
                    }`}
                  >
                    <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full bg-white ring-4 ring-white/35 transition group-hover:ring-8" />
                    {dot.label && <span className="whitespace-nowrap group-hover:underline">{dot.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
