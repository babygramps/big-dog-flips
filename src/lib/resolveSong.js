import { SONG_SERVICES, serviceFieldForUrl, songLinkError } from './songLinks.js'

const serviceKeys = { spotify_url: 'spotify', tidal_url: 'tidal', apple_music_url: 'appleMusic', youtube_music_url: 'youtubeMusic' }
const error = (message, status = 422) => Object.assign(new Error(message), { status })

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function decodeHtml(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
}
function meta(html, name) {
  const tag = [...html.matchAll(/<meta\s+[^>]*>/gi)].map(match => match[0]).find(tag => new RegExp(`(?:property|name)=["']${name}["']`, 'i').test(tag))
  return tag ? decodeHtml(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : ''
}
function safeLink(field, value) {
  const url = clean(value)
  return url && !songLinkError({ [field]: url }) ? url : ''
}
async function getJson(url, fetcher, options = {}) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000), ...options })
  if (!response.ok) throw error('The music service could not find that song.', 404)
  return response.json()
}

function source(url) {
  if (typeof url !== 'string' || url.length > 2048) throw error('Paste a song share link.')
  let parsed
  try { parsed = new URL(url.trim()) } catch { throw error('Paste a complete song link starting with https://.') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw error('Paste a secure song share link.')
  const field = serviceFieldForUrl(url)
  if (['spotify.link', 'spotify.app.link'].includes(parsed.hostname)) throw error('For automatic lookup, copy the full open.spotify.com song link.')
  if (field && songLinkError({ [field]: url })) throw error(songLinkError({ [field]: url }))
  if (!field && !['youtube.com', 'www.youtube.com', 'youtu.be'].includes(parsed.hostname)) {
    throw error('Use a Spotify, Apple Music, TIDAL, or YouTube song link.')
  }
  if (!field && !(parsed.hostname === 'youtu.be' ? parsed.pathname.length > 1 : parsed.pathname === '/watch' && parsed.searchParams.has('v'))) {
    throw error('Use a link to a single song, not a playlist or channel.')
  }
  return { field, parsed }
}

async function providerMetadata(url, field, parsed, fetcher) {
  if (field === 'apple_music_url') {
    const id = parsed.searchParams.get('i') || parsed.pathname.split('/').at(-1)
    const data = await getJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song&country=US`, fetcher)
    const song = data.results?.find(item => item.kind === 'song' && String(item.trackId) === id)
    if (!song) throw error('Apple Music did not return a song for that link.', 404)
    return { artist: song.artistName, title: song.trackName, album: song.collectionName || '' }
  }
  if (field === 'youtube_music_url' || !field) {
    const video = parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v')
    const data = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video}`)}&format=json`, fetcher)
    const artist = clean(data.author_name).replace(/ - Topic$/, '')
    let title = clean(data.title)
    if (title.startsWith(`${artist} - `)) title = title.slice(artist.length + 3)
    if (!title || !artist) throw error('Could not identify the artist and title for this video.', 404)
    return { artist, title, album: '' }
  }
  // These services publish separate title and artist Open Graph tags on track pages.
  // Treat them as a suggestion to confirm, since providers can change their markup.
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error' })
  if (!response.ok) throw error('The music service could not open that song.', 404)
  const html = await response.text()
  const title = meta(html, 'og:title')
  const description = meta(html, 'og:description').split(' · ')
  const artist = meta(html, 'music:musician_description') || meta(html, 'music:musician') || description[0]
  if (!title || !artist) throw error('Could not identify the artist and title. Enter them manually.', 404)
  return { artist, title, album: description[1] && description[2] === 'Song' ? description[1] : '' }
}

function musicfetchLinks(result) {
  const links = {}
  for (const { field } of SONG_SERVICES) {
    const service = result.services?.[serviceKeys[field]]
    const link = safeLink(field, typeof service === 'string' ? service : service?.url || service?.link)
    if (link) links[field] = link
  }
  return links
}

function sameText(a, b) {
  const normalized = value => clean(value).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return normalized(a) === normalized(b)
}

async function appleMatch({ artist, title, album }, fetcher) {
  const query = new URL('https://itunes.apple.com/search')
  query.searchParams.set('term', `${artist} ${title}`)
  query.searchParams.set('entity', 'song')
  query.searchParams.set('country', 'US')
  query.searchParams.set('limit', '25')
  try {
    const data = await getJson(query, fetcher)
    let matches = data.results?.filter(item => item.kind === 'song' && sameText(item.trackName, title) && sameText(item.artistName, artist)) || []
    if (album) matches = matches.filter(item => sameText(item.collectionName, album))
    // Several releases of the same song may exist. Without a recording ID, guessing one is unsafe.
    const ids = new Set(matches.map(item => item.trackId))
    return ids.size === 1 ? safeLink('apple_music_url', matches[0].trackViewUrl) : ''
  } catch { return '' }
}

export async function resolveSong(url, { fetcher = fetch, token = process.env.MUSICFETCH_TOKEN } = {}) {
  const { field, parsed } = source(url)
  const links = {}
  if (field) links[field] = url.trim()
  else links.link = url.trim()

  if (token) {
    try {
      const endpoint = new URL('https://api.musicfetch.io/url')
      endpoint.searchParams.set('url', url.trim())
      endpoint.searchParams.set('services', 'spotify,tidal,appleMusic,youtubeMusic')
      endpoint.searchParams.set('country', 'US')
      const data = await getJson(endpoint, fetcher, { headers: { 'x-token': token } })
      const result = data.result
      if (result?.type === 'track' && result.name && result.artists?.length) {
        Object.assign(links, musicfetchLinks(result))
        if (field) links[field] = url.trim()
        return { artist: clean(result.artists[0].name), title: clean(result.name), album: clean(result.albums?.[0]?.name), links }
      }
    } catch { /* Provider metadata is still useful when enrichment is unavailable. */ }
  }

  const metadata = await providerMetadata(url.trim(), field, parsed, fetcher)
  if (field !== 'apple_music_url') {
    const apple = await appleMatch(metadata, fetcher)
    if (apple) links.apple_music_url = apple
  }
  return { ...metadata, links }
}
