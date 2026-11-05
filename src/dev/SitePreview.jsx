import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { PlayerContext, SettingsContext } from '../App.jsx'
import HomePage from '../pages/HomePage.jsx'
import Nav from '../components/Nav.jsx'
import { DAY_KEYS, getPacificParts } from '../lib/schedule.js'

export default function SitePreview() {
  const preview = window.__BDF_PREVIEW__
  const [player, setPlayer] = useState(preview.players[0])
  const day = DAY_KEYS.indexOf(getPacificParts().dayKey)
  const phaseLink = target => `/__preview?days=${target - day}`
  return (
    <PlayerContext.Provider value={{ player, setPlayer, logout: () => setPlayer(preview.players[0]) }}>
      <SettingsContext.Provider value={{ settings: preview.settings, setSettings: () => {} }}>
        <BrowserRouter basename="/__preview">
          <div className="page">
            <section className="card">
              <div className="section-heading"><h2>Local preview · Sample league</h2><span className="soft-tag">Real site components</span></div>
              <p>Try voting, comments, and the Sunday reveal. Sample league changes reset on refresh. Side B totals are shared through the local server.</p>
              <div className="song-actions">
                <a className="btn btn-secondary" href={phaseLink(3)}>Voting</a>
                <a className="btn btn-secondary" href={phaseLink(6)}>Appreciation</a>
                <label>View as <select value={player.id} onChange={event => setPlayer(preview.players.find(row => row.id === event.target.value))}>
                  {preview.players.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select></label>
              </div>
            </section>
          </div>
          <HomePage />
          <Nav />
        </BrowserRouter>
      </SettingsContext.Provider>
    </PlayerContext.Provider>
  )
}
