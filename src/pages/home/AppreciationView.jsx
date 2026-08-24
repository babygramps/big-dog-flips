import { useEffect, useMemo, useState } from 'react'
import Avatar from '../../components/Avatar.jsx'
import SideRoster from '../../components/SideRoster.jsx'
import { groupLabel } from '../../lib/groups.js'
import { buildSongEntries, rankEntries } from '../../lib/scoring.js'
import CommentThread from './CommentThread.jsx'
import { commentsForEntry, playerName } from './homeUtils.js'
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
          <article className={`song-card revealed ${entry.rank === 1 && entry.totalPoints > 0 ? 'top-entry' : ''}`} key={entry.id}>
            <div className="results-row">
              <div className="song-card-main">
                <span className="song-number">{entry.rank}</span>
                <div>
                  <div className="section-heading compact">
                    <h2>{entry.title}</h2>
                    {entry.isDuplicate && <span className="soft-tag">Merged duplicate</span>}
                  </div>
                  <p>{entry.artist}{entry.album ? ` · ${entry.album}` : ''}</p>
                  <div className="submitter-line">
                    {entry.submitters.map(submitter => (
                      <span key={submitter.id}>
                        <Avatar player={submitter} size="sm" />
                        {playerName(submitter)}
                      </span>
                    ))}
                  </div>
                  {entry.submitter_note && <p className="note">{entry.submitter_note}</p>}
                  {entry.isDuplicate && (
                    <p className="merge-note">
                      {entry.votePoints} vote pts + {entry.courtesyPoints} courtesy pt{entry.courtesyPoints === 1 ? '' : 's'}
                      {entry.ineligiblePoints > 0 ? ` · ${entry.ineligiblePoints} self-vote pt${entry.ineligiblePoints === 1 ? '' : 's'} removed` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="score-badge">
                <strong>{entry.totalPoints}</strong>
                <span>pts</span>
              </div>
            </div>

            <CommentThread
              comments={commentsForEntry(comments, entry)}
              commentLikes={commentLikes}
              player={player}
              revealAuthors
              songId={entry.canonical_song_id}
              onChanged={onChanged}
              roundId={round.id}
            />
          </article>
        ))}
      </section>
    </section>
  )
}
