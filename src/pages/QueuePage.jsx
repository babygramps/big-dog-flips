import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer, useSettings } from '../App.jsx'
import Avatar from '../components/Avatar.jsx'
import useRealtimeData from '../hooks/useRealtimeData.js'
import { EMPTY_ROUNDS_DATA, fetchRoundsData, ROUNDS_REALTIME_TABLES } from '../lib/data.js'
import { addRound, deleteRound, moveUpcomingRound, updateRoundTheme } from '../lib/mutations.js'
import { preloadPastRoundPage } from '../lib/routeLoaders.js'
import { formatPacificDate, getLeagueContext, getRoundState, getRoundTiming, PHASES } from '../lib/schedule.js'

export default function RoundsPage() {
  const { player } = usePlayer()
  const { settings } = useSettings()
  const { data, loading, reload } = useRealtimeData({
    cacheKey: 'rounds',
    channelName: 'rounds-season-2',
    fetcher: fetchRoundsData,
    initialData: EMPTY_ROUNDS_DATA,
    tables: ROUNDS_REALTIME_TABLES,
  })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ theme_name: '', theme_description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ theme_name: '', theme_description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const context = useMemo(() => getLeagueContext(data.rounds, settings), [data.rounds, settings])
  const { current, upcoming, past } = useMemo(() => {
    const roundRows = context.orderedRounds.map((round, index) => ({
      round,
      index,
      state: getRoundState(round, index, settings),
      timing: getRoundTiming(round, index, settings),
    }))
    return {
      current: roundRows.filter(row => row.state === 'current'),
      upcoming: roundRows.filter(row => row.state === 'upcoming'),
      past: roundRows.filter(row => row.state === 'past').reverse(),
    }
  }, [context.orderedRounds, settings])
  const songCountByRoundId = useMemo(() => data.songs.reduce((counts, song) => {
    counts[song.round_id] = (counts[song.round_id] || 0) + 1
    return counts
  }, {}), [data.songs])

  async function handleAdd(event) {
    event.preventDefault()
    if (!form.theme_name.trim() || !form.theme_description.trim()) {
      setError('Theme and description are required.')
      return
    }

    setSaving(true)
    setError('')
    const { error: insertError } = await addRound({
      form,
      playerId: player.id,
      context,
    })

    setSaving(false)
    if (insertError) {
      setError('Could not add that round.')
      return
    }

    setForm({ theme_name: '', theme_description: '' })
    setShowAdd(false)
    reload()
  }

  async function moveRound(round, direction) {
    await moveUpcomingRound({
      round,
      direction,
      upcomingRows: upcoming,
      scheduleStartDate: context.startDate,
    })
    reload()
  }

  function startEdit(round) {
    setEditingId(round.id)
    setEditForm({ theme_name: round.theme_name, theme_description: round.theme_description })
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(round) {
    if (!editForm.theme_name.trim() || !editForm.theme_description.trim()) {
      setEditError('Theme and description are required.')
      return
    }

    setEditSaving(true)
    const { error: updateError } = await updateRoundTheme({ roundId: round.id, ...editForm })
    setEditSaving(false)
    if (updateError) {
      setEditError('Could not save changes.')
      return
    }

    setEditingId(null)
    reload()
  }

  async function removeRound(round) {
    const confirmed = window.confirm(
      `Delete "${round.theme_name}"? This permanently removes its songs, votes, and comments.`
    )
    if (!confirmed) return

    await deleteRound({
      round,
      orderedRounds: context.orderedRounds,
      scheduleStartDate: context.startDate,
    })
    if (editingId === round.id) setEditingId(null)
    reload()
  }

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading rounds...</p>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Queue and history</p>
          <h1>Rounds</h1>
          <p>One place for what is happening now, what is coming up, and what already happened.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(value => !value)}>
          {showAdd ? 'Close' : 'Add round'}
        </button>
      </section>

      {showAdd && (
        <section className="card add-round-card">
          <h2>New round</h2>
          <form className="stack" onSubmit={handleAdd}>
            <label>
              <span>Theme</span>
              <input
                value={form.theme_name}
                onChange={event => setForm(f => ({ ...f, theme_name: event.target.value }))}
                placeholder="Name this round"
                autoFocus
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={form.theme_description}
                onChange={event => setForm(f => ({ ...f, theme_description: event.target.value }))}
                rows={3}
                placeholder="Describe the round"
              />
            </label>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding...' : 'Add to schedule'}
            </button>
          </form>
        </section>
      )}

      <RoundSection title="Now playing" rows={current}>
        {current.map(row => (
          <RoundCard
            key={row.round.id}
            row={row}
            settings={settings}
            currentPhase={context.phase}
            controls={
              <div className="round-controls">
                <button type="button" className="icon-btn" onClick={() => startEdit(row.round)} aria-label="Edit round">✎</button>
                <button type="button" className="icon-btn" onClick={() => removeRound(row.round)} aria-label="Delete round">✕</button>
              </div>
            }
            manage={{
              editing: editingId === row.round.id,
              editForm,
              onFieldChange: (field, value) => setEditForm(f => ({ ...f, [field]: value })),
              onSave: () => saveEdit(row.round),
              onCancel: cancelEdit,
              saving: editSaving,
              error: editingId === row.round.id ? editError : '',
            }}
          />
        ))}
      </RoundSection>

      <RoundSection title="Up next" rows={upcoming}>
        {upcoming.map((row, index) => (
          <RoundCard
            key={row.round.id}
            row={row}
            settings={settings}
            controls={
              <div className="round-controls">
                <button type="button" className="icon-btn" onClick={() => moveRound(row.round, -1)} disabled={index === 0}>↑</button>
                <button type="button" className="icon-btn" onClick={() => moveRound(row.round, 1)} disabled={index === upcoming.length - 1}>↓</button>
                <button type="button" className="icon-btn" onClick={() => startEdit(row.round)} aria-label="Edit round">✎</button>
                <button type="button" className="icon-btn" onClick={() => removeRound(row.round)} aria-label="Delete round">✕</button>
              </div>
            }
            manage={{
              editing: editingId === row.round.id,
              editForm,
              onFieldChange: (field, value) => setEditForm(f => ({ ...f, [field]: value })),
              onSave: () => saveEdit(row.round),
              onCancel: cancelEdit,
              saving: editSaving,
              error: editingId === row.round.id ? editError : '',
            }}
          />
        ))}
      </RoundSection>

      <RoundSection title="Record crate" rows={past}>
        {past.map(row => (
          <HistoryRound
            key={row.round.id}
            row={row}
            songCount={songCountByRoundId[row.round.id] || 0}
          />
        ))}
      </RoundSection>
    </main>
  )
}

