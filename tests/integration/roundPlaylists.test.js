import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { playlistSyncMessage, syncTuneMyMusicPlaylists } from '../../src/lib/roundPlaylists.js'
import { makeRound, makeSettings, makeSong } from '../fixtures/league.js'

// The fixture schedule starts Monday 2026-09-14, so round-a runs that week.
// Each time is about 1:30 AM Pacific, when the nightly job fires.
const TUESDAY = new Date('2026-09-15T08:30:00Z')
const THURSDAY = new Date('2026-09-17T08:30:00Z')
const SUNDAY = new Date('2026-09-20T08:30:00Z')
const NEXT_MONDAY = new Date('2026-09-21T08:30:00Z')

function splitRound() {
  return {
    settings: makeSettings({ league_name: 'Big Dog Flips' }),
    rounds: [makeRound({ theme_name: 'Rain' })],
    songs: [
      makeSong({ id: 'song-a', player_id: 'player-a', artist: 'Prince', title: 'Purple Rain' }),
      makeSong({ id: 'song-b', player_id: 'player-b', artist: 'Rihanna', title: 'Umbrella' }),
      makeSong({ id: 'song-c', player_id: 'player-c', artist: 'Garbage', title: 'Only Happy When It Rains' }),
    ],
    roundGroups: [
      { round_id: 'round-a', player_id: 'player-a', group_index: 0 },
      { round_id: 'round-a', player_id: 'player-c', group_index: 0 },
      { round_id: 'round-a', player_id: 'player-b', group_index: 1 },
    ],
    playlists: [],
  }
}

function memoryStore(league) {
  const saved = []
  return {
    saved,
    loadSchedule: async () => ({ settings: league.settings, rounds: league.rounds }),
    loadRound: async roundId => ({
      songs: league.songs.filter(song => song.round_id === roundId),
      roundGroups: league.roundGroups.filter(row => row.round_id === roundId),
      playlists: league.playlists.filter(row => row.round_id === roundId),
    }),
    savePlaylist: async row => { saved.push(row) },
  }
}

function fakeShares({ failTitle = null } = {}) {
  const made = []
  async function createShare({ title, username, songs }) {
    if (title === failTitle) throw new Error('TuneMyMusic refused the song upload (401).')
    made.push({ title, username, songs: songs.map(song => song.title) })
    return { shareId: `share-${made.length}`, url: `https://www.tunemymusic.com/share/share-${made.length}` }
  }
  return { made, createShare }
}

