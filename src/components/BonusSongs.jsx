import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { fetchBonusSongs, fetchBonusVotes } from '../lib/data.js'
import { addBonusVote, deleteBonusSong, saveSongSubmission } from '../lib/mutations.js'
import SubmissionView from '../pages/home/SubmissionView.jsx'
import PlaylistPanel from '../pages/home/PlaylistPanel.jsx'
import VotingSongCard from '../pages/home/VotingSongCard.jsx'
import AppreciationSongCard from '../pages/home/AppreciationSongCard.jsx'
import { anonymousNameFor } from '../lib/anonymousNames.js'
import { indexCommentLikes, indexCommentsBySongId } from '../pages/home/homeUtils.js'

const EMPTY = { songs: [], comments: [], commentLikes: [], playlists: [], error: '' }

export default function BonusSongs({ round, player, canSubmit = false, canVote = false, revealSongs = false, revealPlayers = false, embedded = false }) {
  const fetcher = useCallback(() => fetchBonusSongs(round.id), [round.id])
  const tables = useMemo(() => [{ table: 'bonus_songs', filter: `round_id=eq.${round.id}` },
    { table: 'bonus_comments', filter: `round_id=eq.${round.id}` }, 'bonus_comment_likes',
    { table: 'bonus_playlists', filter: `round_id=eq.${round.id}` }], [round.id])
  const { data, loading, reload } = useRealtimeData({
    cacheKey: `bonus-songs:${round.id}`, channelName: `bonus-songs:${round.id}`,
    fetcher, initialData: EMPTY, tables,
  })
  const { totals, voteError, voting, vote } = useSharedBonusVotes(round.id, revealSongs, canVote)
  const commentsBySongId = useMemo(() => indexCommentsBySongId(data.comments), [data.comments])
  const commentLikesIndex = useMemo(() => indexCommentLikes(data.commentLikes), [data.commentLikes])
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const visibleSongs = data.songs.filter(song => revealSongs || song.player_id === player.id)
  const save = async args => saveSongSubmission({ ...args, bonus: true, songId: editor === 'new' ? null : editor })

  async function remove(song) {
    setDeleting(song.id)
    setError('')
    try {
      const result = await deleteBonusSong(song.id, player.id)
      if (result.error) throw result.error
      if (editor === song.id) setEditor(null)
      reload()
    } catch (reason) {
      setError(reason.message || 'Could not remove this song.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className={embedded ? 'bonus-layout' : 'phase-layout bonus-layout'}>
      <section className={`song-stack ${embedded ? '' : 'bonus-content'}`}>
      <header>
      <h2>Side B</h2>
      <p>Extra picks with unlimted votes because the points don't matter.</p>
      </header>
      {!revealSongs && <p className="muted">Only you can see your extras until voting starts.</p>}
      {loading && <p role="status">Loading extra songs…</p>}
      {voteError && <p role="alert">{voteError}</p>}
      {(data.error || error) && <p role="alert">{data.error || error}</p>}
      {!loading && !data.error && visibleSongs.length === 0 && <p className="muted">{revealSongs ? 'No extra songs yet.' : 'You haven’t added any extra songs yet.'}</p>}
      {revealSongs && <PlaylistPanel playlists={data.playlists || []} roundId={round.id} side={0} bonus onChanged={reload} />}
      <div className="song-stack">
        {visibleSongs.map(song => revealPlayers ? (
          <AppreciationSongCard key={song.id}
            entry={{ ...song, canonical_song_id: song.id, member_song_ids: [song.id], submitters: song.players ? [song.players] : [] }}
            comments={data.comments} commentsBySongId={commentsBySongId}
            commentLikes={data.commentLikes} commentLikesIndex={commentLikesIndex}
            player={player} roundId={round.id} onChanged={reload} showScore={false} bonusVotes={totals[song.id] || 0} bonus
          />
        ) : (
          <VotingSongCard key={song.id} song={song} player={player} roundId={round.id}
            comments={commentsBySongId.get(song.id) || []} commentLikes={data.commentLikes}
            commentLikesIndex={commentLikesIndex} anonymousLabelFor={id => anonymousNameFor(round.id, id)}
            onChanged={reload} bonus showComments={canVote} hasVotes={Boolean(totals[song.id])}
            voteControls={canVote ? <TemporaryVotes song={song} votes={totals[song.id] || 0} disabled={voting} onVote={delta => vote(song.id, delta)} /> : null}
          >
            {canSubmit && song.player_id === player.id && <div className="song-actions">
              <button className="btn btn-secondary" onClick={() => setEditor(song.id)}>Edit extra song</button>
              <button className="btn btn-secondary" disabled={deleting === song.id} onClick={() => remove(song)}>Remove extra song</button>
            </div>}
          </VotingSongCard>
        ))}
      </div>
      {canSubmit && editor === null && <button className="btn btn-secondary" onClick={() => setEditor('new')}>Add a Side B song</button>}
      {canSubmit && editor !== null && <>
        <button className="btn btn-secondary" onClick={() => setEditor(null)}>Close extra song form</button>
        <SubmissionView key={editor} round={round} player={player}
          songs={editor === 'new' ? [] : data.songs.filter(song => song.id === editor)}
          activePlayers={[]} hideRoster saveSubmission={save}
          onChanged={() => { setEditor(null); reload() }} />
      </>}
      </section>
    </section>
  )
}

function useSharedBonusVotes(roundId, enabled, canVote) {
  const [totals, setTotals] = useState({})
  const [voteError, setVoteError] = useState('')
  const [voting, setVoting] = useState(false)
  const busy = useRef(false)
  const version = useRef(0)

  useEffect(() => {
    setTotals({})
    setVoteError('')
    if (!enabled) return
    let cancelled = false
    const controller = new AbortController()
    async function poll() {
      if (busy.current) return
      const requestVersion = ++version.current
      try {
        const next = await fetchBonusVotes(roundId, { signal: controller.signal })
        if (!cancelled && requestVersion === version.current) {
          setTotals(next)
          setVoteError('')
        }
      } catch (reason) {
        if (!cancelled && requestVersion === version.current) setVoteError(reason.message || 'Could not load Side B votes.')
      }
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => { cancelled = true; controller.abort(); clearInterval(timer); ++version.current }
  }, [roundId, enabled])

  async function vote(songId, delta) {
    if (busy.current || !canVote) return
    busy.current = true
    setVoting(true)
    const requestVersion = ++version.current
    try {
      const next = await addBonusVote(roundId, songId, delta)
      if (requestVersion === version.current) { setTotals(next); setVoteError('') }
    } catch (reason) {
      if (requestVersion === version.current) setVoteError(reason.message || 'Could not send your vote.')
    } finally {
      busy.current = false
      setVoting(false)
    }
  }
  return { totals, voteError, voting, vote }
}

function TemporaryVotes({ song, votes, disabled, onVote }) {
  return (
    <div className="vote-control vote-column" role="group" aria-label={`Temporary votes for ${song.title}`}>
      <button type="button" className="icon-btn primary" disabled={disabled}
        aria-label={`Upvote ${song.title} for fun`}
        onClick={() => onVote(1)}>↑</button>
      <strong className="vote-count-pop" key={`${song.id}-${votes}`} aria-live="polite" aria-label={`Shared temporary votes for ${song.title}`}>{votes}</strong>
      <button type="button" className="icon-btn" disabled={disabled}
        aria-label={`Downvote ${song.title} for fun`}
        onClick={() => onVote(-1)}>↓</button>
    </div>
  )
}
