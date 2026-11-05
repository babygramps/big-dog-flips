import React from 'react'
import ReactDOM from 'react-dom/client'
const App = React.lazy(() => {
  if (import.meta.env.DEV && window.location.pathname.startsWith('/__preview')) {
    return import('./dev/previewDatabase.js').then(({ installPreviewDatabase }) => {
      installPreviewDatabase()
      return import('./dev/SitePreview.jsx')
    })
  }
  return import('./App.jsx')
})
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<p>Loading Big Dog Flips…</p>}><App /></React.Suspense>
  </React.StrictMode>
)
