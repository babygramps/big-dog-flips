// Each factory returns fresh data. Tests explicitly override the fields that
// matter to the scenario; IDs and dates never depend on randomness or the clock.
export function makePlayer(overrides = {}) {
  return { id: 'player-a', name: 'Ada', active: true, ...overrides }
}

export function makeSong(overrides = {}) {
  return {
    id: 'song-a',
    round_id: 'round-a',
    player_id: 'player-a',
    artist: 'Test Artist',
    title: 'Test Song',
    album: null,
    link: null,
    spotify_url: null,
    tidal_url: null,
    apple_music_url: null,
    youtube_music_url: null,
    ...overrides,
  }
}

export function makeVote(overrides = {}) {
  return {
    id: 'vote-a', round_id: 'round-a', song_id: 'song-a',
    voter_player_id: 'player-b', points: 4, ...overrides,
  }
}

export function makeRound(overrides = {}) {
  return { id: 'round-a', theme_name: 'A good song', queue_position: 0, is_archived: false, ...overrides }
}

export function makeSettings(overrides = {}) {
  return { schedule_start_date: '2026-09-14', points_per_player: 3, ...overrides }
}

export function makeDuplicateRound() {
  const players = [makePlayer(), makePlayer({ id: 'player-b', name: 'Ben' })]
  return {
    players,
    rounds: [makeRound()],
    songs: [
      makeSong({ players: players[0], spotify_url: 'https://open.spotify.com/track/canonical' }),
      makeSong({
        id: 'song-b', player_id: 'player-b', players: players[1],
        spotify_url: 'https://open.spotify.com/track/alternate',
        tidal_url: 'https://tidal.com/track/123',
      }),
    ],
    votes: [
      makeVote({ voter_player_id: 'player-c', points: 4 }),
      makeVote({ id: 'vote-b', song_id: 'song-b', voter_player_id: 'player-d', points: 6 }),
      // Votes by either duplicate submitter must not count toward the merge.
      makeVote({ id: 'vote-c', voter_player_id: 'player-b', points: 3 }),
      makeVote({ id: 'vote-d', song_id: 'song-b', voter_player_id: 'player-a', points: 2 }),
    ],
    duplicateGroups: [{ id: 'merge-a', round_id: 'round-a', canonical_song_id: 'song-a' }],
    // Deliberately put the canonical song last to catch order-dependent results.
    groupSongs: [
      { group_id: 'merge-a', song_id: 'song-b' },
      { group_id: 'merge-a', song_id: 'song-a' },
    ],
  }
}
