import type { CSSProperties } from 'react'
import logoSvg from '../assets/logo.svg?raw'

// The welcome screen's logo, whose eye (in the last "e" of "More") now and then looks left and right.
// It's drawn from src/assets/logo.svg itself, read as text, so the artwork lives in one file and is
// never redrawn: the file's single shape is split into its pieces, the pupil (a small circle inside the
// eye) becomes a shape of its own, and everything else stays one shape. With the logo's fill rule this
// looks exactly like the file. Only the pupil moves (`.logo-pupil` in index.css); everywhere else the
// logo is the plain file, and with reduced motion it doesn't move at all.

const viewBox = logoSvg.match(/viewBox="([^"]+)"/)?.[1]
const width = logoSvg.match(/\swidth="([^"]+)"/)?.[1]
const height = logoSvg.match(/\sheight="([^"]+)"/)?.[1]
const fill = logoSvg.match(/\sfill="([^"]+)"/)?.[1]
const fillRule = logoSvg.match(/fill-rule="([^"]+)"/)?.[1] as 'nonzero' | 'evenodd' | undefined
const pieces = logoSvg.match(/\sd="([^"]+)"/)?.[1].match(/M[^M]*/g)?.map((piece) => piece.trim()) ?? []

// The pupil: of the small pieces (under 40 units across), the one furthest right.
function bounds(piece: string) {
  const numbers = piece.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const xs = numbers.filter((_, i) => i % 2 === 0)
  return { left: Math.min(...xs), right: Math.max(...xs) }
}
const pupil = pieces
  .map((piece, index) => ({ index, ...bounds(piece) }))
  .filter((p) => p.right - p.left < 40)
  .sort((a, b) => b.left - a.left)[0]?.index

export function WelcomeLogo({ className, style }: { className?: string; style?: CSSProperties }) {
  if (!viewBox || !fill || pupil === undefined) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      role="img"
      aria-label="Lore-a-More"
      className={className}
      style={style}
    >
      <path fill={fill} fillRule={fillRule} d={pieces.filter((_, i) => i !== pupil).join(' ')} />
      <path className="logo-pupil" fill={fill} fillRule={fillRule} d={pieces[pupil]} />
    </svg>
  )
}
