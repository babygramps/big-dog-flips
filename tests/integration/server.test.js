import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { handleRequest } from '../../server.js'

async function request(url, { method = 'GET', body = '', ...options } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : [])
  Object.assign(req, { url, method })
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value },
    end(value) { this.body = value?.toString() || '' },
  }
  await handleRequest(req, res, options)
  return res
}

describe('standalone deployment server', () => {
  it('serves deep links as the SPA, assets with immutable caching, and HEAD without a body', async () => {
    const distDir = await mkdtemp(join(tmpdir(), 'big-dog-flips-'))
    try {
      await writeFile(join(distDir, 'index.html'), '<html>Big Dog Flips</html>')
      await mkdir(join(distDir, 'assets'))
      await writeFile(join(distDir, 'assets', 'app.js'), 'export default 1')
      const page = await request('/rounds/123?tab=songs', { distDir })
      assert.equal(page.statusCode, 200)
      assert.equal(page.body, '<html>Big Dog Flips</html>')
      assert.equal(page.headers['Cache-Control'], 'no-cache')
      assert.equal(page.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive')
      const asset = await request('/assets/app.js', { distDir })
      assert.equal(asset.headers['Cache-Control'], 'public, max-age=31536000, immutable')
      assert.match(asset.headers['Content-Type'], /javascript/)
      const head = await request('/players', { method: 'HEAD', distDir })
      assert.equal(head.body, '')
      assert.equal(head.headers['Content-Length'], 26)
      assert.equal((await request('/assets/missing.js', { distDir })).statusCode, 404)
    } finally {
      await rm(distDir, { recursive: true, force: true })
    }
  })

  it('adapts JSON requests to the existing API handlers and keeps API misses out of the SPA', async () => {
    const apiRoutes = { '/api/example': (req, res) => res.status(201).json({ received: req.body.name }) }
    const response = await request('/api/example', { method: 'POST', body: '{"name":"dog"}', apiRoutes })
    assert.equal(response.statusCode, 201)
    assert.deepEqual(JSON.parse(response.body), { received: 'dog' })
    assert.equal((await request('/api/example', { method: 'POST', body: '{', apiRoutes })).statusCode, 400)
    assert.equal((await request('/api/example', { method: 'POST', body: 'x'.repeat(65537), apiRoutes })).statusCode, 413)
    assert.equal((await request('/api/unknown')).statusCode, 404)
  })

  it('runs the real song handlers and rejects invalid inputs before contacting providers', async () => {
    assert.equal((await request('/api/resolve-song')).statusCode, 405)
    const invalid = await request('/api/resolve-song', { method: 'POST', body: '{"url":"http://127.0.0.1"}' })
    assert.equal(invalid.statusCode, 422)
    const artwork = await request('/api/song-artwork', { method: 'POST', body: '{}' })
    assert.equal(artwork.statusCode, 200)
    assert.deepEqual(JSON.parse(artwork.body), { artwork_url: '' })
  })

  it('provides health checks and rejects file traversal, hidden paths, and malformed URLs', async () => {
    assert.deepEqual(JSON.parse((await request('/healthz')).body), { ok: true })
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/.env', '/%ZZ', '/%00', '/a\\b']) {
      assert.equal((await request(path)).statusCode, 400, path)
    }
    assert.equal((await request('/', { method: 'POST' })).statusCode, 405)
  })
})
