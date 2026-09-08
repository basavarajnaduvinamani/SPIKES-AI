import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PageShimmer } from './components/loaders/PageShimmer'
import { DataUploadPage } from './pages/DataUploadPage'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const CgmPage = lazy(() => import('./pages/CgmPage').then((m) => ({ default: m.CgmPage })))
const PatientOverviewPage = lazy(() =>
  import('./pages/PatientOverviewPage').then((m) => ({ default: m.PatientOverviewPage })),
)
const LifestylePillarsPage = lazy(() =>
  import('./pages/LifestylePillarsPage').then((m) => ({ default: m.LifestylePillarsPage })),
)

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route
            index
            element={
              <Suspense fallback={<PageShimmer label="Loading dashboard…" variant="home" />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route path="upload" element={<DataUploadPage />} />
          <Route
            path="cgm"
            element={
              <Suspense fallback={<PageShimmer label="Loading CGM analysis…" variant="cgm" />}>
                <CgmPage />
              </Suspense>
            }
          />
          <Route
            path="overview"
            element={
              <Suspense
                fallback={<PageShimmer label="Loading patient overview…" variant="overview" />}
              >
                <PatientOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="pillars"
            element={
              <Suspense
                fallback={<PageShimmer label="Loading lifestyle pillars…" variant="pillars" />}
              >
                <LifestylePillarsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
