import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { songLinkError, songLinksFor } from '../../src/lib/songLinks.js'
import { makeSong } from '../fixtures/league.js'

describe('song service links', () => {
  it('keeps all four service searches when no direct links were submitted', () => {
    const song = makeSong({ artist: 'AC/DC & Friends', title: 'Hello? #1' })

    const links = songLinksFor(song, { includeSearchFallbacks: true })

    const query = 'AC%2FDC%20%26%20Friends%20Hello%3F%20%231'
    assert.deepEqual(links, [
      { label: 'Spotify', url: `https://open.spotify.com/search/${query}`, isSearch: true },
      { label: 'TIDAL', url: `https://tidal.com/search?q=${query}`, isSearch: true },
      { label: 'Apple Music', url: `https://music.apple.com/us/search?term=${query}`, isSearch: true },
      { label: 'YouTube Music', url: `https://music.youtube.com/search?q=${query}`, isSearch: true },
    ])
  })

  for (const [field, label, url] of [
    ['spotify_url', 'Spotify', 'https://open.spotify.com/track/abc123'],
    ['tidal_url', 'TIDAL', 'https://tidal.com/track/123'],
    ['apple_music_url', 'Apple Music', 'https://music.apple.com/us/album/test/123?i=456'],
    ['youtube_music_url', 'YouTube Music', 'https://music.youtube.com/watch?v=abc123'],
  ]) {
    it(`uses a direct ${label} link while keeping the other three searches`, () => {
      const song = makeSong({ [field]: `  ${url}  ` })

      const links = songLinksFor(song, { includeSearchFallbacks: true })

      assert.equal(links.length, 4)
      assert.deepEqual(links.find(link => link.label === label), { label, url })
      assert.equal(links.filter(link => link.isSearch).length, 3)
    })
  }

  it('preserves a legacy submitted Spotify link without duplicating its button', () => {
    const url = 'https://open.spotify.com/track/legacy'

    const links = songLinksFor(makeSong({ link: url }), { includeSearchFallbacks: true })

    assert.deepEqual(links.filter(link => link.label === 'Spotify'), [{ label: 'Spotify', url }])
    assert.equal(links.length, 4)
  })

  it('prefers the dedicated service field over an older link for the same service', () => {
    const url = 'https://open.spotify.com/track/new'
    const song = makeSong({ spotify_url: url, link: 'https://open.spotify.com/track/old' })

    assert.deepEqual(songLinksFor(song), [{ label: 'Spotify', url }])
  })

  it('keeps other services alongside the four standard service buttons', () => {
    const url = 'https://artist.bandcamp.com/track/test-song'

    const links = songLinksFor(makeSong({ link: url }), { includeSearchFallbacks: true })

    assert.equal(links.length, 5)
    assert.deepEqual(links.find(link => link.label === 'Bandcamp'), { label: 'Bandcamp', url })
  })

  it('returns only supplied links by default for copied lists', () => {
    assert.deepEqual(songLinksFor(makeSong()), [])
    const url = 'https://tidal.com/track/123'
    assert.deepEqual(songLinksFor(makeSong({ tidal_url: url })), [{ label: 'TIDAL', url }])
  })

  it('falls back to search when a stored service URL is invalid', () => {
    const song = makeSong({ spotify_url: 'javascript:alert(1)', link: 'javascript:alert(2)' })

    const links = songLinksFor(song, { includeSearchFallbacks: true })

    assert.equal(links.length, 4)
    assert.ok(links.every(link => link.isSearch && link.url.startsWith('https://')))
  })
})

describe('song link validation', () => {
  it('allows every link field to be blank', () => {
    assert.equal(songLinkError(makeSong({ spotify_url: '   ' })), '')
  })

  for (const [field, url] of [
    ['spotify_url', 'https://spotify.link/sharedTrack'],
    ['spotify_url', 'https://open.spotify.com/intl-de/track/abc123?si=share'],
    ['tidal_url', 'https://listen.tidal.com/track/123'],
    ['tidal_url', 'https://tidal.com/browse/track/123?u'],
    ['apple_music_url', 'https://music.apple.com/us/song/test-song/123'],
    ['apple_music_url', 'https://music.apple.com/us/song/123'],
    ['youtube_music_url', 'https://music.youtube.com/watch?v=abc123&si=share'],
  ]) {
    it(`accepts a supported share URL: ${url}`, () => {
      assert.equal(songLinkError(makeSong({ [field]: url })), '')
    })
  }

  for (const [field, label, url] of [
    ['spotify_url', 'Spotify', 'https://open.spotify.com/search/test'],
    ['spotify_url', 'Spotify', 'https://open.spotify.com.evil.example/track/abc'],
    ['tidal_url', 'TIDAL', 'https://tidal.com/album/123'],
    ['apple_music_url', 'Apple Music', 'https://music.apple.com/us/album/test/123'],
    ['youtube_music_url', 'YouTube Music', 'https://music.youtube.com/playlist?list=abc'],
    ['youtube_music_url', 'YouTube Music', 'https://music.youtube.com/watch'],
  ]) {
    it(`rejects a non-track or wrong-host URL: ${url}`, () => {
      assert.ok(songLinkError(makeSong({ [field]: url })).includes(label))
    })
  }

  it('rejects unsafe or credential-bearing other links', () => {
    for (const link of ['javascript:alert(1)', 'ftp://example.com/song', 'https://user:secret@example.com/song']) {
      assert.notEqual(songLinkError(makeSong({ link })), '')
    }
  })
})
