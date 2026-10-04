import { useEffect, useRef } from 'react'

export type Picture = { url: string; alt: string; credit?: string }

// A picture shown large. Uses <dialog>, which traps focus and closes on Escape.
export function Lightbox({ picture, onClose }: { picture: Picture | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (picture && !dialog.open) dialog.showModal()
    if (!picture && dialog.open) dialog.close()
  }, [picture])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={picture?.alt ?? 'Picture'}
      className="m-auto max-h-none max-w-none bg-transparent p-4 backdrop:bg-black/85"
    >
      {picture && (
        <figure className="flex max-w-[min(64rem,92vw)] flex-col items-center">
          <img src={picture.url} alt={picture.alt} className="max-h-[78vh] w-auto rounded-xl object-contain" />
          <figcaption className="mt-3 max-w-2xl text-center text-white">
            <span className="block text-lg">{picture.alt}</span>
            {picture.credit && <span className="mt-1 block text-sm text-white/70">Illustration: {picture.credit}</span>}
          </figcaption>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-4 rounded-full bg-white px-6 py-2.5 font-semibold text-stone-900"
          >
            Close
          </button>
        </figure>
      )}
    </dialog>
  )
}
