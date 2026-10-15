import { groupLabel, sideOf, sidesForRound } from './groups.js'
import { listeningOrderFor } from './listeningOrder.js'
import { getLeagueContext } from './schedule.js'

export const TUNEMYMUSIC_SERVICE = 'TuneMyMusic'

// Songs are final once submission closes, so shares are made from voting onward.
// Appreciation is included so a night when TuneMyMusic was down gets retried.
const SHARE_PHASES = new Set(['voting', 'appreciation'])

function sideJobs({ round, settings, songs, roundGroups, playlists }) {
  const leagueName = settings?.league_name || 'Big Dog Flips'
  const sides = sidesForRound(roundGroups, round.id)
  const sideIndexes = sides.isSplit ? [0, 1] : [0]

  return sideIndexes
    .filter(side => !playlists.some(row => row.group_index === side && row.service === TUNEMYMUSIC_SERVICE))
    .map(side => ({
      side,
      title: sides.isSplit ? `${leagueName} · ${round.theme_name} · ${groupLabel(side)}` : `${leagueName} · ${round.theme_name}`,
      username: leagueName,
      // A fixed per-round shuffle, so the playlist never reveals who submitted first.
      songs: listeningOrderFor(
        songs.filter(song => !sides.isSplit || sideOf(sides, song.player_id) === side),
        { roundId: round.id, playerId: 'tunemymusic-share' },
      ),
    }))
    .filter(job => job.songs.length > 0)
}

// The nightly job and the admin button both call this. It only adds links that are
// missing, so running it again is harmless.
export async function syncTuneMyMusicPlaylists({ store, createShare, now = new Date() }) {
  const { settings, rounds } = await store.loadSchedule()
  const context = getLeagueContext(rounds, settings, now)
  const round = context.currentRound
  if (!round || !SHARE_PHASES.has(context.phase)) return { status: 'not-ready', created: [], failed: [] }

  const { songs, roundGroups, playlists } = await store.loadRound(round.id)
  const created = []
  const failed = []

  for (const job of sideJobs({ round, settings, songs, roundGroups, playlists })) {
    try {
      const { url } = await createShare({ title: job.title, username: job.username, songs: job.songs })
      await store.savePlaylist({ round_id: round.id, group_index: job.side, service: TUNEMYMUSIC_SERVICE, url })
      created.push({ groupIndex: job.side, url })
    } catch (error) {
      failed.push({ groupIndex: job.side, error: error.message })
    }
  }

  return { status: 'done', created, failed }
}

export function playlistSyncMessage({ status, created = [], failed = [] }) {
  if (status === 'not-ready') return 'The current round is not in voting yet, so there is nothing to share.'
  if (!created.length && !failed.length) return 'Every side already has a TuneMyMusic link.'

  const parts = []
  if (created.length) parts.push(`Made ${created.length} ${created.length === 1 ? 'link' : 'links'}.`)
  for (const { groupIndex, error } of failed) parts.push(`${groupLabel(groupIndex)}: ${error}`)
  return parts.join(' ')
}
