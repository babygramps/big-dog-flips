// TuneMyMusic has no public API. These are the requests its own website makes,
// worked out from its scripts and tested by hand in October 2026. They can change
// without notice, so every step fails loudly instead of guessing.
const API = 'https://api.tunemymusic.com/v2'
const SITE = 'https://www.tunemymusic.com'

function csvField(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// Track name and artist come first: the upload below tells TuneMyMusic to read
// them from columns 0 and 1.
export function buildSongCsv(songs) {
  const rows = [['Track name', 'Artist name', 'Album'], ...songs.map(song => [song.title, song.artist, song.album])]
  return rows.map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

function sessionCookies(response) {
  return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
}

async function post(fetcher, path, body, cookie, failure) {
  const headers = { 'Content-Type': 'application/json', Origin: SITE, 'x-original-URL': `${SITE}/transfer` }
  if (cookie) headers.Cookie = cookie
  const response = await fetcher(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new Error(`${failure} (${response.status}).`)
  return { response, data: result.data }
}

// Makes a share page anyone can open, play from, or import into their own
// streaming service. It runs as a fresh guest each time, so the league needs no
// TuneMyMusic account. The flip side is that nothing can edit or delete the share later.
export async function createTuneMyMusicShare({ title, username, songs }, { fetcher = fetch } = {}) {
  if (!songs?.length) throw new Error('There are no songs to share.')

  const guest = await post(fetcher, '/General/GetUserData', { lang: 'en', page: '/transfer' }, '', 'TuneMyMusic would not start a guest session')
  const cookie = sessionCookies(guest.response)

  const csv = buildSongCsv(songs)
  const upload = await post(fetcher, '/Transfer/LoadLibrary', {
    source: 'FromFile',
    account: '',
    sm: 'no',
    fromUrl: false,
    fromFile: true,
    fileName: 'round.csv',
    fileContent: `data:text/csv;base64,${Buffer.from(csv, 'utf8').toString('base64')}`,
    csv: { songNameFieldIndex: 0, artistNameFieldIndex: 1, separatorFieldIndex: -1, delimiter: ',', platformIDFieldIndex: -1 },
  }, cookie, 'TuneMyMusic refused the song upload')
  if (!upload.data?.id) throw new Error('TuneMyMusic accepted the song upload but returned no transfer.')

  // The site's own share flow sends selectedPlaylistsIndexes. Sending
  // sourcePlaylistID instead produces a share with no songs in it.
  const share = await post(fetcher, '/Share/CreateShare', {
    username,
    transferID: upload.data.id,
    selectedPlaylistsIndexes: [1],
    title,
    description: `${username} shared this playlist with you.`,
    createShareFrom: 'ShareFlow',
  }, cookie, 'TuneMyMusic would not create the share')
  const shareId = share.data?.shareId
  if (!shareId) throw new Error('TuneMyMusic created the share but returned no link.')

  return { shareId, url: `${SITE}/share/${shareId}` }
}
