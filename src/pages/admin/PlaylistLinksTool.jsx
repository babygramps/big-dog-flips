import { useState } from 'react'
import { playlistSyncMessage } from '../../lib/roundPlaylists.js'

// The nightly job does this on its own shortly after midnight Pacific. The button
// is for when TuneMyMusic was down overnight and nobody wants to wait a day.
export default function PlaylistLinksTool() {
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function makeLinks() {
    setWorking(true)
    setMessage('')
    try {
      const response = await fetch('/api/round-playlists', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not make playlist links.')
      setMessage(playlistSyncMessage(result))
      setIsError(result.failed.length > 0)
    } catch (reason) {
      setMessage(reason.message || 'Could not make playlist links.')
      setIsError(true)
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="card">
      <div className="section-heading">
        <h2>TuneMyMusic links</h2>
        {message && <span className={isError ? 'error-msg' : 'success-msg'}>{message}</span>}
      </div>
      <p className="muted">
        Each night after submissions close, every side gets a TuneMyMusic link in its Shared playlists box, so anyone can import the round into their own music app. Use this if a link is missing.
      </p>
      <button type="button" className="btn btn-secondary" onClick={makeLinks} disabled={working}>
        {working ? 'Making links...' : 'Make playlist links now'}
      </button>
    </section>
  )
}
