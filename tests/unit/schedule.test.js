import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getLeagueContext, getScoredRoundIds, nextPacificMidnight, phaseForDate } from '../../src/lib/schedule.js'
import { makeRound, makeSettings } from '../fixtures/league.js'

describe('Pacific-time schedule', () => {
  it('switches from submission to voting at Thursday midnight Pacific', () => {
    const settings = makeSettings()

    assert.equal(phaseForDate(settings, new Date('2026-09-17T06:59:59Z')), 'submission')
    assert.equal(phaseForDate(settings, new Date('2026-09-17T07:00:00Z')), 'voting')
  })

  it('uses the configured weekly template', () => {
    const settings = makeSettings({ weekly_phase_template: { thursday: 'off' } })

    assert.equal(phaseForDate(settings, new Date('2026-09-17T07:00:00Z')), 'off')
  })

  for (const [name, now, expected] of [
    ['spring forward', '2026-03-08T08:00:00Z', '2026-03-09T07:00:00.000Z'],
    ['fall back', '2026-11-01T07:00:00Z', '2026-11-02T08:00:00.000Z'],
  ]) {
    it(`finds the next midnight across ${name}`, () => {
      assert.equal(nextPacificMidnight(new Date(now)).toISOString(), expected)
    })
  }

  it('counts past rounds immediately and the current round only once appreciation starts', () => {
    const settings = makeSettings({ schedule_start_date: '2026-09-07' })
    const rounds = [makeRound(), makeRound({ id: 'round-b', queue_position: 1 })]

    assert.deepEqual([...getScoredRoundIds(rounds, settings, new Date('2026-09-20T06:59:59Z'))], ['round-a'])
    assert.deepEqual([...getScoredRoundIds(rounds, settings, new Date('2026-09-20T07:00:00Z'))], ['round-a', 'round-b'])
  })

  it('does not make a late queued round current when its scheduled week has passed', () => {
    const settings = makeSettings({ schedule_start_date: '2026-09-07' })
    const rounds = [makeRound(), makeRound({ id: 'round-b', queue_position: 1 })]

    const context = getLeagueContext(rounds, settings, new Date('2026-09-28T19:00:00Z'))

    assert.equal(context.currentRound, null)
    assert.equal(context.latestRound.id, 'round-b')
  })
})
