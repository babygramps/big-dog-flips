const ADJECTIVES = [
  'Suspicious',
  'Unlicensed',
  'Budget',
  'Expired',
  'Overcaffeinated',
  'Questionable',
  'Improvised',
  'Dramatic',
  'Sideways',
  'Discount',
  'Forgotten',
  'Legal',
  'Casual',
  'Basement',
  'Midnight',
  'Unhinged',
  'Portable',
  'Awkward',
  'Emergency',
  'Decaf',
  'Unauthorized',
  'Room-Temperature',
  'Reheated',
  'Unsupervised',
]

const NOUNS = [
  'Kazoo',
  'Keytar',
  'Mixtape',
  'Aux Cord',
  'Tambourine',
  'Sax Solo',
  'Karaoke',
  'Synth Patch',
  'Reverb',
  'Demo Tape',
  'Drum Fill',
  'Bridge',
  'Chorus',
  'B-Side',
  'Liner Note',
  'Feedback',
  'Metronome',
  'Soundcheck',
  'Encore',
  'Playlist',
  'Bass Drop',
  'Cassette',
  'Voice Memo',
  'Gig Poster',
]

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function anonymousNameFor(roundId, playerId) {
  const hash = hashString(`muzak-anon-v1:${roundId || 'round'}:${playerId || 'player'}`)
  const adjective = ADJECTIVES[hash % ADJECTIVES.length]
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length]
  return `${adjective} ${noun}`
}

// Explicit photo cycles are scoped to a round and player, leaving future rounds unchanged.
const AVATAR_CYCLES = {
  '9b1aeda2-f170-47e0-a4fe-cc016e08eb58:f88c4fa7-a2e9-48f0-93fd-93d495fee7b8': 1,
}

export function anonymousAvatarFor(roundId, playerId) {
  // Fixed, locally bundled photographs; provenance is in public/anonymous-dogs/SOURCES.md.
  // Hash independently of the alias so a photo doesn't give away either part of the name.
  const hash = hashString(`big-dog-anon-photo-v1:${roundId || 'round'}:${playerId || 'player'}`)
  const cycle = AVATAR_CYCLES[`${roundId}:${playerId}`] || 0
  const photoNumber = String(((hash + cycle) % 48) + 1).padStart(2, '0')
  return `/anonymous-dogs/dog-${photoNumber}.jpg`
}
