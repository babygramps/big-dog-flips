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

const SERVICE_GUIDES = {
  spotify_url: { example: 'open.spotify.com/track/…', hint: 'In Spotify, open the song, tap ⋯, then Share → Copy Song Link.' },
  tidal_url: { example: 'tidal.com/track/…', hint: 'In TIDAL, open the song, tap ⋯, then Share → Copy link.' },
  apple_music_url: { example: 'music.apple.com/…/song/…', hint: 'In Apple Music, press and hold the song itself, then share it and copy the link.' },
  youtube_music_url: { example: 'music.youtube.com/watch?v=…', hint: 'In YouTube Music, open the song, tap Share, then Copy link.' },
}

// Which link field a URL belongs in, or null when it isn't one of the four
// standard services.
function serviceFieldFor(url) {
  if (hasHost(url, 'spotify.com') || ['spotify.link', 'spotify.app.link'].includes(url.hostname)) return 'spotify_url'
  if (hasHost(url, 'tidal.com')) return 'tidal_url'
  if (hasHost(url, 'music.apple.com') || url.hostname === 'itunes.apple.com') return 'apple_music_url'
  if (url.hostname === 'music.youtube.com') return 'youtube_music_url'
  return null
}

// Classify a service URL as { kind: 'track' }, { kind: 'track', cutOff: true }
// when the song ID is missing, or { kind: 'an album' } etc. for pages that
// aren't a single song. A missing kind means an unrecognised page.
function spotifyPage(url) {
  // Short links redirect to whatever was shared; they can't be checked offline.
  if (url.hostname === 'spotify.link' || url.hostname === 'spotify.app.link') return url.pathname.length > 1 ? { kind: 'track' } : {}
  if (!['open.spotify.com', 'play.spotify.com'].includes(url.hostname)) return {}
  const parts = url.pathname.split('/').filter(Boolean)
  if (/^intl-/.test(parts[0])) parts.shift()
  if (parts[0] === 'embed') parts.shift()
  const kinds = { album: 'an album', playlist: 'a playlist', artist: 'an artist page', show: 'a podcast', episode: 'a podcast episode', user: 'a profile', search: 'a search', genre: 'a genre page', collection: 'your library' }
  if (parts[0] === 'track') return { kind: 'track', cutOff: !(parts.length === 2 && /^[a-zA-Z0-9]+$/.test(parts[1])) }
  return { kind: kinds[parts[0]] }
}

function tidalPage(url) {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'browse') parts.shift()
  // Share links end in /u; the web player nests tracks under their album.
  if (parts.at(-1) === 'u') parts.pop()
  if (parts[0] === 'album' && parts[2] === 'track') parts.splice(0, 2)
  const kinds = { album: 'an album', playlist: 'a playlist', artist: 'an artist page', video: 'a video', mix: 'a mix', search: 'a search' }
  if (parts[0] === 'track') return { kind: 'track', cutOff: !(parts.length === 2 && /^\d+$/.test(parts[1])) }
  return { kind: kinds[parts[0]] }
}

function applePage(url) {
  const parts = url.pathname.split('/').filter(Boolean)
  if (/^[a-z]{2}$/.test(parts[0])) parts.shift()
  const kinds = { playlist: 'a playlist', artist: 'an artist page', station: 'a radio station', 'music-video': 'a music video', curator: 'a curator page', search: 'a search' }
  if (parts[0] === 'song') return { kind: 'track', cutOff: !(parts.length <= 3 && /^\d+$/.test(parts.at(-1))) }
  if (parts[0] === 'album') {
    // A song shared from an album page keeps the album URL and adds ?i=<song id>.
    const song = url.searchParams.get('i')
    return song === null ? { kind: 'an album' } : { kind: 'track', cutOff: !/^\d+$/.test(song) }
  }
  return { kind: kinds[parts[0]] }
}

