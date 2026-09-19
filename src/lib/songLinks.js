export const SONG_SERVICES = [
  { field: 'spotify_url', label: 'Spotify', placeholder: 'https://open.spotify.com/track/…' },
  { field: 'tidal_url', label: 'TIDAL', placeholder: 'https://tidal.com/track/…' },
  { field: 'apple_music_url', label: 'Apple Music', placeholder: 'https://music.apple.com/…' },
  { field: 'youtube_music_url', label: 'YouTube Music', placeholder: 'https://music.youtube.com/watch?v=…' },
]

function webUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

function hasHost(url, domain) {
  return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
}

export function serviceLabelForUrl(value) {
  const url = webUrl(value)
  if (!url) return 'Listen'
  if (hasHost(url, 'spotify.com') || url.hostname === 'spotify.link') return 'Spotify'
  if (hasHost(url, 'tidal.com')) return 'TIDAL'
  if (url.hostname === 'music.youtube.com') return 'YouTube Music'
  if (hasHost(url, 'youtube.com') || url.hostname === 'youtu.be') return 'YouTube'
  if (hasHost(url, 'bandcamp.com')) return 'Bandcamp'
  if (hasHost(url, 'soundcloud.com')) return 'SoundCloud'
  if (url.hostname === 'music.apple.com') return 'Apple Music'
  return 'Listen'
}

function isTrackUrl(field, value) {
  const url = webUrl(value)
  if (!url) return false
  if (field === 'spotify_url') {
    return (url.hostname === 'open.spotify.com' && /^\/(?:intl-[^/]+\/)?track\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) ||
      (url.hostname === 'spotify.link' && url.pathname.length > 1)
  }
  if (field === 'tidal_url') {
    return hasHost(url, 'tidal.com') && /^\/(?:browse\/)?track\/\d+\/?$/.test(url.pathname)
  }
  if (field === 'apple_music_url') {
    return url.hostname === 'music.apple.com' && (
      /^\/[a-z]{2}\/song\/(?:[^/]+\/)?\d+\/?$/.test(url.pathname) ||
      (/^\/[a-z]{2}\/album\//.test(url.pathname) && /^\d+$/.test(url.searchParams.get('i') || ''))
    )
  }
  if (field === 'youtube_music_url') {
    return url.hostname === 'music.youtube.com' && url.pathname === '/watch' && Boolean(url.searchParams.get('v'))
  }
  return false
}

export function songLinkError(song) {
  for (const { field, label } of SONG_SERVICES) {
    if (song[field]?.trim() && !isTrackUrl(field, song[field].trim())) {
      return `Paste a direct song link from ${label}, or leave that field blank.`
    }
  }
  if (song.link?.trim() && !webUrl(song.link.trim())) return 'Use an http or https URL for the other link.'
  return ''
}

function searchUrlFor(field, song) {
  const query = encodeURIComponent(`${song.artist || ''} ${song.title || ''}`.trim())
  if (field === 'spotify_url') return `https://open.spotify.com/search/${query}`
  if (field === 'tidal_url') return `https://tidal.com/search?q=${query}`
  if (field === 'apple_music_url') return `https://music.apple.com/us/search?term=${query}`
  return `https://music.youtube.com/search?q=${query}`
}

export function songLinksFor(song, { includeSearchFallbacks = false } = {}) {
  // Results entries contain their original song rows. Prefer the canonical
  // song's links, then fill missing services from the other duplicate entries.
  const members = song.songs || []
  const canonical = members.find(member => member.id === song.canonical_song_id)
  const sources = members.length ? [canonical, ...members.filter(member => member !== canonical)].filter(Boolean) : [song]
  const links = new Map()
  for (const source of sources) {
    for (const { field, label } of SONG_SERVICES) {
      const url = source[field]?.trim()
      if (url && isTrackUrl(field, url) && !links.has(label)) links.set(label, url)
    }
    const url = source.link?.trim()
    const label = serviceLabelForUrl(url)
    if (webUrl(url) && !links.has(label)) links.set(label, url)
  }
  const result = [...links].map(([label, url]) => ({ label, url }))
  if (includeSearchFallbacks) {
    for (const { field, label } of SONG_SERVICES) {
      if (!links.has(label)) result.push({ label, url: searchUrlFor(field, song), isSearch: true })
    }
  }
  return result
}
