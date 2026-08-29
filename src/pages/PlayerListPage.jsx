import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_PLAYER_DATA, fetchPlayerData, PLAYER_REALTIME_TABLES } from '../lib/data.js'
import { buildPlayerAwards } from '../lib/playerAwards.js'
import { buildLeaderboard, buildSongEntries } from '../lib/scoring.js'
import { getLeagueContext, getScoredRoundIds } from '../lib/schedule.js'

export default function PlayerListPage() {
  const { player } = usePlayer()
  const { settings } = useSettings()
  const { data, loading } = useRealtimeData({
    channelName: 'players-season-2',
    fetcher: fetchPlayerData,
    initialData: EMPTY_PLAYER_DATA,
    tables: PLAYER_REALTIME_TABLES,
  })

  const scoredRoundIds = useMemo(() => getScoredRoundIds(data.rounds, settings), [data.rounds, settings])
  const context = useMemo(() => getLeagueContext(data.rounds, settings), [data.rounds, settings])
  const scoredRounds = context.orderedRounds.filter(round => scoredRoundIds.has(round.id))
  const leaderboard = useMemo(() => buildLeaderboard({
    players: data.players,
    rounds: data.rounds,
    songs: data.songs,
    votes: data.votes,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    scoredRoundIds,
  }), [data, scoredRoundIds])
  const leaderboardMap = Object.fromEntries(leaderboard.map(row => [row.id, row]))
  const submissionCounts = data.songs.reduce((counts, song) => {
    if (!scoredRoundIds.has(song.round_id)) return counts
    counts[song.player_id] = (counts[song.player_id] || 0) + 1
    return counts
  }, {})
  const votedRoundIdsByPlayer = data.votes.reduce((roundsByPlayer, vote) => {
    if (!scoredRoundIds.has(vote.round_id) || Number(vote.points) <= 0) return roundsByPlayer
    if (!roundsByPlayer[vote.voter_player_id]) roundsByPlayer[vote.voter_player_id] = new Set()
    roundsByPlayer[vote.voter_player_id].add(vote.round_id)
    return roundsByPlayer
  }, {})
  const rankedPlayers = data.players
    .map(row => {
      const score = leaderboardMap[row.id]
      return {
        ...row,
        total: score?.total || 0,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const latestScoredRound = scoredRounds[scoredRounds.length - 1]
  const latestWinnerIds = useMemo(() => {
    if (!latestScoredRound) return new Set()
    const roundSongs = data.songs.filter(song => song.round_id === latestScoredRound.id)
    const roundVotes = data.votes.filter(vote => vote.round_id === latestScoredRound.id)
    const roundGroups = data.groups.filter(group => group.round_id === latestScoredRound.id)
    const groupIds = new Set(roundGroups.map(group => group.id))
    const roundGroupSongs = data.groupSongs.filter(row => groupIds.has(row.group_id))
    const winner = buildSongEntries({
      songs: roundSongs,
      votes: roundVotes,
      duplicateGroups: roundGroups,
      groupSongs: roundGroupSongs,
    })[0]
    return new Set(winner?.submitterIds || [])
  }, [data, latestScoredRound])
  const awardsByPlayerId = useMemo(() => buildPlayerAwards({
    players: data.players,
    songs: data.songs,
    votes: data.votes,
    comments: data.comments,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    roundGroups: data.roundGroups,
    scoredRoundIds,
    pointsPerPlayer: settings?.points_per_player || 10,
  }), [data, scoredRoundIds, settings?.points_per_player])
  const activeCount = data.players.filter(row => row.active).length

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading players...</p>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Season standings</p>
          <h1>Players</h1>
          <p>Standings and profiles. Open a past round in Rounds for its full scorecard.</p>
        </div>
      </section>

      <section className="round-section">
        <div className="section-heading">
          <h2>Standings</h2>
          <span className="soft-tag">{activeCount} active</span>
        </div>
        {rankedPlayers.length === 0 ? (
          <div className="empty-state compact">
            <p>No players yet.</p>
          </div>
        ) : (
          <div className="card leaderboard-list player-standings-list">
            {rankedPlayers.map((row, index) => {
              const submissionCount = submissionCounts[row.id] || 0
              const votedRoundCount = votedRoundIdsByPlayer[row.id]?.size || 0
              const isFirstPlace = index === 0 && row.total > 0

              return (
                <Link
                  className={`leader-row player-standings-row player-row-link ${isFirstPlace ? 'is-first-place' : ''} ${row.id === player.id ? 'is-you' : ''} ${row.active ? '' : 'inactive'}`}
                  to={`/players/${row.id}`}
                  key={row.id}
                >
                  <span className="rank">{index + 1}</span>
                  <Avatar player={row} linkToProfile={false} />
                  <span className="leader-name">
                    {row.name}{row.id === player.id ? ' (you)' : ''}
                    <small>
                      {submissionCount} submission{submissionCount === 1 ? '' : 's'} · voted in {votedRoundCount} round{votedRoundCount === 1 ? '' : 's'}
                      {row.active ? '' : ' · inactive'}
                    </small>
                    <span className="player-badges">
                      {isFirstPlace && <em className="badge-leader">Current leader</em>}
                      {latestWinnerIds.has(row.id) && <em className="badge-winner">Latest winner</em>}
                      {(awardsByPlayerId[row.id] || []).map(award => (
                        <em className={award.className} title={award.title} key={award.key}>{award.label}</em>
                      ))}
                    </span>
                  </span>
                  <strong>{row.total}</strong>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
