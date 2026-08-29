import { startTransition, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const CACHE_FRESH_MS = 15000
const REALTIME_DEBOUNCE_MS = 120
const dataCache = new Map()

function cachedDataFor(cacheKey) {
  return dataCache.get(cacheKey)?.data
}

function loadCached(cacheKey, fetcher, { force = false } = {}) {
  const cached = dataCache.get(cacheKey)
  if (cached?.promise) return cached.promise
  if (!force && cached?.data && Date.now() - cached.updatedAt < CACHE_FRESH_MS) {
    return Promise.resolve(cached.data)
  }

  const entry = cached || {}
  const promise = Promise.resolve(fetcher())
    .then(data => {
      dataCache.set(cacheKey, { data, updatedAt: Date.now(), promise: null })
      return data
    })
    .catch(error => {
      dataCache.set(cacheKey, { ...entry, promise: null })
      throw error
    })

  dataCache.set(cacheKey, { ...entry, promise })
  return promise
}

export default function useRealtimeData({ cacheKey = channelName, channelName, fetcher, initialData, tables }) {
  const cached = cachedDataFor(cacheKey)
  const [data, setData] = useState(() => cached || initialData)
  const [loading, setLoading] = useState(() => !cached)
  const [loadedKey, setLoadedKey] = useState(() => cached ? cacheKey : null)

  const load = useCallback(async ({ force = true, transition = false } = {}) => {
    try {
      const next = await loadCached(cacheKey, fetcher, { force })
      const update = () => {
        setData(next)
        setLoading(false)
        setLoadedKey(cacheKey)
      }
      if (transition) startTransition(update)
      else update()
      return next
    } catch {
      setLoading(false)
      setLoadedKey(cacheKey)
      return cachedDataFor(cacheKey) || initialData
    }
  }, [cacheKey, fetcher, initialData])

  useEffect(() => {
    let mounted = true
    let refreshTimer = null
    let cacheExpiryTimer = null
    let refreshQueued = false
    let loadingNow = false

    async function loadIfMounted({ force = false, transition = false } = {}) {
      if (loadingNow) {
        refreshQueued = refreshQueued || force
        return
      }

      loadingNow = true
      try {
        const next = await loadCached(cacheKey, fetcher, { force })
        if (!mounted) return
        const update = () => {
          setData(next)
          setLoading(false)
          setLoadedKey(cacheKey)
        }
        if (transition) startTransition(update)
        else update()
      } catch {
        if (mounted) {
          setLoading(false)
          setLoadedKey(cacheKey)
        }
      } finally {
        loadingNow = false
        if (mounted && refreshQueued) {
          refreshQueued = false
          scheduleRefresh()
        }
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        loadIfMounted({ force: true, transition: true })
      }, REALTIME_DEBOUNCE_MS)
    }

    loadIfMounted()
    const cacheAge = Date.now() - (dataCache.get(cacheKey)?.updatedAt || 0)
    if (cacheAge < CACHE_FRESH_MS) {
      cacheExpiryTimer = window.setTimeout(() => {
        const age = Date.now() - (dataCache.get(cacheKey)?.updatedAt || 0)
        if (age >= CACHE_FRESH_MS) loadIfMounted({ force: true, transition: true })
      }, CACHE_FRESH_MS - cacheAge)
    }

    const channel = supabase.channel(channelName)
    tables.forEach(spec => {
      const table = typeof spec === 'string' ? spec : spec.table
      const filter = typeof spec === 'string' ? undefined : spec.filter
      if (filter) {
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, scheduleRefresh)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, scheduleRefresh)
          // Deletes do not reliably carry filter columns under the default replica identity.
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, scheduleRefresh)
      } else {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
      }
    })
    channel.subscribe()

    function refreshWhenVisible() {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - (dataCache.get(cacheKey)?.updatedAt || 0)
      if (age >= CACHE_FRESH_MS) scheduleRefresh()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      mounted = false
      if (refreshTimer) window.clearTimeout(refreshTimer)
      if (cacheExpiryTimer) window.clearTimeout(cacheExpiryTimer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      supabase.removeChannel(channel)
    }
  }, [cacheKey, channelName, fetcher, tables])

  return { data, loading: loading || loadedKey !== cacheKey, reload: load }
}
