import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { fetchLeagueSettings, fetchStoredPlayer } from './lib/data.js'
import { clearPlayer, getStoredPlayer, storePlayer } from './lib/identity.js'
import {
  loadAdminPage,
  loadJoinScreen,
  loadPastRoundPage,
  loadPastSongsPage,
  loadPlayerListPage,
  loadPlayerPage,
  loadRoundsPage,
} from './lib/routeLoaders.js'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'

import HomePage from './pages/HomePage.jsx'
import Nav from './components/Nav.jsx'

const AdminPage = lazy(loadAdminPage)
const JoinScreen = lazy(loadJoinScreen)
const PastRoundPage = lazy(loadPastRoundPage)
const PastSongsPage = lazy(loadPastSongsPage)
const PlayerPage = lazy(loadPlayerPage)
const PlayerListPage = lazy(loadPlayerListPage)
const RoundsPage = lazy(loadRoundsPage)

export const PlayerContext = createContext(null)
export const SettingsContext = createContext(null)

export function usePlayer() {
  return useContext(PlayerContext)
}

export function useSettings() {
  return useContext(SettingsContext)
}

function SetupRequired() {
  return (
    <main className="setup-screen">
      <div className="setup-panel">
        <span className="bubble-mark">BDF</span>
        <h1>Big Dog Flips</h1>
        <p>
          Add Supabase environment variables to run the league database.
          The setup SQL is in `SETUP.md`.
        </p>
      </div>
    </main>
  )
}

function RouteFallback() {
  return (
    <main className="page">
      <p className="muted">Loading...</p>
    </main>
  )
}

export default function App() {
  const [player, setPlayer] = useState(getStoredPlayer())
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    async function boot() {
      const stored = getStoredPlayer()
      const [nextSettings, storedPlayer] = await Promise.all([
        fetchLeagueSettings(),
        stored?.id ? fetchStoredPlayer(stored.id) : Promise.resolve(null),
      ])
      if (!mounted) return

      setSettings(nextSettings)
      if (stored?.id) {
        const data = storedPlayer
        if (data?.active) {
          storePlayer(data)
          setPlayer(data)
        } else {
          clearPlayer()
          setPlayer(null)
        }
      }

      setLoading(false)
    }

    boot()

    const settingsSub = supabase
      .channel('settings-season-2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_settings' }, async () => {
        const nextSettings = await fetchLeagueSettings()
        if (mounted) setSettings(nextSettings)
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(settingsSub)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !player?.id) return undefined

    const channel = supabase
      .channel(`player-session-season-2-${player.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `id=eq.${player.id}` }, payload => {
        const nextPlayer = payload.new
        if (payload.eventType === 'DELETE' || !nextPlayer?.active) {
          clearPlayer()
          setPlayer(null)
          return
        }

        storePlayer(nextPlayer)
        setPlayer(nextPlayer)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [player?.id])

  const handleJoin = useCallback(nextPlayer => {
    if (!nextPlayer?.active) {
      clearPlayer()
      setPlayer(null)
      return
    }

    storePlayer(nextPlayer)
    setPlayer(nextPlayer)
  }, [])

  const handlePlayerUpdate = useCallback(nextPlayer => {
    if (!nextPlayer?.active) {
      clearPlayer()
      setPlayer(null)
      return
    }

    storePlayer(nextPlayer)
    setPlayer(nextPlayer)
  }, [])

  const handleLogout = useCallback(() => {
    clearPlayer()
    setPlayer(null)
  }, [])

  const playerContext = useMemo(() => ({
    player,
    setPlayer: handlePlayerUpdate,
    logout: handleLogout,
  }), [player, handlePlayerUpdate, handleLogout])
  const settingsContext = useMemo(() => ({ settings, setSettings }), [settings])

  if (!isSupabaseConfigured) return <SetupRequired />

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="bubble-mark">BDF</span>
        <p>Loading Big Dog Flips...</p>
      </main>
    )
  }

  if (!player) {
    return (
      <SettingsContext.Provider value={settingsContext}>
        <Suspense fallback={<RouteFallback />}>
          <JoinScreen onJoin={handleJoin} settings={settings} />
        </Suspense>
      </SettingsContext.Provider>
    )
  }

  return (
    <PlayerContext.Provider value={playerContext}>
      <SettingsContext.Provider value={settingsContext}>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/rounds" element={<RoundsPage />} />
              <Route path="/rounds/:roundId" element={<PastRoundPage />} />
              <Route path="/players" element={<PlayerListPage />} />
              <Route path="/players/:playerId" element={<PlayerPage />} />
              <Route path="/songs" element={<PastSongsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/queue" element={<Navigate to="/rounds" replace />} />
              <Route path="/leaderboard" element={<Navigate to="/players" replace />} />
              <Route path="/archive" element={<Navigate to="/rounds" replace />} />
              <Route path="/history" element={<Navigate to="/rounds" replace />} />
              <Route path="/settings" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Nav />
        </BrowserRouter>
      </SettingsContext.Provider>
    </PlayerContext.Provider>
  )
}