function youtubeMusicPage(url) {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'watch') {
    const video = url.searchParams.get('v')
    if (video) return { kind: 'track', cutOff: !/^[\w-]+$/.test(video) }
    return url.searchParams.get('list') ? { kind: 'a playlist' } : { kind: 'track', cutOff: true }
  }
  if (parts[0] === 'browse') return { kind: parts[1]?.startsWith('MPREb') ? 'an album' : 'a playlist' }
  const kinds = { playlist: 'a playlist', channel: 'an artist page', search: 'a search', library: 'your library', explore: 'the Explore page' }
  return { kind: kinds[parts[0]] }
}

const PAGE_READERS = {
  spotify_url: spotifyPage,
  tidal_url: tidalPage,
  apple_music_url: applePage,
  youtube_music_url: youtubeMusicPage,
}

// Problems every link field shares: pasted share text, a missing https://,
// app-only URIs, and non-web schemes. Returns [message] or [null, url].
function parseLink(value, label) {
  if ((value.match(/https?:\/\//gi) || []).length > 1) return [`The ${label} field has more than one link in it. Paste just one.`]
  if (/\s/.test(value)) {
    return [/https?:\/\//i.test(value)
      ? `The ${label} field has extra text around the link. Paste only the link itself.`
      : `The ${label} field doesn’t contain a link. Paste the song’s share link, or leave it blank.`]
  }
  if (/^spotify:/i.test(value)) {
    return [label === 'Spotify'
      ? 'That’s a Spotify URI, which only opens in the app. In Spotify, use Share → Copy Song Link instead.'
      : `The ${label} field has a Spotify URI, which only opens in the app. Paste a Spotify song link in the Spotify field instead.`]
  }
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return [/^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/?#]|$)/.test(value)
      ? `The ${label} field needs a link that starts with https://.`
      : `The ${label} field doesn’t contain a link. Paste the song’s share link, or leave it blank.`]
  }
  let url
  try {
    url = new URL(value)
  } catch {
    return [`The ${label} field doesn’t contain a valid web address. Copy the link again and paste the whole thing.`]
  }
  if (!['http:', 'https:'].includes(url.protocol)) return [`The ${label} field needs a link that starts with https://.`]
  if (url.username || url.password) return [`The ${label} field has a link with a username or password in it. Use a link without them.`]
  return [null, url]
}

function serviceLinkProblem(field, label, value) {
  const [problem, url] = parseLink(value, label)
  if (problem) return problem
  const { example, hint } = SERVICE_GUIDES[field]

  const belongsIn = serviceFieldFor(url)
  if (belongsIn !== field) {
    const other = SONG_SERVICES.find(service => service.field === belongsIn)
    if (other) return `The ${label} field has ${/^[AEIOU]/.test(other.label) ? 'an' : 'a'} ${other.label} link. Move it to the ${other.label} field.`
    const otherLabel = serviceLabelForUrl(value)
    if (otherLabel === 'YouTube' && field === 'youtube_music_url') {
      return 'That’s a regular YouTube link. Use a music.youtube.com link, or move it to Other link.'
    }
    if (otherLabel !== 'Listen') return `The ${label} field has a ${otherLabel} link. Move it to Other link.`
    return `The ${label} field needs a ${label} link, like ${example}`
  }

  const page = PAGE_READERS[field](url)
  if (page.kind === 'track') {
    return page.cutOff ? `The ${label} link looks cut off. Copy it again from ${label} and paste the whole thing.` : ''
  }
  if (page.kind) return `The ${label} link goes to ${page.kind}, not a song. ${hint}`
  return `The ${label} link doesn’t go to a song. ${hint}`
}

function isTrackUrl(field, value) {
  const label = SONG_SERVICES.find(service => service.field === field).label
  return serviceLinkProblem(field, label, value) === ''
}

export function songLinkError(song) {
  for (const { field, label } of SONG_SERVICES) {
    const value = song[field]?.trim()
    const problem = value && serviceLinkProblem(field, label, value)
    if (problem) return problem
  }
  const link = song.link?.trim()
  if (link) {
    const [problem] = parseLink(link, 'Other link')
    if (problem) return problem
  }
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
