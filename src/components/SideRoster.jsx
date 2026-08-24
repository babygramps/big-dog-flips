import Avatar from './Avatar.jsx'

export default function SideRoster({
  players = [],
  submittedIds,
  completedIds,
  currentPlayerId,
  muted = false,
  showSubmissionStatus = false,
  showVoteStatus = false,
  voteStatusFinal = false,
}) {
  if (players.length === 0) {
    return <p className="muted">Nobody here yet.</p>
  }

  return (
    <div className={`mini-roster ${muted ? 'roster-muted' : ''}`}>
      {players.map(player => {
        const hasSubmitted = submittedIds?.has(player.id) || false
        const hasVoted = completedIds?.has(player.id) || false
        const hasDetailedStatus = showSubmissionStatus || showVoteStatus
        const isDone = hasDetailedStatus
          ? (!showSubmissionStatus || hasSubmitted) && (!showVoteStatus || hasVoted)
          : hasSubmitted || hasVoted

        return (
          <div
            key={player.id}
            className={`roster-dot ${isDone ? 'done' : ''} ${player.id === currentPlayerId ? 'is-you' : ''}`}
          >
            <span className="roster-player">
              <Avatar player={player} size="sm" />
              <span>{player.name}{player.id === currentPlayerId ? ' (you)' : ''}</span>
            </span>
            {hasDetailedStatus && (
              <span className="roster-statuses">
                {showSubmissionStatus && (
                  <span className={`roster-status ${hasSubmitted ? 'is-complete' : 'is-missing'}`}>
                    {hasSubmitted ? 'Song' : 'No song'}
                  </span>
                )}
                {showVoteStatus && (
                  <span className={`roster-status ${hasVoted ? 'is-complete' : voteStatusFinal ? 'is-missing' : 'is-pending'}`}>
                    {hasVoted ? 'Voted' : voteStatusFinal ? 'No vote' : 'Not yet'}
                  </span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
