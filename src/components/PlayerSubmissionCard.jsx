import { groupLabel } from '../lib/groups.js'
import { formatPacificDate } from '../lib/schedule.js'
import AppreciationSongCard from '../pages/home/AppreciationSongCard.jsx'

export default function PlayerSubmissionCard({
  submission,
  comments,
  commentsBySongId,
  commentLikes,
  commentLikesIndex,
  player,
  onChanged,
}) {
  const { entry, round, song, weekStart } = submission

  return (
    <AppreciationSongCard
      entry={entry}
      comments={comments}
      commentsBySongId={commentsBySongId}
      commentLikes={commentLikes}
      commentLikesIndex={commentLikesIndex}
      player={player}
      roundId={round.id}
      onChanged={onChanged}
      className="player-submission-card"
      submitterNote={song?.submitter_note ?? entry.submitter_note}
      context={(
        <>
          <div>
            <p className="eyebrow">Week of {formatPacificDate(weekStart)}</p>
            <p className="player-submission-theme">{round.theme_name}</p>
          </div>
          {entry.side !== null && entry.side !== undefined && (
            <span className={`side-tag side-${entry.side}`}>{groupLabel(entry.side)}</span>
          )}
        </>
      )}
    />
  )
}
