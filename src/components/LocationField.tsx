import { useId, useState } from 'react'
import { useHere } from '../here'
import { draftFromPlace, locationProblem, PRECISION_OPTIONS, zoomFor, type LocationDraft, type Precision } from '../location'
import { PlaceSearch } from './PlaceSearch'
import { LocationMap, type LatLng, type MapFocus } from './StoryMap'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'
const linkButton = 'text-sm font-medium text-stone-600 underline hover:text-stone-900'

// Where the story is connected to. Authors search for a place, or choose it on the map and name it
// themselves when search can't find it. Either way the name, pin, and precision stay editable.
export function LocationField({
  value,
  onChange,
}: {
  value: LocationDraft | null
  onChange: (value: LocationDraft | null) => void
}) {
  const inputId = useId()
  const nameId = useId()
  const townSearchId = useId()
  const here = useHere()
  const [adjusting, setAdjusting] = useState(false)
  // "Choose it on the map": no pin yet, the author is finding the spot.
  const [choosing, setChoosing] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [focus, setFocus] = useState<MapFocus | null>(null)

  function clear() {
    onChange(null)
    setAdjusting(false)
    setChoosing(false)
    setPendingName('')
    setFocus(null)
  }

  function startChoosing(typed: string) {
    setPendingName(typed)
    setChoosing(true)
    // Start near the reader if they've shared their location; otherwise the whole world.
    setFocus(here.position ? { key: 'here', center: here.position, zoom: 10 } : null)
  }

  // The first click on the map places the pin; the author can keep clicking to move it.
  function placePin({ lat, lng }: LatLng) {
    onChange({
      key: `manual-${lat},${lng}`,
      place: pendingName.trim(),
      lat,
      lng,
      // A hand-placed pin is approximate until the author says it's exact.
      precision: 'area',
      pointLike: false,
      adjusted: true,
    })
    setChoosing(false)
    setAdjusting(true)
  }

  function movePin({ lat, lng }: LatLng) {
    if (value) onChange({ ...value, lat, lng, adjusted: true })
  }

  function setPrecision(precision: Precision) {
    if (!value) return
    onChange({ ...value, precision })
    // An exact location needs a hand-placed pin unless the result is already a specific spot.
    if (precision === 'exact' && !value.pointLike && !value.adjusted) setAdjusting(true)
  }

  const problem = locationProblem(value)
  const showMap = value !== null || choosing

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">
        Where is this story connected to? <span className="font-normal text-stone-500">(optional)</span>
      </legend>

      {!showMap && (
        <>
          <p className="mb-2 text-sm text-stone-500">
            A town, landmark, castle, cave, mountain, or region. It doesn't have to be where every event happened.
          </p>
          <label htmlFor={inputId} className="sr-only">
            Search for a place
          </label>
          <PlaceSearch
            inputId={inputId}
            onSelect={(place) => {
              const draft = draftFromPlace(place)
              onChange(draft)
              setFocus({ key: place.id, center: place, bbox: place.bbox, zoom: zoomFor(draft.precision) })
              setAdjusting(false)
            }}
            onManual={startChoosing}
          />
        </>
      )}

      {showMap && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <label htmlFor={nameId} className="min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">Place name shown to readers</span>
              <input
                id={nameId}
                className={inputClass}
                value={value ? value.place : pendingName}
                onChange={(e) => (value ? onChange({ ...value, place: e.target.value }) : setPendingName(e.target.value))}
                maxLength={120}
                placeholder="e.g. Su Sterru, Golgo Plateau"
              />
            </label>
            <button type="button" onClick={clear} className={`${linkButton} pb-2`}>
              {value ? 'Change or remove' : 'Back to search'}
            </button>
          </div>
          {value && !value.place.trim() && (
            <p className="text-sm text-amber-700">Add a name so readers know what this place is.</p>
          )}

          {choosing && (
            <div className="space-y-2 rounded-lg bg-stone-50 p-3">
              <label htmlFor={townSearchId} className="block text-sm text-stone-600">
                Move the map to a nearby town or landmark (optional):
              </label>
              <PlaceSearch
                inputId={townSearchId}
                placeholder="e.g. Baunei"
                onSelect={(place) =>
                  setFocus({ key: place.id, center: place, bbox: place.bbox, zoom: place.pointLike ? 15 : 12 })
                }
              />
              <p className="text-sm font-medium text-stone-800">Then zoom in and click the map where the place is.</p>
            </div>
          )}

          <LocationMap
            value={value}
            precision={value?.precision}
            focus={focus}
            onPick={choosing ? placePin : adjusting ? movePin : undefined}
            className="h-72"
          />

          {value &&
            (adjusting ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-600">Click the map to move the pin. Zoom in for more detail.</p>
                <button
                  type="button"
                  onClick={() => setAdjusting(false)}
                  className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium hover:bg-stone-100"
                >
                  Done
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAdjusting(true)} className={linkButton}>
                Adjust location on map
              </button>
            ))}

          {value && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">How precise is this pin?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PRECISION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 ${
                      value.precision === opt.value ? 'border-stone-900 bg-stone-50' : 'border-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${inputId}-precision`}
                      value={opt.value}
                      checked={value.precision === opt.value}
                      onChange={() => setPrecision(opt.value)}
                      className="mt-0.5 accent-stone-900"
                    />
                    <span>
                      <span className="block font-medium">{opt.label}</span>
                      <span className="block text-stone-500">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {problem && <p className="text-sm text-amber-700">{problem}</p>}
        </div>
      )}
    </fieldset>
  )
}
