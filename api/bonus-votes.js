const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// One shared, anonymous counter per track on the standalone app server.
// Nothing is written to disk, Supabase, browser storage, or a player's ballot.
export function createBonusVotesHandler({ now = Date.now } = {}) {
  const rounds = new Map()
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Use POST.' })
    }
    const { roundId, songId, delta } = req.body || {}
    if (!UUID.test(roundId || '') || (delta !== undefined &&
      (!UUID.test(songId || '') || (delta !== 1 && delta !== -1)))) {
      return res.status(400).json({ error: 'A round and a song with a +1 or -1 vote are required.' })
    }
    const time = now()
    for (const [id, round] of rounds) {
      if (time >= round.expiresAt) rounds.delete(id)
    }
    let round = rounds.get(roundId)
    if (delta !== undefined) {
      if (!round) {
        round = { totals: {}, expiresAt: time + WEEK_MS }
        rounds.set(roundId, round)
      }
      round.totals[songId] = (round.totals[songId] || 0) + delta
    }
    return res.status(200).json({ totals: { ...round?.totals } })
  }
}

export default createBonusVotesHandler()
