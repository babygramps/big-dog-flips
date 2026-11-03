import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applySongLookup } from '../../src/lib/submissionForm.js'
import { songLinksFor } from '../../src/lib/songLinks.js'

const original = {
  artist: 'Old Artist', title: 'Old Song', album: 'Old Album',
  youtube_music_url: 'https://music.youtube.com/watch?v=old',
  spotify_url: 'https://open.spotify.com/track/old',
  tidal_url: 'https://tidal.com/track/123',
  apple_music_url: 'https://music.apple.com/us/song/old/123',
  link: 'https://youtu.be/old', artwork_url: 'https://example.com/old.jpg',
  submitter_note: 'My comment',
}

describe('replacing a submission through song lookup', () => {
  it('uses the new YouTube Music URL and searches for the new song on missing services', () => {
    const url = 'https://music.youtube.com/watch?v=new'
    const updated = applySongLookup(original, {
      artist: 'New Artist', title: 'New Song', album: '', links: { youtube_music_url: url },
    })
    assert.equal(updated.youtube_music_url, url)
    assert.equal(updated.link, '')
    assert.equal(updated.album, '')
    assert.equal(updated.artwork_url, '')
    assert.equal(updated.submitter_note, 'My comment')
    const links = songLinksFor(updated, { includeSearchFallbacks: true })
    assert.deepEqual(links.find(link => link.label === 'YouTube Music'), { label: 'YouTube Music', url })
    for (const label of ['Spotify', 'TIDAL', 'Apple Music']) {
      const link = links.find(link => link.label === label)
      assert.equal(link.isSearch, true)
      assert.ok(decodeURIComponent(link.url).includes('New Artist New Song'))
    }
    assert.equal(original.youtube_music_url, 'https://music.youtube.com/watch?v=old')
  })

  it('replaces all returned service links, the other link, album, and artwork', () => {
    const lookup = {
      artist: 'New Artist', title: 'New Song', album: 'New Album', artwork_url: 'https://example.com/new.jpg',
      links: {
        youtube_music_url: 'https://music.youtube.com/watch?v=new',
        spotify_url: 'https://open.spotify.com/track/new',
        tidal_url: 'https://tidal.com/track/456',
        apple_music_url: 'https://music.apple.com/us/song/new/456',
        link: 'https://youtu.be/new',
      },
    }
    const updated = applySongLookup(original, lookup)
    for (const [field, value] of Object.entries(lookup.links)) assert.equal(updated[field], value)
    assert.equal(updated.album, lookup.album)
    assert.equal(updated.artwork_url, lookup.artwork_url)
  })
})
