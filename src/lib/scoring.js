function playerLabel(player) {
  return player?.name || 'Unknown player'
}

function uniqueById(items) {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export function groupMembership(groupSongs = []) {
  const songToGroup = {}
  const groupToSongs = {}

  for (const row of groupSongs || []) {
    if (!row.group_id || !row.song_id) continue
    songToGroup[row.song_id] = row.group_id
    if (!groupToSongs[row.group_id]) groupToSongs[row.group_id] = []
    groupToSongs[row.group_id].push(row.song_id)
  }

  return { songToGroup, groupToSongs }
}

function sideForPlayers(sideByPlayerId, playerIds = []) {
  if (!sideByPlayerId) return null
  for (const playerId of playerIds) {
    const side = sideByPlayerId[playerId]
    if (side === 0 || side === 1) return side
  }
  return null
}

export function buildSongEntries({ songs = [], votes = [], duplicateGroups = [], groupSongs = [], sideByPlayerId = null }) {
  const songMap = Object.fromEntries((songs || []).map(song => [song.id, song]))
  const groupMap = Object.fromEntries((duplicateGroups || []).map(group => [group.id, group]))
  const { songToGroup, groupToSongs } = groupMembership(groupSongs)
  const usedSongIds = new Set()
  const entries = []

  for (const group of duplicateGroups || []) {
    const memberIds = groupToSongs[group.id] || []
    const memberSongs = memberIds.map(id => songMap[id]).filter(Boolean)
    if (memberSongs.length < 2) continue

    memberSongs.forEach(song => usedSongIds.add(song.id))
    const submitters = uniqueById(memberSongs.map(song => song.players || song.player).filter(Boolean))
    const submitterIds = new Set(memberSongs.map(song => song.player_id).filter(Boolean))
    const memberSet = new Set(memberSongs.map(song => song.id))
    const eligibleVotes = (votes || []).filter(vote => memberSet.has(vote.song_id) && !submitterIds.has(vote.voter_player_id))
    const ineligibleVotes = (votes || []).filter(vote => memberSet.has(vote.song_id) && submitterIds.has(vote.voter_player_id))
    const votePoints = eligibleVotes.reduce((sum, vote) => sum + (Number(vote.points) || 0), 0)
    const courtesyPoints = Math.max(0, submitterIds.size - 1)
    const canonical = songMap[group.canonical_song_id] || memberSongs[0]
    const totalPoints = votePoints + courtesyPoints

    entries.push({
      id: `group:${group.id}`,
      round_id: group.round_id,
      group_id: group.id,
      isDuplicate: true,
      label: group.label || 'Duplicate merge',
      canonical_song_id: canonical.id,
      member_song_ids: memberSongs.map(song => song.id),
      title: canonical.title,
      artist: canonical.artist,
      album: canonical.album,
      link: canonical.link,
      submitter_note: canonical.submitter_note,
      songs: memberSongs,
      submitters,
      submitterIds: [...submitterIds],
      side: sideForPlayers(sideByPlayerId, [...submitterIds]),
      votePoints,
      courtesyPoints,
      totalPoints,
      ineligiblePoints: ineligibleVotes.reduce((sum, vote) => sum + (Number(vote.points) || 0), 0),
      voteCount: eligibleVotes.length,
      ineligibleVoteCount: ineligibleVotes.length,
    })
  }

  for (const song of songs || []) {
    if (usedSongIds.has(song.id) || songToGroup[song.id]) continue

    const eligibleVotes = (votes || []).filter(vote => vote.song_id === song.id && vote.voter_player_id !== song.player_id)
    const ineligibleVotes = (votes || []).filter(vote => vote.song_id === song.id && vote.voter_player_id === song.player_id)
    const votePoints = eligibleVotes.reduce((sum, vote) => sum + (Number(vote.points) || 0), 0)

    entries.push({
      id: `song:${song.id}`,
      round_id: song.round_id,
      group_id: null,
      isDuplicate: false,
      canonical_song_id: song.id,
      member_song_ids: [song.id],
      title: song.title,
      artist: song.artist,
      album: song.album,
      link: song.link,
      submitter_note: song.submitter_note,
      songs: [song],
      submitters: song.players ? [song.players] : [],
      submitterIds: [song.player_id],
      side: sideForPlayers(sideByPlayerId, [song.player_id]),
      votePoints,
      courtesyPoints: 0,
      totalPoints: votePoints,
      ineligiblePoints: ineligibleVotes.reduce((sum, vote) => sum + (Number(vote.points) || 0), 0),
      voteCount: eligibleVotes.length,
      ineligibleVoteCount: ineligibleVotes.length,
    })
  }

  return entries.sort((a, b) => b.totalPoints - a.totalPoints || a.title.localeCompare(b.title))
}

// Standard competition ranking: entries on the same score share a place and the next place skips
// past them, so a two-way tie for first reads 1, 1, 3 rather than inventing an order between them.
// Expects the descending sort buildSongEntries already applies.
export function rankEntries(entries = []) {
  let rank = 0
  let previousScore = null

  return entries.map((entry, index) => {
    if (entry.totalPoints !== previousScore) {
      rank = index + 1
      previousScore = entry.totalPoints
    }
    return { ...entry, rank }
  })
}

export function entrySubmitterText(entry) {
  if (!entry?.submitters?.length) return 'Unknown player'
  return entry.submitters.map(playerLabel).join(' + ')
}

export function buildLeaderboard({ players = [], rounds = [], songs = [], votes = [], duplicateGroups = [], groupSongs = [], scoredRoundIds = new Set() }) {
  const playerMap = Object.fromEntries((players || []).map(player => [player.id, player]))
  const roundMap = Object.fromEntries((rounds || []).map(round => [round.id, round]))
  const tally = {}

  for (const player of players || []) {
    tally[player.id] = {
      id: player.id,
      name: player.name,
      avatar_url: player.avatar_url,
      avatar_color: player.avatar_color,
      total: 0,
      byRound: {},
    }
  }

  for (const roundId of scoredRoundIds || []) {
    const roundSongs = songs.filter(song => song.round_id === roundId)
    const roundVotes = votes.filter(vote => vote.round_id === roundId)
    const roundGroups = duplicateGroups.filter(group => group.round_id === roundId)
    const groupIds = new Set(roundGroups.map(group => group.id))
    const roundGroupSongs = groupSongs.filter(row => groupIds.has(row.group_id))
    const entries = buildSongEntries({
      songs: roundSongs,
      votes: roundVotes,
      duplicateGroups: roundGroups,
      groupSongs: roundGroupSongs,
    })

    for (const entry of entries) {
      for (const playerId of entry.submitterIds || []) {
        if (!tally[playerId]) {
          const player = playerMap[playerId]
          tally[playerId] = {
            id: playerId,
            name: player?.name || 'Unknown player',
            avatar_url: player?.avatar_url,
            avatar_color: player?.avatar_color,
            total: 0,
            byRound: {},
          }
        }
        tally[playerId].total += entry.totalPoints
        tally[playerId].byRound[roundId] = (tally[playerId].byRound[roundId] || 0) + entry.totalPoints
      }
    }
  }

  return Object.values(tally)
    .filter(player => player.total > 0 || players.some(p => p.id === player.id && p.active))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(player => ({
      ...player,
      roundNames: Object.fromEntries(Object.keys(player.byRound).map(roundId => [roundId, roundMap[roundId]?.theme_name || 'Round'])),
    }))
}

function fairPointsForPool({ poolEntries, poolVotes, entryBySongId, budget, excludedVoterId = null }) {
  // Submitters who skip voting still contribute a neutral ballot. People who did not
  // submit only enter the pool when they cast at least one point.
  const participantIds = new Set(poolEntries.flatMap(entry => entry.submitterIds || []))
  for (const vote of poolVotes) {
    if (Number(vote.points) > 0) participantIds.add(vote.voter_player_id)
  }
  if (excludedVoterId) participantIds.delete(excludedVoterId)

  const filledPointsByEntryId = Object.fromEntries(poolEntries.map(entry => [entry.id, 0]))
  const neutralOpportunityByEntryId = Object.fromEntries(poolEntries.map(entry => [entry.id, 0]))

  for (const voterId of participantIds) {
    const eligibleEntries = poolEntries.filter(entry => !(entry.submitterIds || []).includes(voterId))
    if (eligibleEntries.length === 0) continue

    const actualPointsByEntryId = Object.fromEntries(eligibleEntries.map(entry => [entry.id, 0]))
    for (const vote of poolVotes) {
      if (vote.voter_player_id !== voterId) continue
      const entry = entryBySongId.get(vote.song_id)
      if (!entry || actualPointsByEntryId[entry.id] === undefined) continue
      actualPointsByEntryId[entry.id] += Math.max(0, Number(vote.points) || 0)
    }

    const actualSpent = Object.values(actualPointsByEntryId).reduce((sum, points) => sum + points, 0)
    const actualScale = actualSpent > budget ? budget / actualSpent : 1
    const unspentPoints = budget - Math.min(budget, actualSpent)
    const neutralFill = unspentPoints / eligibleEntries.length
    const neutralOpportunity = budget / eligibleEntries.length

    for (const entry of eligibleEntries) {
      filledPointsByEntryId[entry.id] += actualPointsByEntryId[entry.id] * actualScale + neutralFill
      neutralOpportunityByEntryId[entry.id] += neutralOpportunity
    }
  }

  return Object.fromEntries(poolEntries.map(entry => {
    const neutralOpportunity = neutralOpportunityByEntryId[entry.id]
    const fairPoints = neutralOpportunity > 0
      ? budget * filledPointsByEntryId[entry.id] / neutralOpportunity
      : 0
    return [entry.id, fairPoints]
  }))
}

// Experimental vanity score. Each submitter is treated as holding a complete ballot:
// actual eligible votes stay as cast, while any unspent budget is divided evenly among
// the entries they could vote for. The result is then compared with that entry's neutral
// opportunity and returned to the familiar per-round points scale. This does not replace
// buildLeaderboard or the official raw score anywhere in the app.
export function buildFairScores({
  songs = [],
  votes = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
  scoredRoundIds = new Set(),
  pointsPerPlayer = 10,
}) {
  const budget = Math.max(1, Number(pointsPerPlayer) || 10)
  const fairScores = {}

  for (const roundId of scoredRoundIds || []) {
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
    const entryBySongId = new Map()
    const entriesByPool = new Map()

    for (const entry of entries) {
      const pool = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
      if (!entriesByPool.has(pool)) entriesByPool.set(pool, [])
      entriesByPool.get(pool).push(entry)
      for (const songId of entry.member_song_ids || []) entryBySongId.set(songId, entry)
    }

    for (const [pool, poolEntries] of entriesByPool) {
      const poolVotes = roundVotes.filter(vote => {
        const entry = entryBySongId.get(vote.song_id)
        if (!entry) return false
        const entryPool = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
        return entryPool === pool
      })
      const fairPointsByEntryId = fairPointsForPool({ poolEntries, poolVotes, entryBySongId, budget })

      for (const entry of poolEntries) {
        const fairPoints = fairPointsByEntryId[entry.id]

        for (const playerId of entry.submitterIds || []) {
          if (!fairScores[playerId]) fairScores[playerId] = { total: 0, byRound: {} }
          fairScores[playerId].total += fairPoints
          fairScores[playerId].byRound[roundId] = (fairScores[playerId].byRound[roundId] || 0) + fairPoints
        }
      }
    }
  }

  return fairScores
}

// Golden Ear and Deep Cut measure how each ballot relates to the rest of its pool's taste.
// Popularity is calculated with the fair-score model above, but with the voter being
// evaluated removed so their own points cannot improve their result. A song's quality
// blends its fair-score distance from the field (70%) with its percentile rank (30%),
// which gives a close second nearly as much credit as the winner. Ballot points weight
// that quality; Deep Cut uses the inverse. Partial ballots contribute proportionally,
// and a neutral prior tempers tiny samples.
export function buildGoldenEarScores({
  songs = [],
  votes = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
  scoredRoundIds = new Set(),
  pointsPerPlayer = 10,
}) {
  const budget = Math.max(1, Number(pointsPerPlayer) || 10)
  const tallies = {}
  const epsilon = 1e-9

  for (const roundId of scoredRoundIds || []) {
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
    const entryBySongId = new Map()
    const entriesByPool = new Map()

    for (const entry of entries) {
      const pool = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
      if (!entriesByPool.has(pool)) entriesByPool.set(pool, [])
      entriesByPool.get(pool).push(entry)
      for (const songId of entry.member_song_ids || []) entryBySongId.set(songId, entry)
    }

    for (const [pool, poolEntries] of entriesByPool) {
      const poolVotes = roundVotes.filter(vote => {
        const entry = entryBySongId.get(vote.song_id)
        if (!entry) return false
        const entryPool = entry.side === 0 || entry.side === 1 ? entry.side : 'all'
        return entryPool === pool
      })
      const voterIds = new Set(
        poolVotes
          .filter(vote => Number(vote.points) > 0)
          .map(vote => vote.voter_player_id)
      )

      for (const voterId of voterIds) {
        const eligibleEntries = poolEntries.filter(entry => !(entry.submitterIds || []).includes(voterId))
        if (eligibleEntries.length < 2) continue

        const ballotPointsByEntryId = Object.fromEntries(eligibleEntries.map(entry => [entry.id, 0]))
        for (const vote of poolVotes) {
          if (vote.voter_player_id !== voterId) continue
          const entry = entryBySongId.get(vote.song_id)
          if (!entry || ballotPointsByEntryId[entry.id] === undefined) continue
          ballotPointsByEntryId[entry.id] += Math.max(0, Number(vote.points) || 0)
        }

        const spent = Object.values(ballotPointsByEntryId).reduce((sum, points) => sum + points, 0)
        if (spent <= 0) continue

        const fairPointsByEntryId = fairPointsForPool({
          poolEntries,
          poolVotes,
          entryBySongId,
          budget,
          excludedVoterId: voterId,
        })
        const eligibleFairScores = eligibleEntries.map(entry => fairPointsByEntryId[entry.id] || 0)
        const minimumFairScore = Math.min(...eligibleFairScores)
        const maximumFairScore = Math.max(...eligibleFairScores)
        const fairScoreRange = maximumFairScore - minimumFairScore
        let ballotAccuracy = 0

        for (const entry of eligibleEntries) {
          const points = ballotPointsByEntryId[entry.id]
          if (points <= 0) continue

          const fairScore = fairPointsByEntryId[entry.id] || 0
          const lowerCount = eligibleFairScores.filter(score => score < fairScore - epsilon).length
          const tiedCount = eligibleFairScores.filter(score => Math.abs(score - fairScore) <= epsilon).length
          const percentile = (lowerCount + (tiedCount - 1) / 2) / (eligibleEntries.length - 1)
          const rangePosition = fairScoreRange > epsilon
            ? (fairScore - minimumFairScore) / fairScoreRange
            : 0.5
          const popularityQuality = 0.7 * rangePosition + 0.3 * percentile
          ballotAccuracy += points / spent * popularityQuality
        }

        const completion = Math.min(1, spent / budget)
        if (!tallies[voterId]) {
          tallies[voterId] = { accuracyTotal: 0, uniquenessTotal: 0, ballotWeight: 0, ballots: 0, byRound: {} }
        }
        tallies[voterId].accuracyTotal += ballotAccuracy * completion
        tallies[voterId].uniquenessTotal += (1 - ballotAccuracy) * completion
        tallies[voterId].ballotWeight += completion
        tallies[voterId].ballots += 1
        tallies[voterId].byRound[roundId] = {
          popularity: ballotAccuracy,
          uniqueness: 1 - ballotAccuracy,
        }
      }
    }
  }

  const neutralPriorWeight = 2
  return Object.fromEntries(Object.entries(tallies).map(([playerId, tally]) => {
    const rawScore = tally.ballotWeight > 0 ? tally.accuracyTotal / tally.ballotWeight : 0.5
    const score = (tally.accuracyTotal + 0.5 * neutralPriorWeight) / (tally.ballotWeight + neutralPriorWeight)
    const uniquenessRawScore = tally.ballotWeight > 0 ? tally.uniquenessTotal / tally.ballotWeight : 0.5
    const uniquenessScore = (tally.uniquenessTotal + 0.5 * neutralPriorWeight) / (tally.ballotWeight + neutralPriorWeight)
    return [playerId, { ...tally, rawScore, score, uniquenessRawScore, uniquenessScore }]
  }))
}

export function voterHasCompleted(votes = [], roundId, playerId) {
  return votes.some(vote => vote.round_id === roundId && vote.voter_player_id === playerId && Number(vote.points) > 0)
}
