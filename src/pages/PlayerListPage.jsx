import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import MedalIcon from '../components/MedalIcon.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_PLAYER_DATA, fetchPlayerData, PLAYER_REALTIME_TABLES } from '../lib/data.js'
import { buildPlayerAwards } from '../lib/playerAwards.js'
import { preloadPlayerPage } from '../lib/routeLoaders.js'
import { buildLeaderboard } from '../lib/scoring.js'
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
  const rankedPlayers = useMemo(() => {
    const leaderboardMap = Object.fromEntries(leaderboard.map(row => [row.id, row]))
    return data.players
    .map(row => {
      const score = leaderboardMap[row.id]
      return {
        ...row,
        total: score?.total || 0,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  }, [data.players, leaderboard])
  const latestScoredRound = scoredRounds[scoredRounds.length - 1]
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
    leaderboard,
    latestScoredRoundId: latestScoredRound?.id || null,
  }), [
    data.players,
    data.songs,
    data.votes,
    data.comments,
    data.groups,
    data.groupSongs,
    data.roundGroups,
    scoredRoundIds,
    settings?.points_per_player,
    leaderboard,
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
          <p className="eyebrow">Season standings</p>
          <h1>Players</h1>
          <p>Standings and profiles. Open a past round in Rounds for its full scorecard.</p>
        </div>
      </section>

      <section className="round-section">
        <div className="section-heading">
          <h2>Standings</h2>
        </div>
        {rankedPlayers.length === 0 ? (
          <div className="empty-state compact">
            <p>No players yet.</p>
          </div>
        ) : (
          <div className="card leaderboard-list player-standings-list">
            {rankedPlayers.map((row, index) => {
              const isFirstPlace = index === 0 && row.total > 0

              return (
                <Link
                  className={`leader-row player-standings-row player-row-link ${isFirstPlace ? 'is-first-place' : ''} ${row.id === player.id ? 'is-you' : ''} ${row.active ? '' : 'inactive'}`}
                  to={`/players/${row.id}`}
                  key={row.id}
                  onFocus={preloadPlayerPage}
                  onPointerEnter={preloadPlayerPage}
                >
                  {isFirstPlace && <FirstPlaceParty />}
                  <span className="rank">{index + 1}</span>
                  <Avatar player={row} linkToProfile={false} />
                  <span className="leader-name">
                    {row.name}{row.id === player.id ? ' (you)' : ''}
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

function FirstPlaceParty() {
  return (
    <span className="first-place-party" aria-hidden="true">
      <span className="first-place-party-beams" />
      <PartyDancer className="dancer-one" pose="reach" />
      <PartyDancer className="dancer-two" pose="lean" />
      <PartyDancer className="dancer-three" pose="disco" />
      <PartyDancer className="dancer-four" pose="shimmy" />
      <PartyDancer className="dancer-five" pose="jump" />
      <span className="first-place-note note-one">♪</span>
      <span className="first-place-note note-two">♫</span>
      <span className="first-place-note note-three">♬</span>
      <span className="first-place-note note-four">♩</span>
      <span className="first-place-note note-five">♪</span>
      <span className="first-place-note note-six">♫</span>
      <span className="first-place-note note-seven">♬</span>
    </span>
  )
}

function PartyDancer({ className, pose }) {
  return (
    <svg className={`first-place-dancer ${className}`} viewBox="0 0 56 76" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="28" cy="12" r="7" />
      {pose === 'reach' && <path d="M28 20v27M28 27 15 17 8 25M28 27l13-14 7 5M28 47 16 64M28 47l13 17M10 65h8M39 65h9" />}
      {pose === 'lean' && <path d="M28 20 25 46M27 27 13 36 7 30M27 27l12 8 9-12M25 46 12 59M25 46l17 12M8 60h7M40 59h9" />}
      {pose === 'disco' && <path d="M28 20 30 47M29 27 17 33 8 27M29 27l10-17 6-5M30 47 18 65M30 47l15 14M12 66h8M43 62h8" />}
      {pose === 'shimmy' && <path d="M28 20 25 47M27 28 16 24 10 31M27 28l12 6 8-7M25 47 11 57M25 47l18 10M8 59h8M41 59h9" />}
      {pose === 'jump' && <path d="M28 20v25M28 27 12 16M28 27l16-11M28 45 14 62M28 45l15 17M8 63h8M41 63h9" />}
    </svg>
  )
}
