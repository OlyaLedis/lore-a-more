import { useId, useState } from 'react'
import { draftFromPlace, locationProblem, PRECISION_OPTIONS, type LocationDraft, type Precision } from '../location'
import { PlaceSearch } from './PlaceSearch'
import { LocationMap, type LatLng } from './StoryMap'

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-stone-900 focus:outline-none'
const linkButton = 'text-sm font-medium text-stone-600 underline hover:text-stone-900'

export function LocationField({
  value,
  onChange,
}: {
  value: LocationDraft | null
  onChange: (value: LocationDraft | null) => void
}) {
  const inputId = useId()
  const [adjusting, setAdjusting] = useState(false)
  // Manual fallback: the search couldn't find the place, so the user marks it on a world map.
  const [manualName, setManualName] = useState<string | null>(null)

  function clear() {
    onChange(null)
    setAdjusting(false)
    setManualName(null)
  }

  function movePin({ lat, lng }: LatLng) {
    if (value) onChange({ ...value, lat, lng, adjusted: true })
  }

  function setPrecision(precision: Precision) {
    if (!value) return
    onChange({ ...value, precision })
    // An exact site needs a hand-placed pin unless the result is already a specific spot.
    if (precision === 'exact' && !value.pointLike && !value.adjusted) setAdjusting(true)
  }

  const problem = locationProblem(value)

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">
        Where is this story connected to? <span className="font-normal text-stone-500">(optional)</span>
      </legend>

      {!value && manualName === null && (
        <>
          <p className="mb-2 text-sm text-stone-500">
            A town, landmark, mountain, or region. It doesn't have to be where every event happened.
          </p>
          <label htmlFor={inputId} className="sr-only">
            Search for a place
          </label>
          <PlaceSearch
            inputId={inputId}
            onSelect={(place) => {
              onChange(draftFromPlace(place))
              setAdjusting(false)
            }}
            onManual={(typed) => setManualName(typed)}
          />
        </>
      )}

      {!value && manualName !== null && (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm text-stone-600">Place name</span>
            <input
              className={inputClass}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              maxLength={120}
              placeholder="e.g. the old mill by the river"
            />
          </label>
          <p className="text-sm text-stone-500">Zoom in and click the map where the place is.</p>
          <LocationMap
            value={null}
            className="h-72"
            onPick={({ lat, lng }) =>
              onChange({
                key: `manual-${lat},${lng}`,
                place: manualName.trim(),
                lat,
                lng,
                precision: 'area',
                pointLike: false,
                adjusted: true,
              })
            }
          />
          <button type="button" onClick={clear} className={linkButton}>
            Back to search
          </button>
        </div>
      )}

      {value && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <p className="font-medium">{value.place || 'Unnamed place'}</p>
            <button type="button" onClick={clear} className={linkButton}>
              Change or remove
            </button>
          </div>

          <LocationMap
            value={value}
            precision={value.precision}
            bbox={value.adjusted ? undefined : value.bbox}
            viewKey={value.key}
            onPick={adjusting ? movePin : undefined}
          />

          {adjusting ? (
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
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">How precise is this location?</legend>
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

          {problem && <p className="text-sm text-amber-700">{problem}</p>}
        </div>
      )}
    </fieldset>
  )
}
