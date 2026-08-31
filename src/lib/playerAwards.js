import {
  buildAudienceScores,
  buildGoldenEarScores,
  buildSongEntries,
  buildSubmissionRangesByPlayer,
  buildTopSongsByPlayer,
} from "./scoring.js";

const AWARDS = {
  incognito: {
    key: "incognito",
    label: "Incognito",
    className: "badge-incognito",
    icon: "incognito",
    title: "Has not added a custom profile picture.",
  },
  deepInThought: {
    key: "deep-in-thought",
    label: "Deep in Thought",
    className: "badge-deep-in-thought",
    icon: "thought",
    title: "Has not submitted a round theme yet. They're still pondering it.",
  },
  lurker: {
    key: "lurker",
    label: "Lurker",
    className: "badge-lurker",
    icon: "eye",
    title: "Has never written a comment in a scored round.",
  },
  currentLeader: {
    key: "current-leader",
    label: "Current Leader",
    className: "badge-leader",
    icon: "crown",
    title: "Holds the highest total score in the season standings.",
  },
  latestWinner: {
    key: "latest-winner",
    label: "Latest Winner",
    className: "badge-winner",
    icon: "trophy",
    title: "Won their side of the latest scored round.",
  },
  bestSong: {
    key: "best-song",
    label: "Best Song",
    className: "badge-best-song",
    icon: "record-star",
    title: "Submitted the highest-scoring song across all scored rounds.",
  },
  seasonOneWinner: {
    key: "season-one-winner",
    label: "Season 1 Winner",
    className: "badge-season-one-winner",
    icon: "trophy",
    title: "Won Muzak Season 1.",
  },
  highsAndLows: {
    key: "highs-and-lows",
    label: "Highs and Lows",
    className: "badge-highs-and-lows",
    icon: "waveform",
    title:
      "Has the biggest gap between their highest- and lowest-scoring songs across scored rounds.",
  },
  consistencyQueen: {
    key: "consistency-queen",
    label: "Consistency Queen",
    className: "badge-consistency-queen",
    icon: "metronome",
    title:
      "Has the smallest gap between their highest- and lowest-scoring songs across scored rounds.",
  },
  underground: {
    key: "underground",
    label: "Underground",
    className: "badge-underground",
    icon: "underground",
    title:
      "Their taste operates far beneath the mainstream; someday, the rest of us may catch up.",
  },
  novelist: {
    key: "novelist",
    label: "The Novelist",
    className: "badge-novelist",
    icon: "quill",
    title: "Writes the most words across all scored-round song descriptions.",
  },
  minimalist: {
    key: "minimalist",
    label: "Minimalist",
    className: "badge-minimalist",
    icon: "no-quill",
    title: "Has never written a submission description in a scored round.",
  },
  communityPillar: {
    key: "community-pillar",
    label: "Community Pillar",
    className: "badge-community-pillar",
    icon: "pillar",
    title: "Has written the most comments across scored rounds.",
  },
  provocative: {
    key: "provocative",
    label: "Provocative",
    className: "badge-provocative",
    icon: "chat",
    title:
      "Draws comments from the widest mix of players across their submissions.",
  },
  cultFollowing: {
    key: "cult-following",
    label: "Cult Following",
    className: "badge-cult-following",
    icon: "orbit",
    title:
      "Gets the most concentrated repeat support from a small circle of voters.",
  },
  crowdSourced: {
    key: "crowd-sourced",
    label: "Crowd Sourced",
    className: "badge-crowd-sourced",
    icon: "crowd",
    title: "Wins support from the broadest mix of eligible voters.",
  },
  goldenEar: {
    key: "golden-ear",
    label: "Golden Ear",
    className: "badge-golden-ear",
    icon: "ear",
    title: "Most consistently backs songs their voting pool also loves.",
  },
  deepCut: {
    key: "deep-cut",
    label: "Deep Cut",
    className: "badge-deep-cut",
    icon: "gem",
    title:
      "Gives the most ballot support to songs the rest of their voting pool overlooks.",
  },
  fastest: {
    key: "fastest",
    label: "Eager Beaver",
    className: "badge-fastest",
    icon: "bolt",
    title:
      "Most consistently submits songs and completes full ballots ahead of the pack.",
  },
  slowest: {
    key: "slowest",
    label: "Procrastinator",
    className: "badge-slowest",
    icon: "hourglass",
    title:
      "Most consistently submits songs and completes full ballots later than the pack.",
  },
};

