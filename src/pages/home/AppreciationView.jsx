import { useEffect, useMemo, useState } from 'react'
import SideRoster from '../../components/SideRoster.jsx'
import { groupLabel } from '../../lib/groups.js'
import { buildSongEntries, rankEntries } from '../../lib/scoring.js'
import AppreciationSongCard from './AppreciationSongCard.jsx'
import PlaylistPanel from './PlaylistPanel.jsx'

export default function AppreciationView({ round, player, songs, votes, comments, commentLikes, duplicateGroups, groupSongs, playlists = [], allPlayers = [], sides, onChanged }) {
  const entries = useMemo(() => buildSongEntries({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    sideByPlayerId: sides?.isSplit ? sides.sideByPlayerId : null,
  }), [songs, votes, duplicateGroups, groupSongs, sides])

  const rankedEntries = useMemo(() => rankEntries(entries), [entries])
  const submittedIds = useMemo(() => new Set(songs.map(song => song.player_id)), [songs])
  const voterIds = useMemo(() => new Set(
    votes.filter(vote => Number(vote.points) > 0).map(vote => vote.voter_player_id)
  ), [votes])
  const isSplit = Boolean(sides?.isSplit)
  const playerSide = sides?.sideByPlayerId?.[player.id]
  const defaultSide = playerSide === 0 || playerSide === 1 ? playerSide : 0
  const [activeSide, setActiveSide] = useState(defaultSide)

  useEffect(() => {
    setActiveSide(defaultSide)
  }, [round.id, defaultSide])

  const sideOrder = isSplit ? [defaultSide, 1 - defaultSide] : []
  const activeEntries = isSplit
    ? rankedEntries.filter(entry => entry.side === activeSide)
    : rankedEntries
  const activePlaylists = isSplit
    ? playlists.filter(playlist => playlist.group_index === activeSide)
    : playlists

  return (
    <section className="phase-layout appreciation-layout">
      <aside className="side-panel appreciation-roster">
        <p className="eyebrow">Round roll call</p>
        <p className="roster-summary">{submittedIds.size}/{allPlayers.length} songs · {voterIds.size}/{allPlayers.length} voted</p>
        {isSplit ? (
          <div className="voting-sides">
            {sideOrder.map((side, index) => (
              <div className={`voting-side-roster ${index > 0 ? 'is-other' : ''}`} key={side}>
                <h3 className={`side-name side-${side}`}>{groupLabel(side)}</h3>
                <SideRoster
                  players={allPlayers.filter(row => sides.sideByPlayerId[row.id] === side)}
                  submittedIds={submittedIds}
                  completedIds={voterIds}
                  currentPlayerId={player.id}
                  showSubmissionStatus
                  showVoteStatus
                  voteStatusFinal
                />
              </div>
            ))}
          </div>
        ) : (
          <SideRoster
            players={allPlayers}
            submittedIds={submittedIds}
            completedIds={voterIds}
            currentPlayerId={player.id}
            showSubmissionStatus
            showVoteStatus
            voteStatusFinal
          />
        )}
      </aside>

      <section className="song-stack">
        {isSplit && (
          <div className="phase-toolbar">
            <div className="group-tabs" role="tablist" aria-label="Appreciation side">
              {sideOrder.map(side => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSide === side}
                  className={`group-tab ${activeSide === side ? 'is-active' : ''}`}
                  onClick={() => setActiveSide(side)}
                  key={side}
                >
                  {groupLabel(side)}
                </button>
              ))}
            </div>
          </div>
        )}

        <PlaylistPanel playlists={activePlaylists} />

        <div className="ranking-heading">
          <p className="eyebrow">Final ranking</p>
          {isSplit && <p>Overall places · showing {groupLabel(activeSide)}</p>}
        </div>

        {activeEntries.length === 0 ? (
          <div className="empty-state">
            <h2>No songs to reveal</h2>
            <p>{isSplit ? `Nobody on ${groupLabel(activeSide)} submitted a song.` : 'This round did not receive submissions.'}</p>
          </div>
        ) : activeEntries.map(entry => (
          <AppreciationSongCard
            key={entry.id}
            entry={entry}
            comments={comments}
            commentLikes={commentLikes}
            player={player}
            roundId={round.id}
            onChanged={onChanged}
            isTopEntry={entry.rank === 1 && entry.totalPoints > 0}
          />
        ))}
      </section>
    </section>
  )
}
