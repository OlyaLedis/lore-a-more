import { useQuery } from 'convex/react'
import { Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { BaseMap, StoryPin } from '../components/StoryMap'
import { byline } from '../format'
import { precisionNote } from '../location'

export default function MapPage() {
  const stories = useQuery(api.stories.mapped)

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Story map</h1>
      <p className="mt-1 text-stone-500">
        {stories === undefined
          ? 'Loading…'
          : stories.length === 0
            ? 'No stories have a location yet.'
            : 'Click a pin to read the story told there.'}
      </p>
      <div className="mt-6">
        <BaseMap className="h-[32rem]">
          {stories?.map((story) => (
            <StoryPin key={story._id} center={story.location} precision={story.location.precision}>
              <Popup>
                <Link to={`/story/${story._id}`} className="font-serif text-base font-semibold">
                  {story.title}
                </Link>
                <br />
                <span className="text-stone-500">
                  {byline(story.author)}
                  {story.location.place && ` · ${story.location.place}`}
                </span>
                {precisionNote(story.location.precision) && (
                  <>
                    <br />
                    <span className="text-xs text-stone-500">{precisionNote(story.location.precision)}</span>
                  </>
                )}
              </Popup>
            </StoryPin>
          ))}
        </BaseMap>
      </div>
    </div>
  )
}
