import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRoundGroupAssignment, shouldSplitRound, sideOf, sidesForRound } from '../../src/lib/groups.js'

const players = Array.from({ length: 12 }, (_, index) => ({ id: `player-${index}` }))

describe('optional Side B', () => {
  it('keeps everyone in one pool by default, even with a large roster', () => {
    assert.equal(shouldSplitRound(12), false)
    assert.equal(shouldSplitRound(12, false), false)
    assert.equal(buildRoundGroupAssignment({ roundId: 'round', activePlayers: players }), null)
    assert.equal(buildRoundGroupAssignment({ roundId: 'round', activePlayers: players, bSidesEnabled: false }), null)
  })

  it('splits only when Side B is enabled and there are at least ten players', () => {
    assert.equal(shouldSplitRound(9, true), false)
    assert.equal(shouldSplitRound(10, true), true)
    assert.equal(buildRoundGroupAssignment({ roundId: 'round', activePlayers: players.slice(0, 9), bSidesEnabled: true }), null)

    const assignments = buildRoundGroupAssignment({ roundId: 'round', activePlayers: players.slice(0, 10), bSidesEnabled: true })
    assert.equal(assignments.length, 10)
    assert.equal(new Set(assignments.map(row => row.player_id)).size, 10)
    assert.equal(assignments.filter(row => row.group_index === 0).length, 5)
    assert.equal(assignments.filter(row => row.group_index === 1).length, 5)
  })

  it('keeps enabled splits stable and balances an odd roster', () => {
    const options = { roundId: 'round', activePlayers: players.slice(0, 11), bSidesEnabled: true }
    const assignments = buildRoundGroupAssignment(options)
    assert.deepEqual(buildRoundGroupAssignment({ ...options, activePlayers: [...options.activePlayers].reverse() }), assignments)
    assert.deepEqual([0, 1].map(side => assignments.filter(row => row.group_index === side).length).sort(), [5, 6])
  })

  it('continues balancing past pairings when Side B is enabled', () => {
    const activePlayers = players.slice(0, 10)
    const priorGroupRows = activePlayers.map((player, index) => ({
      round_id: 'previous', player_id: player.id, group_index: index < 5 ? 0 : 1,
    }))
    const assignments = buildRoundGroupAssignment({ roundId: 'round', activePlayers, priorGroupRows, bSidesEnabled: true })
    // Each old side is spread 2/3 across the new sides to minimize repeated pairs.
    for (const priorSide of [0, 1]) {
      const priorMembers = new Set(priorGroupRows.filter(row => row.group_index === priorSide).map(row => row.player_id))
      const newSizes = [0, 1].map(side => assignments.filter(row => row.group_index === side && priorMembers.has(row.player_id)).length)
      assert.deepEqual(newSizes.sort(), [2, 3])
    }
  })

  it('uses recorded split sides even when new assignments are disabled', () => {
    const sides = sidesForRound([
      { round_id: 'round', player_id: 'a', group_index: 0 },
      { round_id: 'round', player_id: 'b', group_index: 1 },
    ], 'round')

    assert.equal(shouldSplitRound(12, false), false)
    assert.equal(sides.isSplit, true)
    assert.equal(sideOf(sides, 'a'), 0)
    assert.equal(sideOf(sides, 'b'), 1)
    assert.equal(sidesForRound([], 'round').isSplit, false)
  })
})
