import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import MedalIcon from '../components/MedalIcon.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_PLAYER_DATA, fetchPlayerData, PLAYER_REALTIME_TABLES } from '../lib/data.js'
import { buildPlayerAwards } from '../lib/playerAwards.js'
import { preloadPlayerPage } from '../lib/routeLoaders.js'
import { buildFairScores, buildLeaderboard, buildTopSongsByPlayer } from '../lib/scoring.js'
import { getLeagueContext, getScoredRoundIds } from '../lib/schedule.js'

export default function PlayerListPage() {
  const { player } = usePlayer()
  const { settings } = useSettings()
  const fetcher = useCallback(() => fetchPlayerData(settings), [settings])
  const scoringScheduleKey = `${settings?.schedule_start_date || ''}:${JSON.stringify(settings?.weekly_phase_template || {})}`
  const { data, loading } = useRealtimeData({
    cacheKey: `player-standings:${scoringScheduleKey}`,
    channelName: 'players-season-2',
    fetcher,
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
  }), [data.players, data.rounds, data.songs, data.votes, data.groups, data.groupSongs, scoredRoundIds])
  const fairScores = useMemo(() => buildFairScores({
    songs: data.songs,
    votes: data.votes,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    roundGroups: data.roundGroups,
    scoredRoundIds,
    pointsPerPlayer: settings?.points_per_player || 10,
  }), [data.songs, data.votes, data.groups, data.groupSongs, data.roundGroups, scoredRoundIds, settings?.points_per_player])
  const rankedPlayers = useMemo(() => {
    const leaderboardMap = Object.fromEntries(leaderboard.map(row => [row.id, row]))
    return data.players
    .map(row => {
      const score = leaderboardMap[row.id]
      return {
        ...row,
        total: score?.total || 0,
        fairScore: fairScores[row.id]?.total || 0,
      }
    })
    .sort((a, b) => b.total - a.total || b.fairScore - a.fairScore || a.name.localeCompare(b.name))
  }, [data.players, leaderboard, fairScores])
  const topSongsByPlayerId = useMemo(() => buildTopSongsByPlayer({
    songs: data.songs,
    votes: data.votes,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    scoredRoundIds,
  }), [data.songs, data.votes, data.groups, data.groupSongs, scoredRoundIds])
  const latestScoredRound = scoredRounds[scoredRounds.length - 1]
  const awardsByPlayerId = useMemo(() => buildPlayerAwards({
    players: data.players,
    rounds: data.rounds,
    songs: data.songs,
    votes: data.votes,
    comments: data.comments,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    roundGroups: data.roundGroups,
    scoredRoundIds,
    pointsPerPlayer: settings?.points_per_player || 10,
    leaderboard,
    fairScores,
    latestScoredRoundId: latestScoredRound?.id || null,
  }), [
    data.players,
    data.rounds,
    data.songs,
    data.votes,
    data.comments,
    data.groups,
    data.groupSongs,
    data.roundGroups,
    scoredRoundIds,
    settings?.points_per_player,
    leaderboard,
    fairScores,
    latestScoredRound?.id,
  ])
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
          <h1>Players</h1>
        </div>
      </section>

      <section className="round-section">
        {rankedPlayers.length === 0 ? (
          <div className="empty-state compact">
            <p>No players yet.</p>
          </div>
        ) : (
          <div className="card leaderboard-list player-standings-list">
            {rankedPlayers.map((row, index) => {
              const topSong = topSongsByPlayerId[row.id]

              return (
                <Link
                  className={`leader-row player-standings-row player-row-link ${row.active ? '' : 'inactive'}`}
                  to={`/players/${row.id}`}
                  key={row.id}
                  onFocus={preloadPlayerPage}
                  onPointerEnter={preloadPlayerPage}
                >
                  <span className="rank">{index + 1}</span>
                  <Avatar player={row} linkToProfile={false} />
                  <span className="leader-name">
                    {row.name}{row.id === player.id ? ' (you)' : ''}
                    {topSong && <small className="player-top-song">Top song: {topSong.title} · {topSong.artist}</small>}
                    <span className="player-badges">
                      {(awardsByPlayerId[row.id] || []).map(award => (
                        <em className={award.className} title={award.title} key={award.key}>
                          <MedalIcon name={award.icon} />
                          {award.label}
                        </em>
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
