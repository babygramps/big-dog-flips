import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSettings } from '../App.jsx'
import { fetchLateInvite } from '../lib/data.js'
import { redeemLateInvite } from '../lib/mutations.js'
import { lateInviteStatus } from '../lib/lateInvites.js'
import SubmissionView from './home/SubmissionView.jsx'

export default function LateSubmitPage() {
  const { token } = useParams()
  const { settings } = useSettings()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    fetchLateInvite(token).then(result => { if (active) setData(result) })
      .catch(reason => { if (active) setError(reason.message || 'Could not load this invite.') })
    return () => { active = false }
  }, [token])
  if (error) return <main className="page"><h1>Late submission</h1><p role="alert">{error}</p></main>
  if (!data) return <main className="page"><p>Loading invite…</p></main>
  const { invite, rounds } = data
  const status = lateInviteStatus(invite, rounds, settings)
  return <main className="page">
    <h1>{invite.rounds.theme_name}</h1>
    <p>{invite.rounds.theme_description}</p>
    <h2>Late submission for {invite.players.name}</h2>
    {status !== 'Unused' ? <p>This invite is {status.toLowerCase()}.{status === 'Redeemed' ? ' Your song has been saved.' : ''}</p>
      : !invite.players.active ? <p>This player is no longer active.</p> : <>
        <p>You’re submitting as {invite.players.name}. You can submit once, before voting ends. Check your song before saving; it cannot be edited through this link.</p>
        <SubmissionView key={token} round={invite.rounds} player={invite.players} songs={[]} activePlayers={[]}
          hideRoster allowEditing={false} saveSubmission={values => redeemLateInvite(token, values)} onChanged={() => {}} />
      </>}
  </main>
}
