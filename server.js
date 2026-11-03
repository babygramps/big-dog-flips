import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import resolveSong from './api/resolve-song.js'
import songArtwork from './api/song-artwork.js'
import roundPlaylists from './api/round-playlists.js'

const root = dirname(fileURLToPath(import.meta.url))
const routes = {
  '/api/resolve-song': resolveSong,
  '/api/song-artwork': songArtwork,
  '/api/round-playlists': roundPlaylists,
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

export async function handleRequest(req, res, { distDir = resolve(root, 'dist'), apiRoutes = routes } = {}) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.status = code => { res.statusCode = code; return res }
  res.json = value => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value))
    return res
  }

  try {
    const path = decodeURIComponent((req.url || '/').split('?')[0])
    if (!path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) {
      return res.status(400).json({ error: 'Invalid path.' })
    }
    if (path === '/healthz' && ['GET', 'HEAD'].includes(req.method)) {
      return res.json({ ok: true })
    }
    if (path.startsWith('/api/')) {
      const handler = apiRoutes[path]
      if (!handler) return res.status(404).json({ error: 'API route not found.' })
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk)
        if (size > 65536) return res.status(413).json({ error: 'Request body is too large.' })
        chunks.push(Buffer.from(chunk))
      }
      try {
        req.body = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
      } catch {
        return res.status(400).json({ error: 'Request body must be valid JSON.' })
      }
      return await handler(req, res)
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD')
      return res.status(405).json({ error: 'Use GET or HEAD.' })
    }
    let file = resolve(distDir, `.${path}`)
    if (!file.startsWith(`${resolve(distDir)}${sep}`) && file !== resolve(distDir)) {
      return res.status(400).json({ error: 'Invalid path.' })
    }
    if (path.endsWith('/')) file = resolve(file, 'index.html')
    let body
    try {
      body = await readFile(file)
    } catch (error) {
      if (!['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) throw error
      if (extname(path) || path.startsWith('/assets/')) {
        return res.status(404).json({ error: 'File not found.' })
      }
      file = resolve(distDir, 'index.html')
      body = await readFile(file)
    }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', path.startsWith('/assets/') || /^\/(default-avatar-v3|oopsies-dog-v2|anonymous-commenter-v2)\.webp$/.test(path)
      ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.setHeader('Content-Length', body.length)
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (error) {
    if (error instanceof URIError) return res.status(400).json({ error: 'Invalid path.' })
    console.error('Request failed:', error.message)
    if (!res.headersSent) res.status(500).json({ error: 'Request failed.' })
    else res.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer((req, res) => { void handleRequest(req, res) })
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Big Dog Flips is listening.'))
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
}
