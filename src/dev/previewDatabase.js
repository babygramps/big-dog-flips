import previewArtwork from './previewArtwork.js'
import { DEFAULT_WEEKLY_TEMPLATE, getCurrentMonday } from '../lib/schedule.js'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export function createPreviewDatabase() {
  const players = ['Rick', 'Alex', 'Sam', 'Jordan', 'Casey'].map((name, i) => ({
    id: id(i + 1), name, active: true, avatar_color: '#d6a359',
    avatar_url: '/default-avatar-v3.webp', created_at: '2026-01-01T12:00:00Z',
  }))
  const round = { id: id(100), theme_name: 'Songs for the long way home',
    theme_description: 'One more track before you pull into the driveway.',
    queue_position: 0, week_start_date: getCurrentMonday(), is_archived: false,
    submitted_by_player_id: players[0].id, created_at: '2026-01-01T12:00:00Z' }
  const settings = { id: 1, league_name: 'Big Dog Flips', season_label: 'Season 2',
    schedule_start_date: getCurrentMonday(), points_per_player: 3, b_sides_enabled: false,
    weekly_phase_template: DEFAULT_WEEKLY_TEMPLATE, timezone: 'America/Los_Angeles' }
  const tracks = [
    ['Sweet Disposition', 'The Temper Trap', 'Conditions', 'Could drive another hundred miles.'],
    ['This Must Be the Place', 'Talking Heads', 'Speaking in Tongues', 'The last song on every road trip.'],
    ['Nightcall', 'Kavinsky', 'Nightcall', 'Windows down, city lights.'],
    ['Dreams', 'Fleetwood Mac', 'Rumours', 'A classic for the open road.'],
    ['Under the Pressure', 'The War on Drugs', 'Lost in the Dream', 'Let this one build.'],
  ]
  const songs = tracks.map(([title, artist, album, submitter_note], i) => ({
    id: id(200 + i), round_id: round.id, player_id: players[i].id,
    title, artist, album, submitter_note, created_at: `2026-01-01T12:0${i}:00Z`,
  }))
  const rows = {
    players, rounds: [round], league_settings: [settings], songs,
    bonus_songs: [
      { id: id(300), round_id: round.id, player_id: players[1].id, title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We’re Dreaming', submitter_note: 'Couldn’t leave this one out.' },
      { id: id(301), round_id: round.id, player_id: players[0].id, title: 'A Real Hero', artist: 'College & Electric Youth', album: 'Drive', submitter_note: 'My bonus pick for the night drive.' },
      { id: id(302), round_id: round.id, player_id: players[2].id, title: 'Road to Nowhere', artist: 'Talking Heads', album: 'Little Creatures', submitter_note: 'One more for the road.' },
    ],
    votes: players.slice(1).flatMap((player, i) => [
      { id: id(400 + i * 2), round_id: round.id, voter_player_id: player.id, song_id: songs[(i + 2) % songs.length].id, points: 2 },
      { id: id(401 + i * 2), round_id: round.id, voter_player_id: player.id, song_id: songs[0].id, points: 1 },
    ]),
    comments: [{ id: id(500), round_id: round.id, song_id: songs[1].id, player_id: players[2].id, body: 'That opening bass line gets me every time.', created_at: '2026-01-01T12:00:00Z' }],
    bonus_comments: [{ id: id(501), round_id: round.id, song_id: id(300), player_id: players[2].id,
      body: 'The saxophone outro is the perfect way to end a drive.\nGreat bonus pick.', created_at: '2026-01-01T12:00:00Z' }],
    bonus_comment_likes: [],
    comment_likes: [], round_groups: [], duplicate_groups: [], duplicate_group_songs: [], round_playlists: [],
  }
  for (const song of [...rows.songs, ...rows.bonus_songs]) {
    song.artwork_url = previewArtwork[song.title] || null
  }
  const channels = new Set()
  function notify() { for (const channel of channels) for (const callback of channel.callbacks) callback({}) }
  const client = {
    channel() {
      const channel = { callbacks: [], on(_type, _filter, callback) { this.callbacks.push(callback); return this }, subscribe() { channels.add(this); return this } }
      return channel
    },
    removeChannel(channel) { channels.delete(channel) },
    from(table) {
      const field = (row, key) => {
        if (!key.includes('.')) return row[key]
        const [parent, column] = key.split('.')
        return rows[parent]?.find(item => item.id === row.comment_id)?.[column]
      }
      const filters = []; let operation = 'select', values, conflict, single = false
      const query = {
        select() { return this }, order() { return this },
        eq(key, value) { filters.push(row => field(row, key) === value); return this },
        in(key, list) { filters.push(row => list.includes(field(row, key))); return this },
        single() { single = true; return this }, maybeSingle() { single = true; return this },
        insert(value) { operation = 'insert'; values = value; return this },
        upsert(value, options = {}) { operation = 'upsert'; values = value; conflict = options.onConflict; return this },
        update(value) { operation = 'update'; values = value; return this },
        delete() { operation = 'delete'; return this },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (!rows[table]) throw new Error(`Unsupported preview table: ${table}`)
            const matches = row => filters.every(filter => filter(row))
            let result
            if (operation === 'select') result = rows[table].filter(matches)
            else if (operation === 'delete') { result = rows[table].filter(matches); rows[table] = rows[table].filter(row => !matches(row)) }
            else if (operation === 'update') { result = rows[table].filter(matches); result.forEach(row => Object.assign(row, values)) }
            else {
              result = (Array.isArray(values) ? values : [values]).map(value => {
                const keys = (conflict || 'id').split(',')
                const existing = operation === 'upsert' && rows[table].find(row => keys.every(key => value[key] !== undefined && field(row, key) === value[key]))
                if (existing) { Object.assign(existing, value); return existing }
                const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }
                rows[table].push(row); return row
              })
            }
            if (operation !== 'select') notify()
            result = result.map(row => ({ ...row, players: players.find(player => player.id === (row.player_id || row.submitted_by_player_id)) }))
            return { data: single ? result[0] || null : result, error: null }
          }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { client, players, settings }
}

export function installPreviewDatabase() {
  window.__BDF_PREVIEW__ = createPreviewDatabase()
}
