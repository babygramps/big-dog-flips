import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_HOME_DATA, fetchPastRoundData, pastRoundRealtimeTables } from '../lib/data.js'
import { sidesForRound } from '../lib/groups.js'
import { formatPacificDate, getRoundState, getRoundTiming, pacificDateTimeToUtc, sortedRounds } from '../lib/schedule.js'
import AppreciationView from './home/AppreciationView.jsx'

export default function PastRoundPage() {
  const { roundId } = useParams()
  const { player } = usePlayer()
  const { settings } = useSettings()
  const fetcher = useCallback(() => fetchPastRoundData(roundId), [roundId])
  const realtimeTables = useMemo(() => pastRoundRealtimeTables(roundId), [roundId])
  const { data, loading, reload } = useRealtimeData({
    cacheKey: `past-round:${roundId}`,
    channelName: `past-round-${roundId}`,
    fetcher,
    initialData: EMPTY_HOME_DATA,
    tables: realtimeTables,
  })

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading round history...</p>
      </main>
    )
  }

  const orderedRounds = sortedRounds(data.rounds)
  const roundIndex = orderedRounds.findIndex(round => round.id === roundId)
  const round = orderedRounds[roundIndex]

  if (!round) {
    return (
      <main className="page">
        <section className="empty-state">
          <h1>Round not found</h1>
          <p>This round is not in the active season history.</p>
          <Link className="btn btn-secondary" to="/rounds">Back to rounds</Link>
        </section>
      </main>
    )
  }

  const timing = getRoundTiming(round, roundIndex, settings)
  const state = getRoundState(round, roundIndex, settings)

  if (state !== 'past') {
    return (
      <main className="page">
        <section className="empty-state">
          <h1>This round is not history yet</h1>
          <p>Its full scorecard will live here after the week ends.</p>
          <Link className="btn btn-secondary" to={state === 'current' ? '/' : '/rounds'}>
            {state === 'current' ? 'Go to current round' : 'Back to rounds'}
          </Link>
        </section>
      </main>
    )
  }

  const songs = data.songs.filter(song => song.round_id === round.id)
  const votes = data.votes.filter(vote => vote.round_id === round.id)
  const comments = data.comments.filter(comment => comment.round_id === round.id)
  const duplicateGroups = data.duplicateGroups.filter(group => group.round_id === round.id)
  const duplicateGroupIds = new Set(duplicateGroups.map(group => group.id))
  const groupSongs = data.groupSongs.filter(row => duplicateGroupIds.has(row.group_id))
  const playlists = data.playlists.filter(playlist => playlist.round_id === round.id)
  const sides = sidesForRound(data.roundGroups, round.id)
  const allPlayers = playersForHistoricalRound({
    players: data.players,
    songs,
    votes,
    comments,
    sides,
    weekEnd: timing.weekEnd,
  })

  return (
    <main className="page">
      <section className="hero-surface past-round-hero">
        <div className="hero-topline">
          <Link className="past-round-back" to="/rounds">← All rounds</Link>
          <span className="phase-pill phase-appreciation">Past round</span>
        </div>
        <p className="eyebrow">Week of {formatPacificDate(timing.weekStart)}</p>
        <h1>{round.theme_name}</h1>
        {round.theme_description && <p>{round.theme_description}</p>}
        {round.players && (
          <div className="round-meta">
            <span>
              <Avatar player={round.players} size="xs" />
              Added by {round.players.name}
            </span>
          </div>
        )}
      </section>

      <AppreciationView
        round={round}
        player={player}
        songs={songs}
        votes={votes}
        comments={comments}
        commentLikes={data.commentLikes}
        duplicateGroups={duplicateGroups}
        groupSongs={groupSongs}
        playlists={playlists}
        allPlayers={allPlayers}
        pointsTotal={settings?.points_per_player || 3}
        sides={sides}
        onChanged={reload}
      />
    </main>
  )
}

function playersForHistoricalRound({ players, songs, votes, comments, sides, weekEnd }) {
  if (sides.isSplit) {
    return players.filter(player => sides.sideByPlayerId[player.id] === 0 || sides.sideByPlayerId[player.id] === 1)
  }

  // Split rounds snapshot their roster in round_groups. For older unsplit rounds, include every
  // profile that existed before the round ended, plus anyone whose activity proves participation.
  const participantIds = new Set([
    ...songs.map(song => song.player_id),
    ...votes.map(vote => vote.voter_player_id),
    ...comments.map(comment => comment.player_id),
  ])
  const roundEndedAt = pacificDateTimeToUtc(weekEnd)

  return players.filter(player => {
    if (participantIds.has(player.id) || !player.created_at) return true
    const createdAt = new Date(player.created_at)
    return !Number.isNaN(createdAt.getTime()) && createdAt < roundEndedAt
  })
}
