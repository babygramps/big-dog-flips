import { useCallback, useMemo } from 'react'
import { usePlayer, useSettings } from '../App.jsx'
import PlayerSubmissionCard from '../components/PlayerSubmissionCard.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import {
  EMPTY_PAST_SONGS_DATA,
  fetchPastSongsData,
  PAST_SONGS_REALTIME_TABLES,
} from '../lib/data.js'
import { sidesForRound } from '../lib/groups.js'
import { buildSongEntries } from '../lib/scoring.js'
import { getRoundWeekStart, getScoredRoundIds, sortedRounds } from '../lib/schedule.js'
import { indexCommentLikes, indexCommentsBySongId } from './home/homeUtils.js'

export default function PastSongsPage() {
  const { player } = usePlayer()
  const { settings } = useSettings()
  const fetcher = useCallback(() => fetchPastSongsData(settings), [settings])
  const scoringScheduleKey = `${settings?.schedule_start_date || ''}:${JSON.stringify(settings?.weekly_phase_template || {})}`
  const { data, loading, reload } = useRealtimeData({
    cacheKey: `past-songs:${scoringScheduleKey}`,
    channelName: 'past-songs-season-2',
    fetcher,
    initialData: EMPTY_PAST_SONGS_DATA,
    tables: PAST_SONGS_REALTIME_TABLES,
  })

  const scoredRoundIds = useMemo(
    () => getScoredRoundIds(data.rounds, settings),
    [data.rounds, settings],
  )
  const commentsBySongId = useMemo(
    () => indexCommentsBySongId(data.comments),
    [data.comments],
  )
  const commentLikesIndex = useMemo(
    () => indexCommentLikes(data.commentLikes),
    [data.commentLikes],
  )
  const pastSongs = useMemo(() => {
    const submissions = sortedRounds(data.rounds)
      .map((round, index) => ({ round, index }))
      .filter(({ round }) => scoredRoundIds.has(round.id))
      .flatMap(({ round, index: roundIndex }) => {
        const roundSongs = data.songs.filter(song => song.round_id === round.id)
        const roundVotes = data.votes.filter(vote => vote.round_id === round.id)
        const roundGroups = data.groups.filter(group => group.round_id === round.id)
        const groupIds = new Set(roundGroups.map(group => group.id))
        const roundGroupSongs = data.groupSongs.filter(row => groupIds.has(row.group_id))
        const sides = sidesForRound(data.roundGroups, round.id)
        const entries = buildSongEntries({
          songs: roundSongs,
          votes: roundVotes,
          duplicateGroups: roundGroups,
          groupSongs: roundGroupSongs,
          sideByPlayerId: sides.isSplit ? sides.sideByPlayerId : null,
        })

        return entries.map(entry => ({
          id: `${round.id}:${entry.id}`,
          round,
          weekStart: getRoundWeekStart(settings, round, roundIndex),
          entry,
          song: entry.songs?.find(song => song.id === entry.canonical_song_id) || entry.songs?.[0],
        }))
      })
      .sort((a, b) => (
        b.entry.totalPoints - a.entry.totalPoints ||
        a.entry.title.localeCompare(b.entry.title) ||
        a.round.theme_name.localeCompare(b.round.theme_name)
      ))

    let rank = 0
    let previousScore = null
    return submissions.map((submission, index) => {
      if (submission.entry.totalPoints !== previousScore) {
        rank = index + 1
        previousScore = submission.entry.totalPoints
      }
      return { ...submission, globalRank: rank }
    })
  }, [
    data.rounds,
    data.songs,
    data.votes,
    data.groups,
    data.groupSongs,
    data.roundGroups,
    scoredRoundIds,
    settings,
  ])

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading songs...</p>
      </main>
    )
  }

  return (
    <main className="page past-songs-page">
      <section className="page-header">
        <div>
          <h1>Past songs</h1>
          <p>Every scored song, from highest score to lowest.</p>
        </div>
      </section>

      <section className="round-section">
        {pastSongs.length === 0 ? (
          <div className="empty-state compact">
            <p>No scored songs yet.</p>
          </div>
        ) : (
          <div className="past-song-stack">
            {pastSongs.map(submission => (
              <div className="past-song-ranked-row" key={submission.id}>
                <div className="past-song-rank" aria-label={`Season rank ${submission.globalRank}`}>
                  <span>#</span>
                  <strong>{submission.globalRank}</strong>
                </div>
                <PlayerSubmissionCard
                  submission={submission}
                  comments={data.comments}
                  commentsBySongId={commentsBySongId}
                  commentLikes={data.commentLikes}
                  commentLikesIndex={commentLikesIndex}
                  player={player}
                  onChanged={reload}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
