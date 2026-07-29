import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './prism-theme.css'
import App from './App.jsx'

// Bugsink (self-hosted, Sentry-ingestion-API-compatible) error tracking, in every
// environment — dev crashes are just as worth catching as prod ones.
Sentry.init({
  dsn: 'https://55095efb34ee4a259b4a949206379cdb@mpeters.bugsink.com/1',
  environment: import.meta.env.MODE,
})

function ErrorFallback({ error }) {
  return (
    <div className="mx-auto max-w-2xl p-6 text-left text-zinc-900 dark:text-zinc-100">
      <h1 className="mb-2 text-lg font-semibold">Something went wrong.</h1>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        The error was reported. Reloading the page is the quickest way to recover.
      </p>
      <pre className="overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950">
        {String(error?.message || error)}
      </pre>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} onError={(error) => console.error('Uncaught render error:', error)}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
