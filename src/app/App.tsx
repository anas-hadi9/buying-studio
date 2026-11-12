import { Tooltip } from 'radix-ui'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { Spinner } from '@/components/ui/primitives'
import { LibraryPage } from '@/features/library/LibraryPage'
import { resolveTheme, usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'
import { AppShell } from './layout/AppShell'

// The catalogue and board (virtualisation, drag-and-drop) load on first visit.
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const CollectionPage = lazy(() => import('@/features/collections/CollectionPage').then((m) => ({ default: m.CollectionPage })))

function PageFallback() {
  return (
    <div className="grid h-full place-items-center">
      <Spinner className="size-5 text-muted" />
    </div>
  )
}

function useThemeSync() {
  const theme = usePreferences((s) => s.theme)
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
    apply()
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return resolveTheme(theme)
}

export function App() {
  const theme = useThemeSync()
  const loadSettings = useSettings((s) => s.load)
  useEffect(() => void loadSettings(), [loadSettings])

  return (
    <Tooltip.Provider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LibraryPage />} />
            <Route
              path="l/:lineListId"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CatalogPage />
                </Suspense>
              }
            />
            <Route
              path="l/:lineListId/c/:collectionId"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CollectionPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme={theme} position="bottom-right" toastOptions={{ className: 'font-sans' }} />
    </Tooltip.Provider>
  )
}
