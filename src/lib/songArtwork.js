// Cover art comes from free, keyless catalog APIs: the iTunes Search API first,
// then Deezer. Both are best effort, so a miss or an outage returns ''.

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function sameText(a, b) {
  const normalized = value => clean(value).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return normalized(a) !== '' && normalized(a) === normalized(b)
}

export function artworkUrlError(value) {
  const url = clean(value)
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && url.length <= 2048 ? '' : 'Artwork must be an https image link.'
  } catch {
    return 'Artwork must be an https image link.'
  }
}

export function safeArtworkUrl(value) {
  const url = clean(value)
  return url && !artworkUrlError(url) ? url : ''
}

// Apple serves any square size from the same path; 100px is too small for cards.
export function largeAppleArtwork(url) {
  return safeArtworkUrl(clean(url).replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, '/600x600bb.$2'))
}

async function getJson(url, fetcher) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Artwork lookup failed.')
  return response.json()
}

function pick(items, { artist, title, album }, fields) {
  const matches = items.filter(item => sameText(fields.title(item), title) && sameText(fields.artist(item), artist))
  return (album && matches.find(item => sameText(fields.album(item), album))) || matches[0]
}

async function itunesArtwork(song, fetcher) {
  const query = new URL('https://itunes.apple.com/search')
  query.searchParams.set('term', `${song.artist} ${song.title}`)
  query.searchParams.set('entity', 'song')
  query.searchParams.set('country', 'US')
  query.searchParams.set('limit', '25')
  const data = await getJson(query, fetcher)
  const match = pick((data.results || []).filter(item => item.kind === 'song'), song, {
    title: item => item.trackName, artist: item => item.artistName, album: item => item.collectionName,
  })
  return largeAppleArtwork(match?.artworkUrl100)
}

async function deezerArtwork(song, fetcher) {
  const query = new URL('https://api.deezer.com/search')
  query.searchParams.set('q', `artist:"${song.artist}" track:"${song.title}"`)
  query.searchParams.set('limit', '25')
  const data = await getJson(query, fetcher)
  const match = pick(data.data || [], song, {
    title: item => item.title, artist: item => item.artist?.name, album: item => item.album?.title,
  })
  return safeArtworkUrl(match?.album?.cover_xl || match?.album?.cover_big)
}

export async function findSongArtwork({ artist, title, album } = {}, { fetcher = fetch } = {}) {
  const song = { artist: clean(artist), title: clean(title), album: clean(album) }
  if (!song.artist || !song.title) return ''
  for (const source of [itunesArtwork, deezerArtwork]) {
    try {
      const url = await source(song, fetcher)
      if (url) return url
    } catch { /* Try the next free catalog. */ }
  }
  return ''
}
