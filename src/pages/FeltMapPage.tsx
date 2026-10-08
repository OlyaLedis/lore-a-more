import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

// The Felt map (felt.com), embedded to compare with our own Map tab. Its stories come from the file
// uploaded to Felt (scripts/felt-export.ts), so it doesn't update when stories change in the app.
// VITE_FELT_MAP_URL swaps in another Felt embed link.
const FELT_MAP_URL =
  (import.meta.env.VITE_FELT_MAP_URL as string | undefined) ||
  'https://felt.com/embed/map/Untitled-Map-iMiK3IbES5ea2j8eouY9AhC?loc=50.424%2C6.762%2C7.38z&legend=1&cooperativeGestures=1&link=1&geolocation=0&zoomControls=1&scaleBar=1&rotation=1&contextMenu=1'

export default function FeltMapPage() {
  return (
    <div>
      <PageHeader
        title="Map 2"
        hideTitle
        subtitle={
          <>
            The same stories on a Felt map, for comparison.{' '}
            <Link to="/map" className="font-medium text-stone-700 underline-offset-2 hover:underline">
              Back to our map
            </Link>
          </>
        }
      />
      {/* Same size as the Map tab's map, so the two compare side by side. */}
      <iframe
        title="Felt map of StoryPlace stories"
        src={FELT_MAP_URL}
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-[calc(100dvh-15rem)] min-h-80 w-full rounded-lg border border-stone-300 md:h-[36rem]"
      />
    </div>
  )
}
