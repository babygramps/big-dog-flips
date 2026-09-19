import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildSongEntries, rankEntries } from '../../src/lib/scoring.js'
import { makeDuplicateRound, makeSong, makeVote } from '../fixtures/league.js'

describe('song scoring', () => {
  it('discards self-votes while allowing another player to spend their whole bank on one song', () => {
    const songs = [makeSong()]
    const votes = [makeVote({ points: 3 }), makeVote({ id: 'self', voter_player_id: 'player-a', points: 3 })]

    const [entry] = buildSongEntries({ songs, votes })

    assert.equal(entry.totalPoints, 3)
    assert.equal(entry.ineligiblePoints, 3)
  })

  it('removes all duplicate submitters’ votes and adds one courtesy point for two submitters', () => {
    const fixture = makeDuplicateRound()
    const originalVotes = structuredClone(fixture.votes)

    const entries = buildSongEntries(fixture)

    assert.equal(entries.length, 1)
    assert.equal(entries[0].votePoints, 10)
    assert.equal(entries[0].ineligiblePoints, 5)
    assert.equal(entries[0].courtesyPoints, 1)
    assert.equal(entries[0].totalPoints, 11)
    assert.deepEqual(fixture.votes, originalVotes, 'merging must never rewrite original votes')
  })

  it('gives ties the same rank and skips the next place', () => {
    const entries = [{ totalPoints: 10 }, { totalPoints: 10 }, { totalPoints: 5 }]

    assert.deepEqual(rankEntries(entries).map(entry => entry.rank), [1, 1, 3])
    assert.ok(entries.every(entry => !('rank' in entry)), 'ranking must not mutate its input')
  })
})
