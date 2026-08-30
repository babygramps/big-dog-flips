function IconPaths({ name }) {
  switch (name) {
    case 'crown':
      return (
        <>
          <path d="M5.5 11 10.5 15.5 16 7l5.5 8.5 5-4.5-2 12H7.5Z" />
          <path d="M8 26h16" />
          <circle cx="5.5" cy="10" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="16" cy="6" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="26.5" cy="10" r="1.35" fill="currentColor" stroke="none" />
        </>
      )
    case 'trophy':
      return (
        <>
          <path d="M10 6.5h12v5.2c0 5.3-2.2 8.3-6 8.3s-6-3-6-8.3Z" />
          <path d="M10 9H6v2.5c0 2.8 1.8 4.5 4.8 4.5M22 9h4v2.5c0 2.8-1.8 4.5-4.8 4.5" />
          <path d="M16 20v5M11 26h10" />
          <path d="m16 9.2.9 1.8 2 .3-1.5 1.4.4 2-1.8-.9-1.8.9.4-2-1.5-1.4 2-.3Z" fill="currentColor" stroke="none" />
        </>
      )
    case 'quill':
      return (
        <>
          <path d="M6 26C11 17 16 11 26 4" />
          <path d="M8.5 22.5C6.7 15.4 9.9 8.8 16 5.5 19.6 3.6 23.3 4 26 4c-.5 4.8-1.5 10.1-5.6 14-3.3 3.2-7.7 4.2-11.9 4.5Z" />
          <path d="m12 17 7-1M15 12.5l6-1" />
        </>
      )
    case 'no-quill':
      return (
        <>
          <path d="M6 26C11 17 16 11 26 4" />
          <path d="M8.5 22.5C6.7 15.4 9.9 8.8 16 5.5 19.6 3.6 23.3 4 26 4c-.5 4.8-1.5 10.1-5.6 14-3.3 3.2-7.7 4.2-11.9 4.5Z" />
          <path d="M5 5l22 22" />
        </>
      )
    case 'eye':
      return (
        <>
          <path d="M4.5 16s4.2-6 11.5-6 11.5 6 11.5 6-4.2 6-11.5 6S4.5 16 4.5 16Z" />
          <circle cx="16" cy="16" r="3.25" />
          <path d="M7 24.5h18" />
        </>
      )
    case 'pillar':
      return (
        <>
          <path d="M7 6.5h18l-2 4H9ZM9 22h14l2 4H7Z" />
          <path d="M11 10.5V22M16 10.5V22M21 10.5V22" />
        </>
      )
    case 'chat':
      return (
        <>
          <path d="M6 7h14a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-7l-6 4v-5.1A5 5 0 0 1 3 13v-1a5 5 0 0 1 3-5Z" />
          <circle cx="10" cy="13" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="16" cy="13" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="22" cy="13" r="1.25" fill="currentColor" stroke="none" />
        </>
      )
    case 'orbit':
      return (
        <>
          <ellipse cx="16" cy="16" rx="11" ry="5.5" transform="rotate(28 16 16)" />
          <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
          <circle cx="24.5" cy="14" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="7.8" cy="18.4" r="1.6" fill="currentColor" stroke="none" />
        </>
      )
    case 'crowd':
      return (
        <>
          <path d="M16 7v6M23.8 11.2l-5.2 3M23.8 20.8l-5.2-3M16 25v-6M8.2 20.8l5.2-3M8.2 11.2l5.2 3" />
          <circle cx="16" cy="16" r="3" />
          <circle cx="16" cy="5.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="25.1" cy="10.8" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="25.1" cy="21.2" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="16" cy="26.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="6.9" cy="21.2" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="6.9" cy="10.8" r="1.7" fill="currentColor" stroke="none" />
        </>
      )
    case 'ear':
      return (
        <>
          <path d="M9 15.5C9 9.2 12.2 5 17.2 5c4.8 0 7.8 3.2 7.8 7.5 0 3.4-1.7 5.2-4 7.3-1.6 1.5-2.2 2.4-2.2 3.8 0 2-1.3 3.4-3.3 3.4-2.4 0-4-1.7-4-4 0-2.1 1.2-3.4 3.1-5 1.8-1.5 3.1-2.7 3.1-4.8 0-1.8-1.1-3-2.8-3-2.2 0-3.5 1.8-3.5 4.3" />
          <path d="m26 5 .8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" fill="currentColor" stroke="none" />
        </>
      )
    case 'gem':
      return (
        <>
          <path d="m7 11 4-5h10l4 5-9 15Z" />
          <path d="M7 11h18M11 6l5 5 5-5M12 11l4 15 4-15" />
        </>
      )
    default:
      return <path d="m16 5 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L9.8 24l1.2-6.8-5-4.9 6.9-1Z" />
  }
}

export default function MedalIcon({ name, className = '' }) {
  return (
    <svg
      className={`medal-icon ${className}`.trim()}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconPaths name={name} />
    </svg>
  )
}
