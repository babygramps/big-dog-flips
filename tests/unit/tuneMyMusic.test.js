import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSongCsv, createTuneMyMusicShare } from '../../src/lib/tuneMyMusic.js'

const API = 'https://api.tunemymusic.com/v2'

// A stand-in for TuneMyMusic's server. Each route answers like the real one did
// when tested by hand, and every request is recorded for the assertions.
function fakeTuneMyMusic({ refuse = null } = {}) {
  const requests = []
  const reply = (body, { status = 200, cookies = [] } = {}) => new Response(JSON.stringify(body), {
    status,
    headers: [['content-type', 'application/json'], ...cookies.map(cookie => ['set-cookie', cookie])],
  })

  async function fetcher(url, options = {}) {
    const path = String(url).replace(API, '')
    requests.push({ path, cookie: new Headers(options.headers).get('cookie'), body: JSON.parse(options.body || '{}') })
    if (path === refuse) return reply({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (path === '/General/GetUserData') {
      return reply({ success: true, data: { user: { IsLoggedin: false } } }, {
        cookies: ['PHPSESSID=guest-session; path=/; secure', 'TMM_Unique_Cross=guest-id; Max-Age=157680000; path=/; HttpOnly'],
      })
    }
    if (path === '/Transfer/LoadLibrary') return reply({ success: true, data: { id: 'transfer-1', playlists: [{ id: 'defaultPlaylist' }] } })
    if (path === '/Share/CreateShare') return reply({ success: true, data: { shareId: 'share-1', shareType: 'SinglePlaylist' } })
    return reply({ success: false, error: 'Not found' }, { status: 404 })
  }

  return { fetcher, requests }
}

function uploadedCsv(request) {
  const [prefix, base64] = request.body.fileContent.split(',')
  assert.equal(prefix, 'data:text/csv;base64')
  return Buffer.from(base64, 'base64').toString('utf8')
}

const songs = [
  { artist: 'Daft Punk', title: 'One More Time', album: 'Discovery' },
  { artist: 'Radiohead', title: 'Karma Police', album: null },
]

describe('buildSongCsv', () => {
  it('quotes titles and artists that contain commas, quotes, or line breaks', () => {
    const csv = buildSongCsv([
      { artist: 'The Beatles', title: 'Hello, Goodbye', album: 'Magical Mystery Tour' },
      { artist: 'Eminem', title: 'The "Real" Slim Shady', album: null },
      { artist: 'Line\nBreak', title: 'Plain', album: '' },
    ])

    assert.equal(csv, [
      'Track name,Artist name,Album',
      '"Hello, Goodbye",The Beatles,Magical Mystery Tour',
      '"The ""Real"" Slim Shady",Eminem,',
      'Plain,"Line\nBreak",',
      '',
    ].join('\r\n'))
  })
})

describe('createTuneMyMusicShare', () => {
  it('uploads the songs as a CSV and returns the public share link', async () => {
    const server = fakeTuneMyMusic()

    const share = await createTuneMyMusicShare({ title: 'Big Dog Flips · Rain · Side A', username: 'Big Dog Flips', songs }, { fetcher: server.fetcher })

    assert.deepEqual(share, { shareId: 'share-1', url: 'https://www.tunemymusic.com/share/share-1' })
    const upload = server.requests.find(request => request.path === '/Transfer/LoadLibrary')
    assert.equal(uploadedCsv(upload), 'Track name,Artist name,Album\r\nOne More Time,Daft Punk,Discovery\r\nKarma Police,Radiohead,\r\n')
    assert.equal(upload.body.source, 'FromFile')
    assert.deepEqual(upload.body.csv, { songNameFieldIndex: 0, artistNameFieldIndex: 1, separatorFieldIndex: -1, delimiter: ',', platformIDFieldIndex: -1 })
  })

  it('creates the share from the uploaded list with its title and sharer name', async () => {
    const server = fakeTuneMyMusic()

    await createTuneMyMusicShare({ title: 'Big Dog Flips · Rain', username: 'Big Dog Flips', songs }, { fetcher: server.fetcher })

    const create = server.requests.find(request => request.path === '/Share/CreateShare')
    assert.equal(create.body.transferID, 'transfer-1')
    assert.deepEqual(create.body.selectedPlaylistsIndexes, [1])
    assert.equal(create.body.title, 'Big Dog Flips · Rain')
    assert.equal(create.body.username, 'Big Dog Flips')
  })

  it('sends the guest session cookies from the first call with the upload and share calls', async () => {
    const server = fakeTuneMyMusic()

    await createTuneMyMusicShare({ title: 'Round', username: 'Big Dog Flips', songs }, { fetcher: server.fetcher })

    assert.deepEqual(server.requests.map(request => [request.path, request.cookie]), [
      ['/General/GetUserData', null],
      ['/Transfer/LoadLibrary', 'PHPSESSID=guest-session; TMM_Unique_Cross=guest-id'],
      ['/Share/CreateShare', 'PHPSESSID=guest-session; TMM_Unique_Cross=guest-id'],
    ])
  })

  it('stops at a refused upload and never creates a share', async () => {
    const server = fakeTuneMyMusic({ refuse: '/Transfer/LoadLibrary' })

    await assert.rejects(
      () => createTuneMyMusicShare({ title: 'Round', username: 'Big Dog Flips', songs }, { fetcher: server.fetcher }),
      /upload/i,
    )
    assert.equal(server.requests.some(request => request.path === '/Share/CreateShare'), false)
  })

  it('refuses an empty song list without contacting TuneMyMusic', async () => {
    const server = fakeTuneMyMusic()

    await assert.rejects(() => createTuneMyMusicShare({ title: 'Round', username: 'Big Dog Flips', songs: [] }, { fetcher: server.fetcher }), /no songs/i)
    assert.equal(server.requests.length, 0)
  })
})
