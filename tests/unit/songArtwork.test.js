import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSongEntries } from '../../src/lib/scoring.js'
import { findSongArtwork } from '../../src/lib/songArtwork.js'
import { resolveSong } from '../../src/lib/resolveSong.js'
import { makeDuplicateRound, makeSong } from '../fixtures/league.js'

const json = value => ({ ok: true, json: async () => value })
const song = { artist: 'Rick Astley', title: 'Never Gonna Give You Up', album: 'Whenever You Need Somebody' }

describe('song artwork', () => {
  it('uses the iTunes cover for the matching song, enlarged to 600px', async () => {
    const fetcher = async url => {
      assert.match(String(url), /^https:\/\/itunes\.apple\.com\/search\?/)
      return json({ results: [
        { kind: 'song', artistName: 'Someone Else', trackName: 'Never Gonna Give You Up', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/wrong/100x100bb.jpg' },
        { kind: 'song', artistName: 'Rick Astley', trackName: 'Never Gonna Give You Up', collectionName: 'Whenever You Need Somebody', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/right/100x100bb.jpg' },
      ] })
    }
    assert.equal(await findSongArtwork(song, { fetcher }), 'https://is1-ssl.mzstatic.com/image/thumb/right/600x600bb.jpg')
  })

  it('falls back to Deezer when iTunes has no matching song', async () => {
    const fetcher = async url => String(url).startsWith('https://itunes.apple.com/')
      ? json({ results: [] })
      : json({ data: [{ title: 'Never Gonna Give You Up', artist: { name: 'Rick Astley' }, album: { title: 'Hits', cover_xl: 'https://cdn-images.dzcdn.net/images/cover/abc/1000x1000.jpg' } }] })
    assert.equal(await findSongArtwork(song, { fetcher }), 'https://cdn-images.dzcdn.net/images/cover/abc/1000x1000.jpg')
  })

  it('returns no artwork when both catalogs fail or only offer insecure images', async () => {
    const fetcher = async url => String(url).startsWith('https://itunes.apple.com/')
      ? { ok: false }
      : json({ data: [{ title: song.title, artist: { name: song.artist }, album: { cover_xl: 'http://insecure.example/cover.jpg' } }] })
    assert.equal(await findSongArtwork(song, { fetcher }), '')
  })

  it('skips the lookup entirely without an artist and title', async () => {
    assert.equal(await findSongArtwork({ artist: 'Rick Astley' }, { fetcher: () => { throw Error('should not fetch') } }), '')
  })

  it('prefers catalog art to a YouTube video thumbnail when looking up a link', async () => {
    const input = 'https://music.youtube.com/watch?v=abc123'
    const fetcher = async url => {
      if (String(url).includes('oembed')) return json({ title: 'Never Gonna Give You Up', author_name: 'Rick Astley - Topic', thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' })
      if (String(url).includes('api.deezer.com')) return json({ data: [{ title: song.title, artist: { name: song.artist }, album: { cover_xl: 'https://cdn-images.dzcdn.net/cover.jpg' } }] })
      return json({ results: [] })
    }
    const result = await resolveSong(input, { fetcher, token: '' })
    assert.equal(result.artwork_url, 'https://cdn-images.dzcdn.net/cover.jpg')
  })

  it('keeps the video thumbnail when no catalog has the song', async () => {
    const input = 'https://music.youtube.com/watch?v=abc123'
    const fetcher = async url => String(url).includes('oembed')
      ? json({ title: 'Demo', author_name: 'Garage Band', thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' })
      : json({ results: [], data: [] })
    const result = await resolveSong(input, { fetcher, token: '' })
    assert.equal(result.artwork_url, 'https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('shows a merged duplicate with the canonical song’s artwork, or any member’s when it has none', () => {
    const round = makeDuplicateRound()
    round.songs[1].artwork_url = 'https://example.com/alternate.jpg'
    assert.equal(buildSongEntries(round)[0].artwork_url, 'https://example.com/alternate.jpg')

    round.songs[0].artwork_url = 'https://example.com/canonical.jpg'
    assert.equal(buildSongEntries(round)[0].artwork_url, 'https://example.com/canonical.jpg')
  })

  it('leaves a song without artwork blank', () => {
    assert.equal(buildSongEntries({ songs: [makeSong()] })[0].artwork_url, null)
  })
})
