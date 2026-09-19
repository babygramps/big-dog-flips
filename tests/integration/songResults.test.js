import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLeaderboard, buildSongEntries } from '../../src/lib/scoring.js'
import { getScoredRoundIds } from '../../src/lib/schedule.js'
import { songLinksFor } from '../../src/lib/songLinks.js'
import { copyTextFor } from '../../src/pages/home/homeUtils.js'
import { makeDuplicateRound, makeSettings, makeSong } from '../fixtures/league.js'

describe('song results across application helpers', () => {
  it('keeps canonical links, fills missing links from duplicates, and searches remaining services', () => {
    const fixture = makeDuplicateRound()

    const [entry] = buildSongEntries(fixture)
    const links = songLinksFor(entry, { includeSearchFallbacks: true })

    assert.equal(links.length, 4)
    assert.equal(links.find(link => link.label === 'Spotify').url, 'https://open.spotify.com/track/canonical')
    assert.equal(links.find(link => link.label === 'TIDAL').url, 'https://tidal.com/track/123')
    assert.deepEqual(links.filter(link => link.isSearch).map(link => link.label), ['Apple Music', 'YouTube Music'])
  })

  it('copies merged song links without including generated search URLs', () => {
    const entries = buildSongEntries(makeDuplicateRound())

    const text = copyTextFor(entries)

    assert.equal(text, '1. Test Artist - Test Song\n   Spotify: https://open.spotify.com/track/canonical\n   TIDAL: https://tidal.com/track/123')
  })

  it('copies a song with no submitted links as a readable artist and title', () => {
    assert.equal(copyTextFor([makeSong({ album: 'Test Album' })]), '1. Test Artist - Test Song (Test Album)')
  })

  it('awards the merged score to both submitters only after the round is scored', () => {
    const fixture = makeDuplicateRound()
    const settings = makeSettings()
    const duringVoting = getScoredRoundIds(fixture.rounds, settings, new Date('2026-09-19T19:00:00Z'))
    const duringAppreciation = getScoredRoundIds(fixture.rounds, settings, new Date('2026-09-20T19:00:00Z'))

    const hiddenScores = buildLeaderboard({ ...fixture, scoredRoundIds: duringVoting })
    const revealedScores = buildLeaderboard({ ...fixture, scoredRoundIds: duringAppreciation })

    assert.deepEqual(hiddenScores.map(player => player.total), [0, 0])
    assert.deepEqual(revealedScores.map(player => [player.id, player.total]), [['player-a', 11], ['player-b', 11]])
  })
})
