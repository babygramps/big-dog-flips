import { useEffect, useMemo, useState } from 'react'
import SideRoster from '../../components/SideRoster.jsx'
import { groupLabel } from '../../lib/groups.js'
import { buildSongEntries, rankEntries } from '../../lib/scoring.js'
import { votePointsByPlayer } from '../../lib/voteProgress.js'
import AppreciationSongCard from './AppreciationSongCard.jsx'
import { indexCommentLikes, indexCommentsBySongId } from './homeUtils.js'
import PlaylistPanel from './PlaylistPanel.jsx'

export default function AppreciationView({ round, player, songs, votes, comments, commentLikes, duplicateGroups, groupSongs, playlists = [], allPlayers = [], pointsTotal = 3, sides, onChanged }) {
  const entries = useMemo(() => buildSongEntries({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    sideByPlayerId: sides?.isSplit ? sides.sideByPlayerId : null,
  }), [songs, votes, duplicateGroups, groupSongs, sides])

  const rankedEntries = useMemo(() => rankEntries(entries), [entries])
  const submittedIds = useMemo(() => new Set(songs.map(song => song.player_id)), [songs])
  const rosterVotePoints = useMemo(() => votePointsByPlayer(votes), [votes])
  const commentsBySongId = useMemo(() => indexCommentsBySongId(comments), [comments])
  const commentLikesIndex = useMemo(() => indexCommentLikes(commentLikes), [commentLikes])
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
        {isSplit ? (
          <div className="voting-sides">
            {sideOrder.map(side => (
              <div className={`voting-side-roster roster-side-${side}`} key={side}>
                <h3 className={`side-name side-${side}`}>{groupLabel(side)}</h3>
                <SideRoster
                  players={allPlayers.filter(row => sides.sideByPlayerId[row.id] === side)}
                  submittedIds={submittedIds}
                  votePointsByPlayer={rosterVotePoints}
                  pointsTotal={pointsTotal}
                  currentPlayerId={player.id}
                  phase="appreciation"
                />
              </div>
            ))}
          </div>
        ) : (
          <SideRoster
            players={allPlayers}
            submittedIds={submittedIds}
            votePointsByPlayer={rosterVotePoints}
            pointsTotal={pointsTotal}
            currentPlayerId={player.id}
            phase="appreciation"
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

        <PlaylistPanel
          playlists={activePlaylists}
          roundId={round.id}
          side={activeSide}
          onChanged={onChanged}
        />

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
            commentsBySongId={commentsBySongId}
            commentLikes={commentLikes}
            commentLikesIndex={commentLikesIndex}
            player={player}
            roundId={round.id}
            onChanged={onChanged}
          />
        ))}
      </section>
    </section>
  )
}
