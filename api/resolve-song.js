import { resolveSong } from '../src/lib/resolveSong.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST to look up a song.' })
  }
  try {
    const url = req.body?.url
    const result = await resolveSong(url)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message || 'Could not look up that song.' })
  }
}
