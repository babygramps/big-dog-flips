import { songLinksFor } from '../lib/songLinks.js'

export default function SongLinks({ song, className = '' }) {
  const links = songLinksFor(song, { includeSearchFallbacks: true })
  return (
    <div className={`song-actions song-service-actions ${className}`.trim()}>
      {links.map(({ label, url, isSearch }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noreferrer"
          title={isSearch ? `Search ${label} for ${song.artist} — ${song.title}` : `Open in ${label}`}
        >{label}</a>
      ))}
    </div>
  )
}