function RoundSection({ title, rows, children }) {
  return (
    <section className="round-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="soft-tag">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state compact">
          <p>No {title.toLowerCase()} rounds.</p>
        </div>
      ) : children}
    </section>
  )
}

function RoundCard({ row, currentPhase, controls, manage }) {
  const { round, state, timing } = row
  const phaseLabel = state === 'current'
    ? PHASES[currentPhase]?.label || 'Current'
    : state === 'upcoming'
      ? 'Scheduled'
      : 'Past'

  return (
    <article className={`round-card ${state}`}>
      <div className="round-card-main">
        <div className="round-card-topline">
          <span className={`phase-pill phase-${state === 'current' ? currentPhase : state === 'upcoming' ? 'off' : 'appreciation'}`}>{phaseLabel}</span>
          <span className="round-week">Week of {formatPacificDate(timing.weekStart)}</span>
        </div>
        {manage?.editing ? (
          <form className="stack edit-round-form" onSubmit={event => { event.preventDefault(); manage.onSave() }}>
            <label>
              <span>Theme</span>
              <input
                value={manage.editForm.theme_name}
                onChange={event => manage.onFieldChange('theme_name', event.target.value)}
                autoFocus
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={manage.editForm.theme_description}
                onChange={event => manage.onFieldChange('theme_description', event.target.value)}
                rows={3}
              />
            </label>
            {manage.error && <p className="error-msg">{manage.error}</p>}
            <div className="round-controls">
              <button type="submit" className="btn btn-primary btn-sm" disabled={manage.saving}>
                {manage.saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={manage.onCancel} disabled={manage.saving}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3>{round.theme_name}</h3>
            <p>{round.theme_description}</p>
          </>
        )}
        <div className="round-meta">
          {round.players && (
            <span>
              <Avatar player={round.players} size="xs" />
              Added by {round.players.name}
            </span>
          )}
        </div>
      </div>
      {!manage?.editing && controls}
    </article>
  )
}

function HistoryRound({ row, songCount }) {
  return (
    <Link
      className="round-card history-round history-round-link past"
      to={`/rounds/${row.round.id}`}
      onFocus={preloadPastRoundPage}
      onPointerEnter={preloadPastRoundPage}
    >
      <div className="round-card-main">
        <div className="round-card-topline">
          <span className="phase-pill phase-appreciation">Past round</span>
          <span className="round-week">Week of {formatPacificDate(row.timing.weekStart)}</span>
        </div>
        <h3>{row.round.theme_name}</h3>
        <p>{row.round.theme_description}</p>
        <div className="round-meta">
          {row.round.players && (
            <span>
              <Avatar player={row.round.players} size="xs" />
              Added by {row.round.players.name}
            </span>
          )}
          <span className="soft-tag">{songCount} song{songCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  )
}
