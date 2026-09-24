import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { Link, Route, Routes } from 'react-router-dom'
import { api } from '../convex/_generated/api'
import { RequireAdmin, RequireAuth } from './components/RequireAuth'
import Feed from './pages/Feed'
import MyStories from './pages/MyStories'
import Review from './pages/Review'
import SignIn from './pages/SignIn'
import StoryPage from './pages/StoryPage'
import Submit from './pages/Submit'

export default function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <nav className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
            Olga
          </Link>
          <NavLinks />
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/story/:id" element={<StoryPage />} />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <Submit />
              </RequireAuth>
            }
          />
          <Route
            path="/mine"
            element={
              <RequireAuth>
                <MyStories />
              </RequireAuth>
            }
          />
          <Route
            path="/review"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <Review />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route path="*" element={<p className="text-stone-500">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  )
}

function NavLinks() {
  const me = useQuery(api.users.me)
  const { signOut } = useAuthActions()

  if (me === undefined) return null

  if (me === null) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link to="/signin" className="text-stone-600 hover:text-stone-900">
          Sign in
        </Link>
        <Link
          to="/new"
          className="rounded-full bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-700"
        >
          Write a story
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      {me.isAdmin && (
        <Link to="/review" className="text-stone-600 hover:text-stone-900">
          Review
        </Link>
      )}
      <Link to="/mine" className="text-stone-600 hover:text-stone-900">
        My stories
      </Link>
      <button onClick={() => void signOut()} className="text-stone-600 hover:text-stone-900">
        Sign out
      </button>
      <Link
        to="/new"
        className="rounded-full bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-700"
      >
        Write a story
      </Link>
    </div>
  )
}
