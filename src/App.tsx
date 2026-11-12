import { lazy, Suspense, type ReactNode } from 'react'
import { createHashRouter, createRoutesFromElements, Navigate, Route, RouterProvider, useLocation } from 'react-router-dom'
import { AppProvider, useStore } from './store/AppStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { Skeleton } from './components/ui'
import ErrorBoundary from './components/ErrorBoundary'

const Overview = lazy(() => import('./pages/Overview'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'))
const Channels = lazy(() => import('./pages/Channels'))
const Funnel = lazy(() => import('./pages/Funnel'))
const Financial = lazy(() => import('./pages/Financial'))
const Performance = lazy(() => import('./pages/Performance'))
const Insights = lazy(() => import('./pages/Insights'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Automation = lazy(() => import('./pages/Automation'))
const Builder = lazy(() => import('./pages/Builder'))
const DataImport = lazy(() => import('./pages/DataImport'))
const SettingsPage = lazy(() => import('./pages/Settings'))

function Guard({ children }: { children: ReactNode }) {
  const { user } = useStore()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}

const page = (el: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageFallback />}>{el}</Suspense>
  </ErrorBoundary>
)

const router = createHashRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={page(<Overview />)} />
        <Route path="campaigns" element={page(<Campaigns />)} />
        <Route path="campaigns/:id" element={page(<CampaignDetail />)} />
        <Route path="channels" element={page(<Channels />)} />
        <Route path="funnel" element={page(<Funnel />)} />
        <Route path="financial" element={page(<Financial />)} />
        <Route path="performance" element={page(<Performance />)} />
        <Route path="insights" element={page(<Insights />)} />
        <Route path="simulator" element={page(<Simulator />)} />
        <Route path="automation" element={page(<Automation />)} />
        <Route path="automation/workflows/:id" element={page(<Builder />)} />
        <Route path="import" element={page(<DataImport />)} />
        <Route path="settings" element={page(<SettingsPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </>,
  ),
)

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  )
}
