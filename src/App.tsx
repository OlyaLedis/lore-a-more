import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { RequireAdmin, RequireAuth } from './components/RequireAuth'
import Account from './pages/Account'
import Feed from './pages/Feed'
import Home from './pages/Home'
import Library from './pages/Library'
import MapPage from './pages/MapPage'
import MyStories from './pages/MyStories'
import Review from './pages/Review'
import Search from './pages/Search'
import SignIn from './pages/SignIn'
import StoryPage from './pages/StoryPage'
import Submit, { EditStory } from './pages/Submit'

// Reading and form pages keep a comfortable line length inside the wider discovery layout.
function Narrow({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl">{children}</div>
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<Feed />} />
        <Route path="/library" element={<Library />} />
        <Route path="/search" element={<Search />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/signin" element={<Narrow><SignIn /></Narrow>} />
        <Route path="/story/:id" element={<Narrow><StoryPage /></Narrow>} />
        <Route
          path="/write"
          element={
            <RequireAuth>
              <Narrow>
                <Submit />
              </Narrow>
            </RequireAuth>
          }
        />
        <Route
          path="/story/:id/edit"
          element={
            <RequireAuth>
              <Narrow>
                <EditStory />
              </Narrow>
            </RequireAuth>
          }
        />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="/mine"
          element={
            <RequireAuth>
              <Narrow>
                <MyStories />
              </Narrow>
            </RequireAuth>
          }
        />
        <Route
          path="/review"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Narrow>
                  <Review />
                </Narrow>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route path="*" element={<p className="text-stone-500">Page not found.</p>} />
      </Routes>
    </AppShell>
  )
}
