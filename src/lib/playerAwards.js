import { buildAudienceScores, buildGoldenEarScores, buildSongEntries } from './scoring.js'

const AWARDS = {
  currentLeader: {
    key: 'current-leader',
    label: 'Current Leader',
    className: 'badge-leader',
    icon: 'crown',
    title: 'Holds the highest total score in the season standings.',
  },
  latestWinner: {
    key: 'latest-winner',
    label: 'Latest Winner',
    className: 'badge-winner',
    icon: 'trophy',
    title: 'Won the latest scored round. Ties and split-side winners share the medal.',
  },
  novelist: {
    key: 'novelist',
    label: 'The Novelist',
    className: 'badge-novelist',
    icon: 'quill',
    title: 'Writes the most words across all scored-round song descriptions.',
  },
  lurker: {
    key: 'lurker',
    label: 'Lurker',
    className: 'badge-lurker',
    icon: 'eye',
    title: 'Has submitted a song but has never written a comment in a scored round.',
  },
  minimalist: {
    key: 'minimalist',
    label: 'Minimalist',
    className: 'badge-minimalist',
    icon: 'no-quill',
    title: 'Has submitted a song but has never written a submission description in a scored round.',
  },
  communityPillar: {
    key: 'community-pillar',
    label: 'Community Pillar',
    className: 'badge-community-pillar',
    icon: 'pillar',
    title: 'Has written the most comments across scored rounds.',
  },
  provocative: {
    key: 'provocative',
    label: 'Provocative',
    className: 'badge-provocative',
    icon: 'chat',
    title: 'Draws comments from the widest mix of players across their submissions.',
  },
  cultFollowing: {
    key: 'cult-following',
    label: 'Cult Following',
    className: 'badge-cult-following',
    icon: 'orbit',
    title: 'Gets the most concentrated repeat support from a small circle of voters. The score accounts for ballot size and every round each fan had the chance to vote for them.',
  },
  crowdSourced: {
    key: 'crowd-sourced',
    label: 'Crowd Sourced',
    className: 'badge-crowd-sourced',
    icon: 'crowd',
    title: 'Wins support from the broadest mix of eligible voters. We account for how evenly fans divide their points and how often each fan returns.',
  },
  goldenEar: {
    key: 'golden-ear',
    label: 'Golden Ear',
    className: 'badge-golden-ear',
    icon: 'ear',
    title: 'Most consistently backs songs their voting pool also loves. Uses leave-one-out fair scores, so their own ballot cannot boost the result and close runners-up still earn strong credit.',
  },
  deepCut: {
    key: 'deep-cut',
    label: 'Deep Cut',
    className: 'badge-deep-cut',
    icon: 'gem',
    title: 'Gives the most ballot support to songs the rest of their voting pool overlooks. The score removes their own vote, then measures each pick against fair scores adjusted for ballot gaps and voting opportunity.',
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

function winningPlayerIdsForRound({
  roundId,
  songs = [],
  votes = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
}) {
  if (!roundId) return []

  const roundSongs = songs.filter(song => song.round_id === roundId)
  const roundVotes = votes.filter(vote => vote.round_id === roundId)
  const roundDuplicateGroups = duplicateGroups.filter(group => group.round_id === roundId)
  const duplicateGroupIds = new Set(roundDuplicateGroups.map(group => group.id))
  const roundGroupSongs = groupSongs.filter(row => duplicateGroupIds.has(row.group_id))
  const sideByPlayerId = Object.fromEntries(
    roundGroups
      .filter(row => row.round_id === roundId && (Number(row.group_index) === 0 || Number(row.group_index) === 1))
      .map(row => [row.player_id, Number(row.group_index)])
  )
  const isSplit = Object.keys(sideByPlayerId).length > 0
  const entries = buildSongEntries({
    songs: roundSongs,
    votes: roundVotes,
    duplicateGroups: roundDuplicateGroups,
    groupSongs: roundGroupSongs,
    sideByPlayerId: isSplit ? sideByPlayerId : null,
  })
  const entriesByPool = new Map()

  for (const entry of entries) {
    const pool = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
    if (!entriesByPool.has(pool)) entriesByPool.set(pool, [])
    entriesByPool.get(pool).push(entry)
  }

  const winnerIds = new Set()
  for (const poolEntries of entriesByPool.values()) {
    const winningScore = Math.max(...poolEntries.map(entry => entry.totalPoints))
    for (const entry of poolEntries) {
      if (Math.abs(entry.totalPoints - winningScore) > 1e-9) continue
      for (const playerId of entry.submitterIds || []) winnerIds.add(playerId)
    }
  }

  return [...winnerIds]
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
  leaderboard = [],
  latestScoredRoundId = null,
}) {
  const awardsByPlayerId = Object.fromEntries(players.map(player => [player.id, []]))
  const scoredSongs = songs.filter(song => scoredRoundIds.has(song.round_id))
  const descriptionStats = Object.fromEntries(players.map(player => [player.id, {
    id: player.id,
    submissions: 0,
    words: 0,
  }]))

  const scoredLeaders = leaderboard.filter(row => Number(row.total) > 0)
  addAward(awardsByPlayerId, idsAtExtreme(scoredLeaders, row => Number(row.total)), AWARDS.currentLeader)
  addAward(awardsByPlayerId, winningPlayerIdsForRound({
    roundId: latestScoredRoundId,
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    roundGroups,
  }), AWARDS.latestWinner)

  for (const song of scoredSongs) {
    if (!descriptionStats[song.player_id]) {
      descriptionStats[song.player_id] = { id: song.player_id, submissions: 0, words: 0 }
    }
    descriptionStats[song.player_id].submissions += 1
    descriptionStats[song.player_id].words += countWords(song.submitter_note)
  }

  const writers = Object.values(descriptionStats).filter(row => row.words > 0)
  addAward(awardsByPlayerId, idsAtExtreme(writers, row => row.words), AWARDS.novelist)

  const commentCounts = {}
  for (const comment of comments) {
    if (!scoredRoundIds.has(comment.round_id) || !comment.player_id) continue
    commentCounts[comment.player_id] = (commentCounts[comment.player_id] || 0) + 1
  }
  const submitters = Object.values(descriptionStats).filter(row => row.submissions > 0)
  const lurkers = submitters
    .filter(row => !commentCounts[row.id])
    .map(row => row.id)
  addAward(awardsByPlayerId, lurkers, AWARDS.lurker)
  const minimalists = submitters
    .filter(row => row.words === 0)
    .map(row => row.id)
  addAward(awardsByPlayerId, minimalists, AWARDS.minimalist)

  const commenters = Object.entries(commentCounts).map(([id, count]) => ({ id, count }))
  addAward(awardsByPlayerId, idsAtExtreme(commenters, row => row.count), AWARDS.communityPillar)

  const commenterIdsBySubmitter = Object.fromEntries(players.map(player => [player.id, new Set()]))
  for (const roundId of scoredRoundIds) {
    const roundSongs = songs.filter(song => song.round_id === roundId)
    const roundDuplicateGroups = duplicateGroups.filter(group => group.round_id === roundId)
    const duplicateGroupIds = new Set(roundDuplicateGroups.map(group => group.id))
    const roundGroupSongs = groupSongs.filter(row => duplicateGroupIds.has(row.group_id))
    const entries = buildSongEntries({
      songs: roundSongs,
      duplicateGroups: roundDuplicateGroups,
      groupSongs: roundGroupSongs,
    })
    const entryBySongId = new Map()
    for (const entry of entries) {
      for (const songId of entry.member_song_ids || []) entryBySongId.set(songId, entry)
    }

    for (const comment of comments) {
      if (comment.round_id !== roundId || !comment.song_id || !comment.player_id) continue
      const entry = entryBySongId.get(comment.song_id)
      if (!entry) continue
      for (const submitterId of entry.submitterIds || []) {
        if (submitterId === comment.player_id) continue
        if (!commenterIdsBySubmitter[submitterId]) commenterIdsBySubmitter[submitterId] = new Set()
        commenterIdsBySubmitter[submitterId].add(comment.player_id)
      }
    }
  }
  const provocativePlayers = Object.entries(commenterIdsBySubmitter)
    .map(([id, commenterIds]) => ({ id, commenterCount: commenterIds.size }))
    .filter(row => row.commenterCount > 0)
  addAward(awardsByPlayerId, idsAtExtreme(provocativePlayers, row => row.commenterCount), AWARDS.provocative)

  const audienceScores = buildAudienceScores({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    roundGroups,
    scoredRoundIds,
    pointsPerPlayer,
  })
  const audienceRows = Object.entries(audienceScores).map(([id, result]) => ({ id, ...result }))
  const cultFollowingRows = audienceRows.filter(row => Number.isFinite(row.cultFollowingScore))
  addAward(
    awardsByPlayerId,
    idsAtExtreme(cultFollowingRows, row => row.cultFollowingScore),
    AWARDS.cultFollowing
  )

  const maximumFanCount = Math.max(0, ...audienceRows.map(row => row.fanCount))
  const minimumCrowdSize = Math.min(3, maximumFanCount)
  const crowdSourcedRows = audienceRows.filter(row => (
    row.fanCount >= minimumCrowdSize && row.fanCount > 1 && Number.isFinite(row.crowdSourcedScore)
  ))
  addAward(
    awardsByPlayerId,
    idsAtExtreme(crowdSourcedRows, row => row.crowdSourcedScore),
    AWARDS.crowdSourced
  )

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
