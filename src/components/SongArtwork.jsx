import { useState } from 'react'

export default function SongArtwork({ song, className = '', fallback = null }) {
  const [failedUrl, setFailedUrl] = useState('')
  const url = song?.artwork_url
  if (!url || url === failedUrl) return fallback
  return (
    <img
      className={`song-artwork ${className}`.trim()}
      src={url}
      alt={`Cover art for ${song.title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  )
}