const AWARD_ORDER = new Map(
  Object.values(AWARDS).map((award, index) => [award.key, index]),
);

function countWords(value) {
  const text = String(value || "").trim();
  return text ? text.split(/\s+/u).length : 0;
}

function addAward(awardsByPlayerId, playerIds, award) {
  for (const playerId of playerIds) {
    if (!awardsByPlayerId[playerId]) awardsByPlayerId[playerId] = [];
    awardsByPlayerId[playerId].push(award);
  }
}

function idsAtExtreme(rows, valueFor, mode = "max") {
  if (rows.length === 0) return [];
  const values = rows.map(valueFor);
  const extreme = mode === "min" ? Math.min(...values) : Math.max(...values);
  return rows
    .filter((row) => Math.abs(valueFor(row) - extreme) <= 1e-9)
    .map((row) => row.id);
}

function idsAtStandingExtreme(rows, fairScores, mode = "max") {
  const idsAtTotalExtreme = new Set(
    idsAtExtreme(rows, (row) => Number(row.total), mode),
  );
  const tiedRows = rows.filter((row) => idsAtTotalExtreme.has(row.id));
  return idsAtExtreme(
    tiedRows,
    (row) => Number(fairScores[row.id]?.total) || 0,
    mode,
  );
}

function timestampValue(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

// Rank each action against the other finishers in that round. This keeps schedule
// changes from making one week's raw elapsed time incomparable with another's.
function addPaceRanks(rows, category, paceByPlayerId) {
  const rankedRows = rows
    .map((row) => ({ ...row, timestamp: timestampValue(row.timestamp) }))
    .filter((row) => row.id && row.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (rankedRows.length < 2) return;

  let index = 0;
  while (index < rankedRows.length) {
    let tieEnd = index + 1;
    while (
      tieEnd < rankedRows.length &&
      rankedRows[tieEnd].timestamp === rankedRows[index].timestamp
    ) {
      tieEnd += 1;
    }

    const averageRank = (index + tieEnd - 1) / 2;
    const percentile = averageRank / (rankedRows.length - 1);
    for (let tieIndex = index; tieIndex < tieEnd; tieIndex += 1) {
      const playerId = rankedRows[tieIndex].id;
      if (!paceByPlayerId[playerId]) {
        paceByPlayerId[playerId] = {
          id: playerId,
          submissionTotal: 0,
          submissionCount: 0,
          votingTotal: 0,
          votingCount: 0,
        };
      }
      paceByPlayerId[playerId][`${category}Total`] += percentile;
      paceByPlayerId[playerId][`${category}Count`] += 1;
    }

    index = tieEnd;
  }
}

function buildPaceRows({
  players = [],
  songs = [],
  votes = [],
  scoredRoundIds = new Set(),
  pointsPerPlayer = 10,
}) {
  const fullBallotPoints = Math.max(1, Number(pointsPerPlayer) || 10);
  const paceByPlayerId = Object.fromEntries(
    players.map((player) => [
      player.id,
      {
        id: player.id,
        submissionTotal: 0,
        submissionCount: 0,
        votingTotal: 0,
        votingCount: 0,
      },
    ]),
  );

  for (const roundId of scoredRoundIds) {
    // created_at preserves the player's first submission even if they edit it later.
    addPaceRanks(
      songs
        .filter((song) => song.round_id === roundId)
        .map((song) => ({ id: song.player_id, timestamp: song.created_at })),
      "submission",
      paceByPlayerId,
    );

    const ballotsByPlayerId = new Map();
    for (const vote of votes) {
      if (vote.round_id !== roundId || !vote.voter_player_id) continue;
      if (!ballotsByPlayerId.has(vote.voter_player_id)) {
        ballotsByPlayerId.set(vote.voter_player_id, {
          points: 0,
          completedAt: null,
        });
      }

      const ballot = ballotsByPlayerId.get(vote.voter_player_id);
      ballot.points += Math.max(0, Number(vote.points) || 0);
      const updatedAt = timestampValue(vote.updated_at || vote.created_at);
      if (updatedAt !== null) {
        ballot.completedAt = Math.max(ballot.completedAt ?? updatedAt, updatedAt);
      }
    }

    addPaceRanks(
      [...ballotsByPlayerId.entries()]
        .filter(([, ballot]) => ballot.points === fullBallotPoints)
        // The latest surviving vote write is when the final full ballot was saved.
        .map(([id, ballot]) => ({ id, timestamp: ballot.completedAt })),
      "voting",
      paceByPlayerId,
    );
  }

  return Object.values(paceByPlayerId)
    .filter((row) => row.submissionCount >= 2 && row.votingCount >= 2)
    .map((row) => ({
      id: row.id,
      pace:
        (row.submissionTotal / row.submissionCount +
          row.votingTotal / row.votingCount) /
        2,
    }));
}

function winningPlayerIdsForRound({
  roundId,
  songs = [],
  votes = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
}) {
  if (!roundId) return [];

  const roundSongs = songs.filter((song) => song.round_id === roundId);
  const roundVotes = votes.filter((vote) => vote.round_id === roundId);
  const roundDuplicateGroups = duplicateGroups.filter(
    (group) => group.round_id === roundId,
  );
  const duplicateGroupIds = new Set(
    roundDuplicateGroups.map((group) => group.id),
  );
  const roundGroupSongs = groupSongs.filter((row) =>
    duplicateGroupIds.has(row.group_id),
  );
  const sideByPlayerId = Object.fromEntries(
    roundGroups
      .filter(
        (row) =>
          row.round_id === roundId &&
          (Number(row.group_index) === 0 || Number(row.group_index) === 1),
      )
      .map((row) => [row.player_id, Number(row.group_index)]),
  );
  const isSplit = Object.keys(sideByPlayerId).length > 0;
  const entries = buildSongEntries({
    songs: roundSongs,
    votes: roundVotes,
    duplicateGroups: roundDuplicateGroups,
    groupSongs: roundGroupSongs,
    sideByPlayerId: isSplit ? sideByPlayerId : null,
  });
  const entriesByPool = new Map();

  for (const entry of entries) {
    const pool = entry.side === 0 || entry.side === 1 ? entry.side : "all";
    if (!entriesByPool.has(pool)) entriesByPool.set(pool, []);
    entriesByPool.get(pool).push(entry);
  }

  const winnerIds = new Set();
  for (const poolEntries of entriesByPool.values()) {
    const winningScore = Math.max(
      ...poolEntries.map((entry) => entry.totalPoints),
    );
    for (const entry of poolEntries) {
      if (Math.abs(entry.totalPoints - winningScore) > 1e-9) continue;
      for (const playerId of entry.submitterIds || []) winnerIds.add(playerId);
    }
  }

  return [...winnerIds];
}

export function buildPlayerAwards({
  players = [],
  rounds = [],
  songs = [],
  votes = [],
  comments = [],
  duplicateGroups = [],
  groupSongs = [],
  roundGroups = [],
  scoredRoundIds = new Set(),
  pointsPerPlayer = 10,
  leaderboard = [],
  fairScores = {},
  latestScoredRoundId = null,
}) {
  const awardsByPlayerId = Object.fromEntries(
    players.map((player) => [player.id, []]),
  );
  const scoredSongs = songs.filter((song) => scoredRoundIds.has(song.round_id));
  const descriptionStats = Object.fromEntries(
    players.map((player) => [
      player.id,
      {
        id: player.id,
        submissions: 0,
        words: 0,
      },
    ]),
  );

  const seasonOneWinnerIds = players
    .filter((player) => player.name?.trim().toLocaleLowerCase() === "luzak")
    .map((player) => player.id);
  addAward(awardsByPlayerId, seasonOneWinnerIds, AWARDS.seasonOneWinner);
  const incognitoIds = players
    .filter((player) => !String(player.avatar_url || "").trim())
    .map((player) => player.id);
  addAward(awardsByPlayerId, incognitoIds, AWARDS.incognito);
  const roundSubmitterIds = new Set(
    rounds.map((round) => round.submitted_by_player_id).filter(Boolean),
  );
  const ponderingIds = players
    .filter((player) => player.active && !roundSubmitterIds.has(player.id))
    .map((player) => player.id);
  addAward(awardsByPlayerId, ponderingIds, AWARDS.deepInThought);

  const scoredLeaders = leaderboard.filter((row) => Number(row.total) > 0);
  addAward(
    awardsByPlayerId,
    idsAtStandingExtreme(scoredLeaders, fairScores),
    AWARDS.currentLeader,
  );
  const scoredSubmitterIds = new Set(scoredSongs.map((song) => song.player_id));
  const undergroundCandidates = leaderboard.filter((row) =>
    scoredSubmitterIds.has(row.id),
  );
  if (undergroundCandidates.length > 1) {
    addAward(
      awardsByPlayerId,
      idsAtStandingExtreme(undergroundCandidates, fairScores, "min"),
      AWARDS.underground,
    );
  }
  addAward(
    awardsByPlayerId,
    winningPlayerIdsForRound({
      roundId: latestScoredRoundId,
      songs,
      votes,
      duplicateGroups,
      groupSongs,
      roundGroups,
    }),
    AWARDS.latestWinner,
  );
  const bestSongsByPlayerId = buildTopSongsByPlayer({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    scoredRoundIds,
  });
  const bestSongCandidates = Object.entries(bestSongsByPlayerId).map(
    ([id, song]) => ({ id, ...song }),
  );
  const bestSongScore = Math.max(
    0,
    ...bestSongCandidates.map((row) => Number(row.totalPoints) || 0),
  );
  if (bestSongScore > 0) {
    addAward(
      awardsByPlayerId,
      idsAtExtreme(bestSongCandidates, (row) => Number(row.totalPoints) || 0),
      AWARDS.bestSong,
    );
  }
  const submissionRanges = Object.entries(
    buildSubmissionRangesByPlayer({
      songs,
      votes,
      duplicateGroups,
      groupSongs,
      scoredRoundIds,
    }),
  ).map(([id, result]) => ({ id, ...result }));
  const widestRange = Math.max(0, ...submissionRanges.map((row) => row.range));
  if (widestRange > 0) {
    addAward(
      awardsByPlayerId,
      idsAtExtreme(submissionRanges, (row) => row.range),
      AWARDS.highsAndLows,
    );
  }
  addAward(
    awardsByPlayerId,
    idsAtExtreme(submissionRanges, (row) => row.range, "min"),
    AWARDS.consistencyQueen,
  );

  for (const song of scoredSongs) {
    if (!descriptionStats[song.player_id]) {
      descriptionStats[song.player_id] = {
        id: song.player_id,
        submissions: 0,
        words: 0,
      };
    }
    descriptionStats[song.player_id].submissions += 1;
    descriptionStats[song.player_id].words += countWords(song.submitter_note);
  }

  const writers = Object.values(descriptionStats).filter(
    (row) => row.words > 0,
  );
  addAward(
    awardsByPlayerId,
    idsAtExtreme(writers, (row) => row.words),
    AWARDS.novelist,
  );

  const commentCounts = {};
  for (const comment of comments) {
    if (!scoredRoundIds.has(comment.round_id) || !comment.player_id) continue;
    commentCounts[comment.player_id] =
      (commentCounts[comment.player_id] || 0) + 1;
  }
  const submitters = Object.values(descriptionStats).filter(
    (row) => row.submissions > 0,
  );
  const lurkers = submitters
    .filter((row) => !commentCounts[row.id])
    .map((row) => row.id);
  addAward(awardsByPlayerId, lurkers, AWARDS.lurker);
  const minimalists = submitters
    .filter((row) => row.words === 0)
    .map((row) => row.id);
  addAward(awardsByPlayerId, minimalists, AWARDS.minimalist);

  const commenters = Object.entries(commentCounts).map(([id, count]) => ({
    id,
    count,
  }));
  addAward(
    awardsByPlayerId,
    idsAtExtreme(commenters, (row) => row.count),
    AWARDS.communityPillar,
  );

  const commenterIdsBySubmitter = Object.fromEntries(
    players.map((player) => [player.id, new Set()]),
  );
  for (const roundId of scoredRoundIds) {
    const roundSongs = songs.filter((song) => song.round_id === roundId);
    const roundDuplicateGroups = duplicateGroups.filter(
      (group) => group.round_id === roundId,
    );
    const duplicateGroupIds = new Set(
      roundDuplicateGroups.map((group) => group.id),
    );
    const roundGroupSongs = groupSongs.filter((row) =>
      duplicateGroupIds.has(row.group_id),
    );
    const entries = buildSongEntries({
      songs: roundSongs,
      duplicateGroups: roundDuplicateGroups,
      groupSongs: roundGroupSongs,
    });
    const entryBySongId = new Map();
    for (const entry of entries) {
      for (const songId of entry.member_song_ids || [])
        entryBySongId.set(songId, entry);
    }

    for (const comment of comments) {
      if (
        comment.round_id !== roundId ||
        !comment.song_id ||
        !comment.player_id
      )
        continue;
      const entry = entryBySongId.get(comment.song_id);
      if (!entry) continue;
      for (const submitterId of entry.submitterIds || []) {
        if (submitterId === comment.player_id) continue;
        if (!commenterIdsBySubmitter[submitterId])
          commenterIdsBySubmitter[submitterId] = new Set();
        commenterIdsBySubmitter[submitterId].add(comment.player_id);
      }
    }
  }
  const provocativePlayers = Object.entries(commenterIdsBySubmitter)
    .map(([id, commenterIds]) => ({ id, commenterCount: commenterIds.size }))
    .filter((row) => row.commenterCount > 0);
  addAward(
    awardsByPlayerId,
    idsAtExtreme(provocativePlayers, (row) => row.commenterCount),
    AWARDS.provocative,
  );

  const audienceScores = buildAudienceScores({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    roundGroups,
    scoredRoundIds,
    pointsPerPlayer,
  });
  const audienceRows = Object.entries(audienceScores).map(([id, result]) => ({
    id,
    ...result,
  }));
  const cultFollowingRows = audienceRows.filter((row) =>
    Number.isFinite(row.cultFollowingScore),
  );
  addAward(
    awardsByPlayerId,
    idsAtExtreme(cultFollowingRows, (row) => row.cultFollowingScore),
    AWARDS.cultFollowing,
  );

  const maximumFanCount = Math.max(
    0,
    ...audienceRows.map((row) => row.fanCount),
  );
  const minimumCrowdSize = Math.min(3, maximumFanCount);
  const crowdSourcedRows = audienceRows.filter(
    (row) =>
      row.fanCount >= minimumCrowdSize &&
      row.fanCount > 1 &&
      Number.isFinite(row.crowdSourcedScore),
  );
  addAward(
    awardsByPlayerId,
    idsAtExtreme(crowdSourcedRows, (row) => row.crowdSourcedScore),
    AWARDS.crowdSourced,
  );

  const goldenEarScores = buildGoldenEarScores({
    songs,
    votes,
    duplicateGroups,
    groupSongs,
    roundGroups,
    scoredRoundIds,
    pointsPerPlayer,
  });
  const goldenEarRows = Object.entries(goldenEarScores).map(([id, result]) => ({
    id,
    ...result,
  }));
  const maximumBallotWeight = Math.max(
    0,
    ...goldenEarRows.map((row) => row.ballotWeight),
  );
  const minimumBallotWeight = Math.min(2, maximumBallotWeight);
  const experiencedListeners = goldenEarRows.filter(
    (row) => row.ballotWeight + 1e-9 >= minimumBallotWeight,
  );
  const goldenEarScoreRange =
    experiencedListeners.length > 1
      ? Math.max(...experiencedListeners.map((row) => row.score)) -
        Math.min(...experiencedListeners.map((row) => row.score))
      : 0;

  if (goldenEarScoreRange > 1e-9) {
    addAward(
      awardsByPlayerId,
      idsAtExtreme(experiencedListeners, (row) => row.score),
      AWARDS.goldenEar,
    );
    addAward(
      awardsByPlayerId,
      idsAtExtreme(experiencedListeners, (row) => row.uniquenessScore),
      AWARDS.deepCut,
    );
  }

  const paceRows = buildPaceRows({
    players,
    songs,
    votes,
    scoredRoundIds,
    pointsPerPlayer,
  });
  const paceRange =
    paceRows.length > 1
      ? Math.max(...paceRows.map((row) => row.pace)) -
        Math.min(...paceRows.map((row) => row.pace))
      : 0;
  if (paceRange > 1e-9) {
    addAward(
      awardsByPlayerId,
      idsAtExtreme(paceRows, (row) => row.pace, "min"),
      AWARDS.fastest,
    );
    addAward(
      awardsByPlayerId,
      idsAtExtreme(paceRows, (row) => row.pace),
      AWARDS.slowest,
    );
  }

  for (const awards of Object.values(awardsByPlayerId)) {
    awards.sort(
      (a, b) =>
        (AWARD_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (AWARD_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return awardsByPlayerId;
}
