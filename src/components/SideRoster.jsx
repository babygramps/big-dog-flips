import Avatar from './Avatar.jsx'
import { VOTE_PROGRESS, voteProgressFor } from '../lib/voteProgress.js'

export default function SideRoster({
  players = [],
  submittedIds,
  votePointsByPlayer,
  pointsTotal = 3,
  currentPlayerId,
  phase = 'submission',
}) {
  if (players.length === 0) {
    return <p className="muted">Nobody here yet.</p>
  }

  const showVoteStatus = phase === 'voting' || phase === 'appreciation'

  return (
    <div className="mini-roster">
      {players.map(player => {
        const hasSubmitted = submittedIds?.has(player.id) || false
        const voteProgress = voteProgressFor(
          votePointsByPlayer?.get(player.id),
          pointsTotal,
          { final: phase === 'appreciation' }
        )
        const actionState = phase === 'submission'
          ? hasSubmitted ? VOTE_PROGRESS.COMPLETE : VOTE_PROGRESS.PENDING
          : voteProgress

        return (
          <div
            key={player.id}
            className={`roster-dot action-${actionState} ${player.id === currentPlayerId ? 'is-you' : ''}`}
          >
            <span className="roster-player">
              <Avatar player={player} size="sm" />
              <span>{player.name}{player.id === currentPlayerId ? ' (you)' : ''}</span>
            </span>
            <span className="roster-statuses">
              <span className={`roster-status ${hasSubmitted ? 'is-complete' : phase === 'submission' ? 'is-pending' : 'is-missing'}`}>
                {hasSubmitted ? phase === 'submission' ? 'Song in' : 'Song' : phase === 'submission' ? 'Not yet' : 'No song'}
              </span>
              {showVoteStatus && (
                <span className={`roster-status is-${voteProgress}`}>
                  {voteProgressLabel(voteProgress)}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function voteProgressLabel(progress) {
  if (progress === VOTE_PROGRESS.COMPLETE) return 'Voted'
  if (progress === VOTE_PROGRESS.PARTIAL) return 'Partial'
  if (progress === VOTE_PROGRESS.MISSING) return 'No vote'
  return 'Not yet'
}
