import { buildGoldenEarScores } from './scoring.js'

const AWARDS = {
  novelist: {
    key: 'novelist',
    label: 'The Novelist',
    className: 'badge-novelist',
    mark: 'Aa',
    title: 'Writes the most words across all scored-round song descriptions.',
  },
  sayLess: {
    key: 'say-less',
    label: 'Say Less',
    className: 'badge-say-less',
    mark: '…',
    title: 'Uses the fewest words across scored-round song descriptions, with at least two submissions and one real description.',
  },
  chatterBox: {
    key: 'chatter-box',
    label: 'Chatter Box',
    className: 'badge-chatter-box',
    mark: '“ ”',
    title: 'Has posted the most comments across scored rounds.',
  },
  goldenEar: {
    key: 'golden-ear',
    label: 'Golden Ear',
    className: 'badge-golden-ear',
    mark: 'GE',
    title: 'Most consistently backs songs their voting pool also loves. Uses leave-one-out fair scores, so their own ballot cannot boost the result and close runners-up still earn strong credit.',
  },
  deepCut: {
    key: 'deep-cut',
    label: 'Deep Cut',
    className: 'badge-deep-cut',
    mark: 'DC',
    title: 'Most consistently champions songs their voting pool overlooks. Uses the same leave-one-out fair-score curve as Golden Ear, inverted.',
  },
}

function countWords(value) {
  const text = String(value || '').trim()
  return text ? text.split(/\s+/u).length : 0
}

function addAward(awardsByPlayerId, playerIds, award) {
  for (const playerId of playerIds) {
    if (!awardsByPlayerId[playerId]) awardsByPlayerId[playerId] = []
    awardsByPlayerId[playerId].push(award)
  }
}

function idsAtExtreme(rows, valueFor, mode = 'max') {
  if (rows.length === 0) return []
  const values = rows.map(valueFor)
  const extreme = mode === 'min' ? Math.min(...values) : Math.max(...values)
  return rows.filter(row => Math.abs(valueFor(row) - extreme) <= 1e-9).map(row => row.id)
}

export function buildPlayerAwards({
  players = [],
  songs = [],
  votes = [],
  comments = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
  scoredRoundIds = new Set(),
  pointsPerPlayer = 10,
}) {
  const awardsByPlayerId = Object.fromEntries(players.map(player => [player.id, []]))
  const scoredSongs = songs.filter(song => scoredRoundIds.has(song.round_id))
  const descriptionStats = Object.fromEntries(players.map(player => [player.id, {
    id: player.id,
    submissions: 0,
    words: 0,
  }]))

  for (const song of scoredSongs) {
    if (!descriptionStats[song.player_id]) {
      descriptionStats[song.player_id] = { id: song.player_id, submissions: 0, words: 0 }
    }
    descriptionStats[song.player_id].submissions += 1
    descriptionStats[song.player_id].words += countWords(song.submitter_note)
  }

  const writers = Object.values(descriptionStats).filter(row => row.words > 0)
  addAward(awardsByPlayerId, idsAtExtreme(writers, row => row.words), AWARDS.novelist)

  const conciseWriters = writers.filter(row => row.submissions >= 2)
  const conciseWordTotals = new Set(conciseWriters.map(row => row.words))
  if (conciseWordTotals.size > 1) {
    addAward(awardsByPlayerId, idsAtExtreme(conciseWriters, row => row.words, 'min'), AWARDS.sayLess)
  }

  const commentCounts = {}
  for (const comment of comments) {
    if (!scoredRoundIds.has(comment.round_id) || !comment.player_id) continue
    commentCounts[comment.player_id] = (commentCounts[comment.player_id] || 0) + 1
  }
  const commenters = Object.entries(commentCounts).map(([id, count]) => ({ id, count }))
  addAward(awardsByPlayerId, idsAtExtreme(commenters, row => row.count), AWARDS.chatterBox)

  const goldenEarScores = buildGoldenEarScores({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    roundGroups,
    scoredRoundIds,
    pointsPerPlayer,
  })
  const goldenEarRows = Object.entries(goldenEarScores).map(([id, result]) => ({ id, ...result }))
  const maximumBallotWeight = Math.max(0, ...goldenEarRows.map(row => row.ballotWeight))
  const minimumBallotWeight = Math.min(2, maximumBallotWeight)
  const experiencedListeners = goldenEarRows.filter(row => row.ballotWeight + 1e-9 >= minimumBallotWeight)
  const goldenEarScoreRange = experiencedListeners.length > 1
    ? Math.max(...experiencedListeners.map(row => row.score)) - Math.min(...experiencedListeners.map(row => row.score))
    : 0

  if (goldenEarScoreRange > 1e-9) {
    addAward(awardsByPlayerId, idsAtExtreme(experiencedListeners, row => row.score), AWARDS.goldenEar)
    addAward(awardsByPlayerId, idsAtExtreme(experiencedListeners, row => row.uniquenessScore), AWARDS.deepCut)
  }

  return awardsByPlayerId
}
