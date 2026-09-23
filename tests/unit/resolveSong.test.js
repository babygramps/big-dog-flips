import assert from 'node:assert/strict'
import { it } from 'node:test'
import { resolveSong } from '../../src/lib/resolveSong.js'

const spotify = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'
const apple = 'https://music.apple.com/us/album/test/123?i=456'
const json = value => ({ ok: true, json: async () => value })

it('fills title and artist from a Spotify share link and adds one exact Apple match', async () => {
  const fetcher = async url => {
    if (String(url).startsWith('https://itunes.apple.com/search')) return json({ results: [{ kind: 'song', artistName: 'Rick Astley', trackName: 'Never Gonna Give You Up', collectionName: 'Album', trackId: 456, trackViewUrl: apple }] })
    return { ok: true, text: async () => '<meta property="og:title" content="Never Gonna Give You Up"><meta property="og:description" content="Rick Astley · Album · Song · 1987">' }
  }
  assert.deepEqual(await resolveSong(spotify, { fetcher, token: '' }), {
    artist: 'Rick Astley', title: 'Never Gonna Give You Up', album: 'Album', links: { spotify_url: spotify, apple_music_url: apple },
  })
})

it('does not assign an Apple recording when multiple releases match the title and artist', async () => {
  const fetcher = async url => String(url).includes('/search?')
    ? json({ results: [456, 789].map(trackId => ({ kind: 'song', trackId, artistName: 'Rick Astley', trackName: 'Never Gonna Give You Up', trackViewUrl: apple })) })
    : { ok: true, text: async () => '<meta property="og:title" content="Never Gonna Give You Up"><meta name="music:musician_description" content="Rick Astley">' }
  const result = await resolveSong(spotify, { fetcher, token: '' })
  assert.deepEqual(result.links, { spotify_url: spotify })
})

it('uses a YouTube Music video title and channel but never invents other direct links', async () => {
  const input = 'https://music.youtube.com/watch?v=abc123'
  const fetcher = async url => String(url).includes('oembed')
    ? json({ title: 'Artist - A Song', author_name: 'Artist - Topic' })
    : json({ results: [] })
  const result = await resolveSong(input, { fetcher, token: '' })
  assert.deepEqual(result, { artist: 'Artist', title: 'A Song', album: '', links: { youtube_music_url: input } })
})

it('rejects unsafe hosts before making any outbound request', async () => {
  await assert.rejects(() => resolveSong('https://music.youtube.com.evil.example/watch?v=123', { fetcher: () => { throw Error('should not fetch') }, token: '' }), /Use a Spotify/)
})
