import { createClient } from '@supabase/supabase-js'
import { syncTuneMyMusicPlaylists } from '../src/lib/roundPlaylists.js'
import { createTuneMyMusicShare } from '../src/lib/tuneMyMusic.js'

// Vercel's cron (see vercel.json) sends a GET every night; the run only does anything on
// the night submission closes. The admin button sends a POST, which fills in a missing
// link any time during voting or appreciation. Repeat calls are harmless.

async function rows(query, failure) {
  const { data, error } = await query
  if (error) throw new Error(failure)
  return data || []
}

function supabaseStore(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  return {
    async loadSchedule() {
      const [settings] = await rows(
        db.from('league_settings').select('league_name, weekly_phase_template, schedule_start_date').eq('id', 1),
        'Could not load the league settings.',
      )
      const rounds = await rows(
        db.from('rounds').select('id, theme_name, queue_position, week_start_date, is_archived, created_at').order('queue_position'),
        'Could not load the rounds.',
      )
      return { settings: settings || null, rounds }
    },
    async loadRound(roundId) {
      const [songs, roundGroups, playlists] = await Promise.all([
        rows(db.from('songs').select('id, round_id, player_id, artist, title, album').eq('round_id', roundId), 'Could not load the songs.'),
        rows(db.from('round_groups').select('round_id, player_id, group_index').eq('round_id', roundId), 'Could not load the sides.'),
        rows(db.from('round_playlists').select('round_id, group_index, service, url').eq('round_id', roundId), 'Could not load the playlists.'),
      ])
      return { songs, roundGroups, playlists }
    },
    async savePlaylist(row) {
      const { error } = await db.from('round_playlists').insert(row)
      if (error) throw new Error('Made the share but could not save its link.')
    },
  }
}

export function roundPlaylistsHandler({ makeStore = supabaseStore, createShare = createTuneMyMusicShare, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Use GET or POST to make playlist links.' })
    }

    const store = makeStore()
    if (!store) return res.status(500).json({ error: 'The server is missing its Supabase settings.' })

    try {
      const trigger = req.method === 'GET' ? 'nightly' : 'manual'
      const result = await syncTuneMyMusicPlaylists({ store, createShare, now: now(), trigger })
      return res.status(200).json(result)
    } catch (error) {
      return res.status(502).json({ error: error.message || 'Could not make playlist links.' })
    }
  }
}

export default roundPlaylistsHandler()
