import { getLeagueContext } from './schedule.js'

export function lateInviteStatus(invite, rounds, settings, now = new Date()) {
  if (invite.redeemed_at) return 'Redeemed'
  if (invite.revoked_at) return 'Revoked'
  const context = getLeagueContext(rounds, settings, now)
  if (new Date(invite.expires_at) <= now || context.currentRound?.id !== invite.round_id || context.phase !== 'voting') return 'Expired'
  return 'Unused'
}

export function lateInviteUrl(token, origin) {
  return new URL(`/late-submit/${encodeURIComponent(token)}`, origin).href
}
