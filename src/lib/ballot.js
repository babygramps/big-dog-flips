// Upvotes and the optional single downvote share one vote allowance.
export function ballotBudget(draft = {}, total = 3) {
  const upUsed = Object.values(draft).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
  const downUsed = Object.values(draft).reduce((sum, value) => sum + Math.max(0, -(Number(value) || 0)), 0)
  const pointsUsed = upUsed + downUsed
  const remaining = Math.max(0, Number(total) - pointsUsed)
  return { upUsed, downUsed, upRemaining: remaining, downRemaining: Math.min(remaining, Math.max(0, 1 - downUsed)), pointsUsed }
}

export function adjustedVote(draft, songId, delta, total = 3) {
  const current = Number(draft[songId]) || 0
  const budget = ballotBudget(draft, total)
  if (delta === 1 && (current < 0 || budget.upRemaining > 0)) return current + 1
  if (delta === -1 && (current > 0 || (current === 0 && budget.downRemaining > 0))) return current - 1
  return current
}
