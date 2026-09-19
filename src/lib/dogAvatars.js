// Real photographs bundled with the app; credits are in public/anonymous-dogs/SOURCES.md.
const DOG_AVATAR_COUNT = 48

export function randomDogAvatarUrl() {
  const photoNumber = String(Math.floor(Math.random() * DOG_AVATAR_COUNT) + 1).padStart(2, '0')
  return `/anonymous-dogs/dog-${photoNumber}.jpg`
}
