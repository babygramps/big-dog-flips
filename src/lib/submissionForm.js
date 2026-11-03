import { SONG_SERVICES } from './songLinks.js'

// Selecting a song replaces its details and links, while keeping the player's note.
export function applySongLookup(current, lookup) {
  return {
    ...current,
    artist: lookup.artist,
    title: lookup.title,
    album: lookup.album || '',
    artwork_url: lookup.artwork_url || '',
    link: lookup.links.link || '',
    ...Object.fromEntries(SONG_SERVICES.map(({ field }) => [field, lookup.links[field] || ''])),
  }
}
