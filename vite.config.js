import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import resolveSongHandler from './api/resolve-song.js'
import roundPlaylistsHandler from './api/round-playlists.js'

// Vercel runs api/ as serverless functions. The dev server mounts the same handlers
// so they work locally, with Vercel's req.body, res.status() and res.json() shims.
const API_ROUTES = {
  '/api/resolve-song': resolveSongHandler,
  '/api/round-playlists': roundPlaylistsHandler,
}

function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      // Handlers read settings from process.env, as they do on Vercel.
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value

      for (const [path, handler] of Object.entries(API_ROUTES)) {
        server.middlewares.use(path, (req, res, next) => {
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
            await handler(req, res)
          })
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
