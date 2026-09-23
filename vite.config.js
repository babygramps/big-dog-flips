import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import resolveSongHandler from './api/resolve-song.js'

function songLookupDevServer() {
  return {
    name: 'song-lookup-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/resolve-song', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
          try {
            req.body = JSON.parse(body)
          } catch {
            req.body = {}
          }
          res.status = code => { res.statusCode = code; return res }
          res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) }
          await resolveSongHandler(req, res)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), songLookupDevServer()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
