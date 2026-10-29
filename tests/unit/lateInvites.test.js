import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { lateInviteStatus, lateInviteUrl } from '../../src/lib/lateInvites.js'

const settings = { schedule_start_date: '2026-10-26' }
const rounds = [{ id: 'round', queue_position: 0 }]
const invite = { round_id: 'round', expires_at: '2026-11-01T07:00:00Z' }

describe('late invite availability', () => {
  it('opens during voting and expires at Pacific midnight', () => {
    assert.equal(lateInviteStatus(invite, rounds, settings, new Date('2026-10-31T23:59:59-07:00')), 'Unused')
    assert.equal(lateInviteStatus(invite, rounds, settings, new Date('2026-11-01T00:00:00-07:00')), 'Expired')
  })
  it('rejects past rounds even when their expiry is in the future', () => {
    assert.equal(lateInviteStatus({ ...invite, expires_at: '2027-01-01' }, rounds, settings, new Date('2026-11-05T12:00:00-08:00')), 'Expired')
  })
  it('honors a changed weekly schedule', () => {
    const changed = { ...settings, weekly_phase_template: { thursday: 'appreciation' } }
    assert.equal(lateInviteStatus(invite, rounds, changed, new Date('2026-10-29T12:00:00-07:00')), 'Expired')
  })
  it('keeps used and revoked statuses after expiry', () => {
    const now = new Date('2026-11-08T12:00:00-08:00')
    assert.equal(lateInviteStatus({ ...invite, redeemed_at: '2026-10-30' }, rounds, settings, now), 'Redeemed')
    assert.equal(lateInviteStatus({ ...invite, revoked_at: '2026-10-30' }, rounds, settings, now), 'Revoked')
  })
  it('uses the current origin for recipient links', () => {
    assert.equal(lateInviteUrl('abc', 'https://example.com'), 'https://example.com/late-submit/abc')
  })
})
