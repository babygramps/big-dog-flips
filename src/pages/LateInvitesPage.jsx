import { useEffect, useState } from 'react'
import { useSettings } from '../App.jsx'
import { fetchLateInviteSetup } from '../lib/data.js'
import { createLateInvite, revokeLateInvite } from '../lib/mutations.js'
import { getLeagueContext } from '../lib/schedule.js'
import { lateInviteStatus, lateInviteUrl } from '../lib/lateInvites.js'

export default function LateInvitesPage() {
  const { settings } = useSettings()
  const [data, setData] = useState(null)
  const [playerId, setPlayerId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    fetchLateInviteSetup().then(result => { if (active) setData(result) })
      .catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [])
  const context = getLeagueContext(data?.rounds, settings)
  const round = context.currentRound
  const eligible = (data?.players || []).filter(player => player.active && !data.songs.some(song => song.round_id === round?.id && song.player_id === player.id))

  async function mutate(action) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setData(await fetchLateInviteSetup())
    } catch (reason) { setError(reason.message || 'Could not update invites. Try again.') }
    finally { setBusy(false) }
  }

  async function copy(token) {
    try {
      await navigator.clipboard.writeText(lateInviteUrl(token, window.location.origin))
      setMessage('Link copied.')
    } catch { setMessage('Select and copy the link from the field below.') }
  }

  return <main className="page">
    <h1>Late submission invites</h1>
    <p>This unlisted page creates one-use links for players who missed submission. Anyone with this page’s URL can create or revoke invites.</p>
    <p>Late songs appear in voting immediately. Existing votes stay unchanged, and existing TuneMyMusic shares will not include the new song.</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!data ? <p>{error ? 'Reload this page to try again.' : 'Loading…'}</p> : <>
      <section className="card stack">
        <h2>{round?.theme_name || 'No current round'}</h2>
        {round && context.phase === 'voting' ? <form className="stack" onSubmit={event => {
          event.preventDefault()
          mutate(async () => { await createLateInvite(round.id, playerId); setPlayerId(''); setMessage('Invite created. Copy its link below.') })
        }}>
          <label>Player<select value={playerId} onChange={event => setPlayerId(event.target.value)} required>
            <option value="">Choose a player</option>
            {eligible.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select></label>
          {!eligible.length && <p>Every active player has submitted.</p>}
          <p>Links expire when this round’s voting window ends. They cannot replace an existing submission.</p>
          <button className="btn btn-primary" disabled={busy || !eligible.some(player => player.id === playerId)}>Create link</button>
        </form> : <p>Invites are available during voting for the current round.</p>}
      </section>
      <section className="stack">
        <h2>Invites</h2>
        {!data.invites.length && <p>No invites yet.</p>}
        {data.invites.map(invite => {
          const status = lateInviteStatus(invite, data.rounds, settings)
          return <article className="card stack" key={invite.id}>
            <h3>{data.players.find(player => player.id === invite.player_id)?.name} · {data.rounds.find(row => row.id === invite.round_id)?.theme_name}</h3>
            <p>{status} · Expires {new Date(invite.expires_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific</p>
            {status === 'Unused' && <>
              <label>Submission link<input readOnly value={lateInviteUrl(invite.token, window.location.origin)} onFocus={event => event.target.select()} /></label>
              <div className="form-row">
                <button type="button" className="btn btn-secondary" onClick={() => copy(invite.token)}>Copy link</button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => mutate(() => revokeLateInvite(invite.id))}>Revoke</button>
              </div>
            </>}
          </article>
        })}
      </section>
    </>}
  </main>
}
