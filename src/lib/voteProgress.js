export const VOTE_PROGRESS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  PENDING: 'pending',
  MISSING: 'missing',
}

export function votePointsByPlayer(votes = []) {
  const pointsByPlayer = new Map()

  votes.forEach(vote => {
    const playerId = vote.voter_player_id
    const points = Number(vote.points)
    if (!playerId || !Number.isFinite(points) || points <= 0) return

    pointsByPlayer.set(playerId, (pointsByPlayer.get(playerId) || 0) + points)
  })

  return pointsByPlayer
}

export function voteProgressFor(pointsSpent, pointsTotal, { final = false } = {}) {
  const spent = Math.max(0, Number(pointsSpent) || 0)
  const total = Math.max(1, Number(pointsTotal) || 3)

  if (spent >= total) return VOTE_PROGRESS.COMPLETE
  if (spent > 0) return VOTE_PROGRESS.PARTIAL
  return final ? VOTE_PROGRESS.MISSING : VOTE_PROGRESS.PENDING
}
