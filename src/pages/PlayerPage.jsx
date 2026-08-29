import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_PLAYER_PROFILE_DATA, fetchPlayerProfileData, PLAYER_PROFILE_REALTIME_TABLES } from '../lib/data.js'
import { groupLabel, sidesForRound } from '../lib/groups.js'
import { clearProfilePictureUrl, saveProfileName, saveProfilePictureUrl } from '../lib/mutations.js'
import { uploadProfilePicture } from '../lib/profilePictures.js'
import { buildFairScores, buildLeaderboard, buildSongEntries, rankEntries } from '../lib/scoring.js'
import { formatPacificDate, getRoundWeekStart, getScoredRoundIds, sortedRounds } from '../lib/schedule.js'
import AppreciationSongCard from './home/AppreciationSongCard.jsx'

export default function PlayerPage() {
  const { playerId } = useParams()
  const { player, setPlayer, logout } = usePlayer()
  const { settings } = useSettings()
  const { data, loading, reload } = useRealtimeData({
    channelName: `player-page-season-2-${playerId}`,
    fetcher: fetchPlayerProfileData,
    initialData: EMPTY_PLAYER_PROFILE_DATA,
    tables: PLAYER_PROFILE_REALTIME_TABLES,
  })
  const [profile, setProfile] = useState({ name: player.name, avatar_url: player.avatar_url || '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isAvatarLightboxOpen, setIsAvatarLightboxOpen] = useState(false)
  const [isFairScoreModalOpen, setIsFairScoreModalOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (playerId !== player.id) return
    setProfile({ name: player.name, avatar_url: player.avatar_url || '' })
  }, [playerId, player.id, player.name, player.avatar_url])

  useEffect(() => {
    if (!isAvatarLightboxOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsAvatarLightboxOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAvatarLightboxOpen])

  useEffect(() => {
    if (!isFairScoreModalOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsFairScoreModalOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFairScoreModalOpen])

  const viewedPlayer = data.players.find(row => row.id === playerId)
  const isSelf = playerId === player.id
  const scoredRoundIds = useMemo(() => getScoredRoundIds(data.rounds, settings), [data.rounds, settings])
  const leaderboard = useMemo(() => buildLeaderboard({
    players: data.players,
    rounds: data.rounds,
    songs: data.songs,
    votes: data.votes,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    scoredRoundIds,
  }), [data, scoredRoundIds])
  const fairScores = useMemo(() => buildFairScores({
    songs: data.songs,
    votes: data.votes,
    duplicateGroups: data.groups,
    groupSongs: data.groupSongs,
    roundGroups: data.roundGroups,
    scoredRoundIds,
    pointsPerPlayer: settings?.points_per_player || 10,
  }), [data, scoredRoundIds, settings?.points_per_player])

  const submissions = useMemo(() => {
    if (!viewedPlayer) return []

    return sortedRounds(data.rounds)
      .map((round, index) => ({ round, index }))
      .filter(({ round }) => scoredRoundIds.has(round.id))
      .reverse()
      .flatMap(({ round, index: roundIndex }) => {
        const roundSongs = data.songs.filter(song => song.round_id === round.id)
        const roundVotes = data.votes.filter(vote => vote.round_id === round.id)
        const roundGroups = data.groups.filter(group => group.round_id === round.id)
        const groupIds = new Set(roundGroups.map(group => group.id))
        const roundGroupSongs = data.groupSongs.filter(row => groupIds.has(row.group_id))
        const sides = sidesForRound(data.roundGroups, round.id)
        const entries = buildSongEntries({
          songs: roundSongs,
          votes: roundVotes,
          duplicateGroups: roundGroups,
          groupSongs: roundGroupSongs,
          sideByPlayerId: sides.isSplit ? sides.sideByPlayerId : null,
        })

        // A player only ever competed against their own side, so rank within that side.
        const entriesBySide = {}
        for (const entry of entries) {
          const key = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
          if (!entriesBySide[key]) entriesBySide[key] = []
          entriesBySide[key].push(entry)
        }

        return Object.values(entriesBySide)
          .flatMap(sideEntries => rankEntries(sideEntries))
          .filter(entry => entry.submitterIds?.includes(viewedPlayer.id))
          .map(entry => {
            const submittedSong = entry.songs?.find(song => song.player_id === viewedPlayer.id) || entry.songs?.[0]
            return {
              id: `${round.id}:${entry.id}:${submittedSong?.id || 'song'}`,
              round,
              weekStart: getRoundWeekStart(settings, round, roundIndex),
              entry,
              rank: entry.rank,
              song: submittedSong,
            }
          })
      })
  }, [data, scoredRoundIds, settings, viewedPlayer])

  const score = leaderboard.find(row => row.id === playerId)?.total || 0
  const fairScore = fairScores[playerId]?.total || 0
  const submissionCount = submissions.length

  async function saveProfile(event) {
    event.preventDefault()
    const name = profile.name.trim()
    if (!name) return

    setSaving(true)
    setMessage('')

    const { data: updated, error } = await saveProfileName(player.id, name)

    setSaving(false)
    if (error || !updated) {
      setMessage('Could not save profile. The name may already be taken.')
      return
    }

    setPlayer(updated)
    setMessage('Profile saved.')
    setIsEditingProfile(false)
    reload()
  }

  async function clearProfilePicture() {
    setSaving(true)
    setMessage('')

    const { data: updated, error } = await clearProfilePictureUrl(player.id)

    setSaving(false)
    if (error || !updated) {
      setMessage('Could not remove profile picture.')
      return
    }

    setPlayer(updated)
    setProfile(p => ({ ...p, avatar_url: '' }))
    setMessage('Profile picture removed.')
    setIsEditingProfile(false)
    reload()
  }

  async function handlePictureUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setMessage('')

    try {
      const avatarUrl = await uploadProfilePicture(player.id, file)
      const { data: updated, error } = await saveProfilePictureUrl(player.id, avatarUrl)

      if (error || !updated) throw new Error('Uploaded, but could not save the profile picture.')

      setPlayer(updated)
      setProfile(p => ({ ...p, avatar_url: updated.avatar_url || '' }))
      setMessage('Profile picture uploaded.')
      setIsEditingProfile(false)
      reload()
    } catch (error) {
      setMessage(error.message || 'Could not upload that picture.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading player...</p>
      </main>
    )
  }

  if (!viewedPlayer) {
    return (
      <main className="page">
        <section className="empty-state">
          <h1>Player not found</h1>
          <p>This profile is not in the league.</p>
          <Link className="btn btn-secondary" to="/players">Back to players</Link>
        </section>
      </main>
    )
  }

  const displayPlayer = isSelf ? { ...viewedPlayer, ...player } : viewedPlayer
  const messageIsError = message.includes('Could not') || message.includes('Choose') || message.includes('under') || message.includes('Uploaded, but')

  function openProfileEditor() {
    setProfile({ name: player.name, avatar_url: player.avatar_url || '' })
    setMessage('')
    setIsEditingProfile(true)
  }

  function closeProfileEditor() {
    setProfile({ name: player.name, avatar_url: player.avatar_url || '' })
    setMessage('')
    setIsEditingProfile(false)
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Player profile</p>
          <h1>{displayPlayer.name}{isSelf ? ' (you)' : ''}</h1>
        </div>
        <Link className="btn btn-secondary" to="/players">Back to players</Link>
      </section>

      <section className={`player-profile-hero ${displayPlayer.active ? '' : 'inactive'}`}>
        {displayPlayer.avatar_url ? (
          <button
            type="button"
            className="profile-avatar-button"
            onClick={() => setIsAvatarLightboxOpen(true)}
            aria-label={`Enlarge ${displayPlayer.name}'s profile picture`}
          >
            <Avatar player={displayPlayer} size="hero" linkToProfile={false} />
          </button>
        ) : (
          <Avatar player={displayPlayer} size="hero" linkToProfile={false} />
        )}
        <div className="player-profile-main">
          <div>
            <p className="eyebrow">{isSelf ? 'My profile' : displayPlayer.active ? 'Active player' : 'Inactive player'}</p>
            <h2>{displayPlayer.name}</h2>
          </div>
          <div className="player-profile-tags">
            <span className="soft-tag">{displayPlayer.active ? 'Active' : 'Inactive'}</span>
            <span className="soft-tag">{submissions.length} submissions</span>
          </div>
          {isSelf && (
            <div className="profile-actions">
              {!isEditingProfile && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={openProfileEditor}>
                  Edit profile
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={logout} disabled={saving || uploading}>
                Log out
              </button>
              {message && <span className={messageIsError ? 'error-msg' : 'success-msg'}>{message}</span>}
            </div>
          )}
        </div>
        <div className="player-profile-stats" aria-label="Player stats">
          <span className="player-profile-stat">
            <strong>{score}</strong>
            <small>pts</small>
          </span>
          <span className="player-profile-stat">
            <strong>{submissionCount}</strong>
            <small>submissions</small>
          </span>
          <button
            type="button"
            className="player-profile-stat fair-score-stat"
            onClick={() => setIsFairScoreModalOpen(true)}
            aria-haspopup="dialog"
          >
            <strong>{fairScore.toFixed(1)}</strong>
            <small>Fair score <span aria-hidden="true">?</span></small>
          </button>
        </div>
      </section>

      {isAvatarLightboxOpen && displayPlayer.avatar_url && (
        <div className="profile-image-lightbox-backdrop" role="presentation" onMouseDown={() => setIsAvatarLightboxOpen(false)}>
          <section className="profile-image-lightbox" role="dialog" aria-modal="true" aria-label={`${displayPlayer.name}'s profile picture`} onMouseDown={event => event.stopPropagation()}>
            <button type="button" className="profile-image-lightbox-close" onClick={() => setIsAvatarLightboxOpen(false)} aria-label="Close enlarged profile picture">×</button>
            <img src={displayPlayer.avatar_url} alt={`${displayPlayer.name}'s profile picture`} />
          </section>
        </div>
      )}

      {isFairScoreModalOpen && (
        <FairScoreModal
          pointsPerPlayer={settings?.points_per_player || 10}
          onClose={() => setIsFairScoreModalOpen(false)}
        />
      )}

      {isSelf && isEditingProfile && (
        <section className="profile-editor card">
          <div className="section-heading">
            <h2>Edit profile</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={closeProfileEditor} disabled={saving || uploading}>
              Close
            </button>
          </div>
          <form className="stack" onSubmit={saveProfile}>
            <div className="form-row">
              <label>
                <span>Name</span>
                <input value={profile.name} onChange={event => setProfile(p => ({ ...p, name: event.target.value }))} />
              </label>
              <label>
                <span>Upload profile picture</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handlePictureUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {profile.avatar_url && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearProfilePicture}
                disabled={saving || uploading}
              >
                Remove profile picture
              </button>
            )}
            <div className="profile-editor-actions">
              <button type="button" className="btn btn-secondary" onClick={closeProfileEditor} disabled={saving || uploading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="round-section">
        <div className="section-heading">
          <h2>Submissions</h2>
          <span className="soft-tag">{submissions.length}</span>
        </div>
        {submissions.length === 0 ? (
          <div className="empty-state compact">
            <p>No submissions yet.</p>
          </div>
        ) : (
          <div className="song-stack">
            {submissions.map(submission => (
              <PlayerSubmission
                key={submission.id}
                submission={submission}
                comments={data.comments}
                commentLikes={data.commentLikes}
                player={player}
                onChanged={reload}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function FairScoreModal({ pointsPerPlayer, onClose }) {
  return (
    <div className="fair-score-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="fair-score-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fair-score-title"
        aria-describedby="fair-score-description"
        onMouseDown={event => event.stopPropagation()}
      >
        <button type="button" className="fair-score-modal-close" onClick={onClose} aria-label="Close fair score explanation" autoFocus>×</button>
        <div>
          <p className="eyebrow">Vanity stat · just for fun</p>
          <h2 id="fair-score-title">What is fair score?</h2>
        </div>
        <p id="fair-score-description">
          Fair score estimates how a song performed after accounting for missing ballots and unequal voting opportunities. It does not affect official points, standings, ranks, or winners.
        </p>

        <div className="fair-score-equation" aria-label={`Actual points plus neutral fill, divided by neutral opportunity, multiplied by ${pointsPerPlayer}`}>
          <span>Actual points</span>
          <b>+</b>
          <span>Neutral fill</span>
          <b>÷</b>
          <span>Opportunity</span>
          <b>× {pointsPerPlayer}</b>
        </div>

        <ul className="fair-score-details">
          <li><strong>Unspent points become neutral.</strong> They are divided evenly among every song that voter could have supported.</li>
          <li><strong>Opportunity is normalized.</strong> Group size, submissions, and the number of eligible voters are included before returning the result to the usual {pointsPerPlayer}-point round scale.</li>
          <li><strong>Duplicates count once.</strong> All submitters are excluded from voting on the merged entry, so courtesy points are not added again.</li>
        </ul>

        <p className="fair-score-example">
          If someone skips a {pointsPerPlayer}-point ballot with five eligible songs, each opponent receives a neutral {formatFairNumber(pointsPerPlayer / 5)} points in this calculation.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Got it</button>
      </section>
    </div>
  )
}

function formatFairNumber(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2))
}

function PlayerSubmission({ submission, comments, commentLikes, player, onChanged }) {
  const { entry, rank, round, song, weekStart } = submission

  return (
    <AppreciationSongCard
      entry={entry}
      comments={comments}
      commentLikes={commentLikes}
      player={player}
      roundId={round.id}
      onChanged={onChanged}
      isTopEntry={rank === 1 && entry.totalPoints > 0}
      className="player-submission-card"
      submitterNote={song?.submitter_note ?? entry.submitter_note}
      showListenLink={false}
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
