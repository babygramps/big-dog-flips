import { groupLabel, sideOf, sidesForRound } from './groups.js'
import { listeningOrderFor } from './listeningOrder.js'
import { addDays, getLeagueContext, phaseForDateKey } from './schedule.js'

export const TUNEMYMUSIC_SERVICE = 'TuneMyMusic'

// Songs are final once submission closes. The nightly run acts only on the night it
// closes; the admin button can fill in a missing link any time after that.
const SHARE_PHASES = new Set(['voting', 'appreciation'])

function submissionEndedLastMidnight(settings, context) {
  return context.phase !== 'submission' && phaseForDateKey(settings, addDays(context.today, -1)) === 'submission'
}

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

function bonusJob({ round, settings, bonusSongs, bonusPlaylists }) {
  if (!bonusSongs.length || bonusPlaylists.some(row => row.service === TUNEMYMUSIC_SERVICE)) return []
  const leagueName = settings?.league_name || 'Big Dog Flips'
  return [{
    side: 1,
    bonus: true,
    title: `${leagueName} · ${round.theme_name} · Side B · Extra picks`,
    username: leagueName,
    songs: listeningOrderFor(bonusSongs, { roundId: round.id, playerId: 'tunemymusic-share' }),
  }]
}

// The nightly job (trigger 'nightly') and the admin button (trigger 'manual') both
// call this. It only adds links that are missing, so running it again is harmless.
export async function syncTuneMyMusicPlaylists({ store, createShare, now = new Date(), trigger = 'manual' }) {
  const { settings, rounds } = await store.loadSchedule()
  const context = getLeagueContext(rounds, settings, now)
  const round = context.currentRound
  const ready = trigger === 'nightly' ? submissionEndedLastMidnight(settings, context) : SHARE_PHASES.has(context.phase)
  if (!round || !ready) return { status: 'not-ready', created: [], failed: [] }

  const { songs, roundGroups, playlists, bonusSongs = [], bonusPlaylists = [] } = await store.loadRound(round.id)
  const created = []
  const failed = []

  const jobs = [
    ...sideJobs({ round, settings, songs, roundGroups, playlists }),
    ...bonusJob({ round, settings, bonusSongs, bonusPlaylists }),
  ]
  for (const job of jobs) {
    try {
      const { url } = await createShare({ title: job.title, username: job.username, songs: job.songs })
      const row = { round_id: round.id, group_index: job.bonus ? 0 : job.side, service: TUNEMYMUSIC_SERVICE, url }
      if (job.bonus) await store.saveBonusPlaylist(row)
      else await store.savePlaylist(row)
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
