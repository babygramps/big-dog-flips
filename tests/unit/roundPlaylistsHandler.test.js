import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { roundPlaylistsHandler } from '../../api/round-playlists.js'
import { makeRound, makeSettings, makeSong } from '../fixtures/league.js'

const THURSDAY = new Date('2026-09-17T08:30:00Z')
const FRIDAY = new Date('2026-09-18T08:30:00Z')

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

function readyStore() {
  return {
    loadSchedule: async () => ({ settings: makeSettings({ league_name: 'Big Dog Flips' }), rounds: [makeRound({ theme_name: 'Rain' })] }),
    loadRound: async () => ({ songs: [makeSong()], roundGroups: [], playlists: [] }),
    savePlaylist: async () => {},
  }
}

const createShare = async () => ({ shareId: 'share-1', url: 'https://www.tunemymusic.com/share/share-1' })

describe('round playlists endpoint', () => {
  for (const method of ['GET', 'POST']) {
    it(`reports the links it made for a ${method} request`, async () => {
      const handler = roundPlaylistsHandler({ makeStore: readyStore, createShare, now: () => THURSDAY })
      const res = fakeResponse()

      await handler({ method }, res)

      assert.equal(res.statusCode, 200)
      assert.deepEqual(res.body, { status: 'done', created: [{ groupIndex: 0, url: 'https://www.tunemymusic.com/share/share-1' }], failed: [] })
    })
  }

  it('treats GET as the nightly run, which skips nights other than the one submission ends', async () => {
    const handler = roundPlaylistsHandler({ makeStore: readyStore, createShare, now: () => FRIDAY })
    const res = fakeResponse()

    await handler({ method: 'GET' }, res)

    assert.deepEqual(res.body, { status: 'not-ready', created: [], failed: [] })
  })

  it('treats POST as the admin button, which fills a missing link any time during voting', async () => {
    const handler = roundPlaylistsHandler({ makeStore: readyStore, createShare, now: () => FRIDAY })
    const res = fakeResponse()

    await handler({ method: 'POST' }, res)

    assert.equal(res.body.created.length, 1)
  })

  it('turns away other methods', async () => {
    const handler = roundPlaylistsHandler({ makeStore: readyStore, createShare, now: () => THURSDAY })
    const res = fakeResponse()

    await handler({ method: 'DELETE' }, res)

    assert.equal(res.statusCode, 405)
    assert.equal(res.headers.Allow, 'GET, POST')
  })

  it('explains when the server has no database settings', async () => {
    const handler = roundPlaylistsHandler({ makeStore: () => null, createShare, now: () => THURSDAY })
    const res = fakeResponse()

    await handler({ method: 'GET' }, res)

    assert.equal(res.statusCode, 500)
    assert.match(res.body.error, /Supabase/)
  })

  it('reports a failed database read instead of crashing', async () => {
    const brokenStore = () => ({ ...readyStore(), loadSchedule: async () => { throw new Error('Could not load the schedule.') } })
    const handler = roundPlaylistsHandler({ makeStore: brokenStore, createShare, now: () => THURSDAY })
    const res = fakeResponse()

    await handler({ method: 'GET' }, res)

    assert.equal(res.statusCode, 502)
    assert.deepEqual(res.body, { error: 'Could not load the schedule.' })
  })
})
