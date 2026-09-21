import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adjustedVote, ballotBudget } from '../../src/lib/ballot.js'
import { votePointsByPlayer, voteProgressFor } from '../../src/lib/voteProgress.js'
import { buildSongEntries, buildLeaderboard } from '../../src/lib/scoring.js'

describe('three votes with at most one downvote', () => {
  it('allows a third upvote or a downvote within the same allowance', () => {
    assert.equal(adjustedVote({ a: 2 }, 'b', 1), 1)
    assert.equal(adjustedVote({ a: 2 }, 'a', 1), 3)
    assert.equal(adjustedVote({ a: 3 }, 'b', 1), 0)
    assert.equal(adjustedVote({ a: 3 }, 'b', -1), 0)
    assert.equal(adjustedVote({ a: 2, b: -1 }, 'c', 1), 0)
    assert.equal(adjustedVote({ b: -1 }, 'c', -1), 0)
    assert.equal(ballotBudget({ a: 3 }).pointsUsed, 3)
    assert.equal(adjustedVote({ a: 2 }, 'b', -1), -1)
    assert.equal(adjustedVote({ a: 2, b: -1 }, 'c', -1), 0)
    assert.equal(adjustedVote({ a: 2, b: -1 }, 'b', -1), -1)
    assert.equal(ballotBudget({ a: 2, b: -1 }).pointsUsed, 3)
  })
  it('allows undoing and moving either kind of vote', () => {
    assert.equal(adjustedVote({ a: 2, b: -1 }, 'b', 1), 0)
    assert.equal(adjustedVote({ a: 2, b: -1 }, 'a', -1), 1)
    assert.equal(adjustedVote({ a: 1, b: -1 }, 'c', 1), 1)
    assert.equal(adjustedVote({ a: 2 }, 'c', -1), -1)
  })
  it('counts a downvote toward ballot completion without canceling upvotes', () => {
    const points = votePointsByPlayer([{ voter_player_id: 'p', points: 2 }, { voter_player_id: 'p', points: -1 }])
    assert.equal(points.get('p'), 3)
    assert.equal(voteProgressFor(points.get('p'), 3), 'complete')
    assert.equal(voteProgressFor(votePointsByPlayer([{ voter_player_id: 'p', points: -1 }]).get('p'), 3), 'partial')
  })
  it('subtracts downvotes and excludes self-votes even for negative totals', () => {
    const songs = [{ id: 's', round_id: 'r', player_id: 'p', title: 'Song' }]
    const votes = [{ song_id: 's', round_id: 'r', voter_player_id: 'other', points: -1 }, { song_id: 's', round_id: 'r', voter_player_id: 'p', points: -1 }]
    assert.equal(buildSongEntries({ songs, votes })[0].totalPoints, -1)
    const standings = buildLeaderboard({ players: [{ id: 'p', name: 'Player', active: false }], songs, votes, scoredRoundIds: new Set(['r']) })
    assert.equal(standings[0].total, -1)
  })
  it('combines signed duplicate votes and removes votes from either submitter', () => {
    const songs = [{ id: 'a', round_id: 'r', player_id: 'p', title: 'Song' }, { id: 'b', round_id: 'r', player_id: 'q', title: 'Song' }]
    const entries = buildSongEntries({ songs, votes: [
      { song_id: 'a', voter_player_id: 'x', points: 2 },
      { song_id: 'b', voter_player_id: 'y', points: -1 },
      { song_id: 'b', voter_player_id: 'p', points: -1 },
    ], duplicateGroups: [{ id: 'g', round_id: 'r', canonical_song_id: 'a' }], groupSongs: [{ group_id: 'g', song_id: 'a' }, { group_id: 'g', song_id: 'b' }] })
    assert.equal(entries[0].totalPoints, 2)
    assert.equal(entries[0].ineligiblePoints, -1)
  })
})