describe('syncTuneMyMusicPlaylists', () => {
  it('makes one share per side once voting opens, each holding only that side’s songs', async () => {
    const store = memoryStore(splitRound())
    const shares = fakeShares()

    const result = await syncTuneMyMusicPlaylists({ store, createShare: shares.createShare, now: THURSDAY })

    assert.deepEqual(shares.made.map(share => [share.title, share.username, [...share.songs].sort()]), [
      ['Big Dog Flips · Rain · Side A', 'Big Dog Flips', ['Only Happy When It Rains', 'Purple Rain']],
      ['Big Dog Flips · Rain · Side B', 'Big Dog Flips', ['Umbrella']],
    ])
    assert.deepEqual(store.saved, [
      { round_id: 'round-a', group_index: 0, service: 'TuneMyMusic', url: 'https://www.tunemymusic.com/share/share-1' },
      { round_id: 'round-a', group_index: 1, service: 'TuneMyMusic', url: 'https://www.tunemymusic.com/share/share-2' },
    ])
    assert.equal(result.status, 'done')
    assert.deepEqual(result.failed, [])
  })

  for (const [phase, now, shareCount] of [
    ['submission', TUESDAY, 0],
    ['voting', THURSDAY, 2],
    ['appreciation', SUNDAY, 2],
    ['the week after, with no round queued', NEXT_MONDAY, 0],
  ]) {
    it(`${shareCount ? 'makes' : 'does not make'} shares during ${phase}`, async () => {
      const store = memoryStore(splitRound())
      const shares = fakeShares()

      const result = await syncTuneMyMusicPlaylists({ store, createShare: shares.createShare, now })

      assert.equal(shares.made.length, shareCount)
      assert.equal(result.status, shareCount ? 'done' : 'not-ready')
    })
  }

  it('leaves a side alone once it already has a TuneMyMusic link', async () => {
    const league = splitRound()
    league.playlists = [{ round_id: 'round-a', group_index: 0, service: 'TuneMyMusic', url: 'https://www.tunemymusic.com/share/old' }]
    const store = memoryStore(league)
    const shares = fakeShares()

    await syncTuneMyMusicPlaylists({ store, createShare: shares.createShare, now: THURSDAY })

    assert.deepEqual(shares.made.map(share => share.title), ['Big Dog Flips · Rain · Side B'])
  })

  it('still makes a share when the side only has hand-added playlists from other services', async () => {
    const league = splitRound()
    league.playlists = [{ round_id: 'round-a', group_index: 0, service: 'Spotify', url: 'https://open.spotify.com/playlist/abc' }]
    const shares = fakeShares()

    await syncTuneMyMusicPlaylists({ store: memoryStore(league), createShare: shares.createShare, now: THURSDAY })

    assert.equal(shares.made.length, 2)
  })

  it('keeps going when one side fails and saves no link for it', async () => {
    const store = memoryStore(splitRound())
    const shares = fakeShares({ failTitle: 'Big Dog Flips · Rain · Side A' })

    const result = await syncTuneMyMusicPlaylists({ store, createShare: shares.createShare, now: THURSDAY })

    assert.deepEqual(store.saved.map(row => row.group_index), [1])
    assert.deepEqual(result.failed, [{ groupIndex: 0, error: 'TuneMyMusic refused the song upload (401).' }])
  })

  it('names an unsplit round without a side and files its share under group 0', async () => {
    const league = splitRound()
    league.roundGroups = []
    const store = memoryStore(league)
    const shares = fakeShares()

    await syncTuneMyMusicPlaylists({ store, createShare: shares.createShare, now: THURSDAY })

    assert.deepEqual(shares.made.map(share => [share.title, share.songs.length]), [['Big Dog Flips · Rain', 3]])
    assert.deepEqual(store.saved.map(row => row.group_index), [0])
  })

  it('skips a round where nobody submitted a song', async () => {
    const league = splitRound()
    league.songs = []
    const shares = fakeShares()

    const result = await syncTuneMyMusicPlaylists({ store: memoryStore(league), createShare: shares.createShare, now: THURSDAY })

    assert.equal(shares.made.length, 0)
    assert.equal(result.status, 'done')
  })

  it('orders the playlist the same way no matter what order songs were submitted in', async () => {
    const league = splitRound()
    league.roundGroups = []
    const forward = fakeShares()
    const backward = fakeShares()

    await syncTuneMyMusicPlaylists({ store: memoryStore(league), createShare: forward.createShare, now: THURSDAY })
    league.songs = [...league.songs].reverse()
    await syncTuneMyMusicPlaylists({ store: memoryStore(league), createShare: backward.createShare, now: THURSDAY })

    assert.deepEqual(backward.made[0].songs, forward.made[0].songs)
  })
})

describe('playlistSyncMessage', () => {
  it('says nothing was shared before voting opens', () => {
    assert.match(playlistSyncMessage({ status: 'not-ready', created: [], failed: [] }), /voting/i)
  })

  it('counts the links it made', () => {
    const message = playlistSyncMessage({ status: 'done', created: [{ groupIndex: 0, url: 'a' }, { groupIndex: 1, url: 'b' }], failed: [] })
    assert.match(message, /2 links/)
  })

  it('says every side already had a link when there was nothing to do', () => {
    assert.match(playlistSyncMessage({ status: 'done', created: [], failed: [] }), /already/i)
  })

  it('names the side that failed and why', () => {
    const message = playlistSyncMessage({
      status: 'done',
      created: [{ groupIndex: 0, url: 'a' }],
      failed: [{ groupIndex: 1, error: 'TuneMyMusic refused the song upload (401).' }],
    })
    assert.match(message, /1 link\b/)
    assert.match(message, /Side B: TuneMyMusic refused the song upload \(401\)\./)
  })
})
