import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createBonusVotesHandler } from '../../api/bonus-votes.js'

const roundId = '11111111-1111-1111-1111-111111111111'
const songId = '22222222-2222-2222-2222-222222222222'
const otherRound = '33333333-3333-3333-3333-333333333333'
function request(handler, body, method = 'POST') {
  const res = {
    statusCode: 200, headers: {},
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
  handler({ method, body }, res)
  return res
}

describe('shared temporary Side B votes', () => {
  it('shows votes from independent viewers without a player identity or vote budget', () => {
    const handler = createBonusVotesHandler()
    for (let i = 0; i < 10; i++) request(handler, { roundId, songId, delta: 1 })
    request(handler, { roundId, songId, delta: -1 })
    const viewer = request(handler, { roundId })
    assert.deepEqual(viewer.body, { totals: { [songId]: 9 } })
    assert.equal(viewer.headers['Cache-Control'], 'no-store')
    assert.deepEqual(request(handler, { roundId: otherRound }).body, { totals: {} })
    // A fresh page reads the same total, and cannot mutate the server's returned state.
    viewer.body.totals[songId] = 999
    assert.deepEqual(request(handler, { roundId }).body, { totals: { [songId]: 9 } })
    for (let i = 0; i < 12; i++) request(handler, { roundId, songId, delta: -1 })
    assert.equal(request(handler, { roundId }).body.totals[songId], -3)
  })

  it('forgets votes on server restart or seven days after the first vote', () => {
    let time = 0
    const handler = createBonusVotesHandler({ now: () => time })
    request(handler, { roundId, songId, delta: 1 })
    assert.deepEqual(request(createBonusVotesHandler(), { roundId }).body, { totals: {} })
    time = 7 * 24 * 60 * 60 * 1000 - 1
    assert.equal(request(handler, { roundId }).body.totals[songId], 1)
    request(handler, { roundId, songId, delta: 1 })
    time++
    assert.deepEqual(request(handler, { roundId }).body, { totals: {} })
    assert.equal(request(handler, { roundId, songId, delta: 1 }).body.totals[songId], 1)
  })

  it('rejects invalid requests without changing shared totals', () => {
    const handler = createBonusVotesHandler()
    assert.equal(request(handler, {}, 'GET').statusCode, 405)
    for (const body of [{}, { roundId: 'bad' }, { roundId, songId, delta: 20 },
      { roundId, songId, delta: '1' }, { roundId, delta: 1 }]) {
      assert.equal(request(handler, body).statusCode, 400)
    }
    assert.deepEqual(request(handler, { roundId }).body, { totals: {} })
  })
})
