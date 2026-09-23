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
    ['spotify_url', 'https://spotify.app.link/sharedTrack'],
    ['spotify_url', 'https://open.spotify.com/embed/track/abc123'],
    ['tidal_url', 'https://tidal.com/track/123/u'],
    ['tidal_url', 'https://listen.tidal.com/album/99/track/123'],
    ['apple_music_url', 'https://music.apple.com/album/test/99?i=123'],
    ['youtube_music_url', 'https://music.youtube.com/watch?v=abc_12-3&list=RDAMVMabc'],
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

  const spotifyHint = 'In Spotify, open the song, tap ⋯, then Share → Copy Song Link.'
  const appleHint = 'In Apple Music, press and hold the song itself, then share it and copy the link.'
  for (const [name, song, message] of [
    ['an album link', { spotify_url: 'https://open.spotify.com/album/2qEqDJ2abc?si=x' }, `The Spotify link goes to an album, not a song. ${spotifyHint}`],
    ['a playlist link', { spotify_url: 'https://open.spotify.com/playlist/37i9dQ' }, `The Spotify link goes to a playlist, not a song. ${spotifyHint}`],
    ['an artist link', { spotify_url: 'https://open.spotify.com/intl-fr/artist/abc' }, `The Spotify link goes to an artist page, not a song. ${spotifyHint}`],
    ['a podcast episode', { spotify_url: 'https://open.spotify.com/episode/abc' }, `The Spotify link goes to a podcast episode, not a song. ${spotifyHint}`],
    ['the Spotify home page', { spotify_url: 'https://open.spotify.com/' }, `The Spotify link doesn’t go to a song. ${spotifyHint}`],
    ['a Spotify URI', { spotify_url: 'spotify:track:abc123' }, 'That’s a Spotify URI, which only opens in the app. In Spotify, use Share → Copy Song Link instead.'],
    ['a track link missing its ID', { spotify_url: 'https://open.spotify.com/track/' }, 'The Spotify link looks cut off. Copy it again from Spotify and paste the whole thing.'],
    ['an Apple album link without a song', { apple_music_url: 'https://music.apple.com/us/album/test/123' }, `The Apple Music link goes to an album, not a song. ${appleHint}`],
    ['an Apple album link with a broken song ID', { apple_music_url: 'https://music.apple.com/us/album/test/123?i=' }, 'The Apple Music link looks cut off. Copy it again from Apple Music and paste the whole thing.'],
    ['an Apple radio station', { apple_music_url: 'https://music.apple.com/us/station/test/ra.123' }, `The Apple Music link goes to a radio station, not a song. ${appleHint}`],
    ['a TIDAL album link', { tidal_url: 'https://tidal.com/browse/album/123' }, 'The TIDAL link goes to an album, not a song. In TIDAL, open the song, tap ⋯, then Share → Copy link.'],
    ['a YouTube Music album', { youtube_music_url: 'https://music.youtube.com/browse/MPREb_abc' }, 'The YouTube Music link goes to an album, not a song. In YouTube Music, open the song, tap Share, then Copy link.'],
    ['a YouTube Music playlist', { youtube_music_url: 'https://music.youtube.com/playlist?list=abc' }, 'The YouTube Music link goes to a playlist, not a song. In YouTube Music, open the song, tap Share, then Copy link.'],
    ['a YouTube Music watch link without a video', { youtube_music_url: 'https://music.youtube.com/watch' }, 'The YouTube Music link looks cut off. Copy it again from YouTube Music and paste the whole thing.'],
    ['a regular YouTube link', { youtube_music_url: 'https://youtu.be/abc123' }, 'That’s a regular YouTube link. Use a music.youtube.com link, or move it to Other link.'],
    ['another service’s link', { spotify_url: 'https://music.apple.com/us/song/test/123' }, 'The Spotify field has an Apple Music link. Move it to the Apple Music field.'],
    ['a non-standard service', { tidal_url: 'https://artist.bandcamp.com/track/test' }, 'The TIDAL field has a Bandcamp link. Move it to Other link.'],
    ['an unknown site', { spotify_url: 'https://open.spotify.com.evil.example/track/abc' }, 'The Spotify field needs a Spotify link, like open.spotify.com/track/…'],
    ['a link without https://', { spotify_url: 'open.spotify.com/track/abc123' }, 'The Spotify field needs a link that starts with https://.'],
    ['share text around the link', { apple_music_url: 'Listen on Apple Music https://music.apple.com/us/song/test/123' }, 'The Apple Music field has extra text around the link. Paste only the link itself.'],
    ['two links pasted together', { spotify_url: 'https://open.spotify.com/track/abchttps://open.spotify.com/track/abc' }, 'The Spotify field has more than one link in it. Paste just one.'],
    ['a song name instead of a link', { spotify_url: 'Guillotine' }, 'The Spotify field doesn’t contain a link. Paste the song’s share link, or leave it blank.'],
    ['an other link without https://', { link: 'artist.bandcamp.com/track/test' }, 'The Other link field needs a link that starts with https://.'],
    ['an other link with text around it', { link: 'check this https://artist.bandcamp.com/track/test' }, 'The Other link field has extra text around the link. Paste only the link itself.'],
  ]) {
    it(`explains ${name}`, () => {
      assert.equal(songLinkError(makeSong(song)), message)
    })
  }

  it('rejects unsafe or credential-bearing other links', () => {
    for (const link of ['javascript:alert(1)', 'ftp://example.com/song', 'https://user:secret@example.com/song']) {
      assert.notEqual(songLinkError(makeSong({ link })), '')
    }
  })
})
