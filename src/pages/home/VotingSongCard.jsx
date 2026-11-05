import SongArtwork from '../../components/SongArtwork.jsx'
import SongLinks from '../../components/SongLinks.jsx'
import CommentThread from './CommentThread.jsx'

// Both pools share the entire presentation; only their vote controls differ.
export default function VotingSongCard({ song, player, roundId, comments = [], commentLikes = [], commentLikesIndex = null, anonymousLabelFor, onChanged, voteControls = null, hasVotes = false, bonus = false, showComments = true, children }) {
  return (
    <article className={`song-card voting-song-card ${voteControls ? '' : 'is-no-vote'} ${hasVotes ? 'has-votes' : ''}`}>
      <div className="voting-song-header">
        <div className="song-card-main">
          <SongArtwork song={song} />
          <div>
            <h2>{song.title}</h2>
            <p>{song.artist}{song.album ? ` · ${song.album}` : ''}</p>
          </div>
        </div>
        <SongLinks song={song} className="voting-song-actions" />
        {song.submitter_note && <p className="note">{song.submitter_note}</p>}
      </div>
      {showComments && <CommentThread
        comments={comments} commentLikes={commentLikes} commentLikesIndex={commentLikesIndex}
        player={player} revealAuthors={false} anonymousLabelFor={anonymousLabelFor}
        songId={song.id} roundId={roundId} onChanged={onChanged} compact bonus={bonus}
      />}
      {voteControls}
      {children}
    </article>
  )
}
