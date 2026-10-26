import { findSongArtwork } from '../src/lib/songArtwork.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST to find song artwork.' })
  }
  const { artist, title, album } = req.body || {}
  const artworkUrl = await findSongArtwork({ artist, title, album })
  return res.status(200).json({ artwork_url: artworkUrl })
}
