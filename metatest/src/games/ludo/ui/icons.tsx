import type { CSSProperties } from 'react'
import type { ItemType } from '../engine'

const stroke = 'currentColor'

export function ItemGlyph({ type, className }: { type: ItemType; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'COIN':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8.5v7M10 10.2c.6-.6 3.4-.6 4 1.2s-1.2 2.4-2 2.4" />
        </svg>
      )
    case 'XP':
      return (
        <svg {...common}>
          <path d="M12 3.5 13.8 9h5.7l-4.6 3.4 1.8 5.6L12 14.8 7.3 18l1.8-5.6L4.5 9h5.7z" />
        </svg>
      )
    case 'POINT':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20" />
        </svg>
      )
    case 'MOVE_PLUS_2':
      return (
        <svg {...common}>
          <path d="M12 7v10M7 12h10" />
          <text x="16.5" y="18" fontSize="7" fill="currentColor" stroke="none">
            2
          </text>
        </svg>
      )
    case 'MOVE_PLUS_4':
      return (
        <svg {...common}>
          <path d="M12 7v10M7 12h10" />
          <text x="16.5" y="18" fontSize="7" fill="currentColor" stroke="none">
            4
          </text>
        </svg>
      )
    case 'MUSIC':
      return (
        <svg {...common}>
          <path d="M9 17.5a2.5 2.5 0 1 1-1-2V7.5l9-1.8V15" />
          <circle cx="16" cy="15.5" r="2.5" />
        </svg>
      )
    case 'MYSTERY':
      return (
        <svg {...common}>
          <rect x="5" y="8" width="14" height="11" rx="2" />
          <path d="M5 11h14M12 8v11M9.5 8c0-2 5-2 5 0" />
        </svg>
      )
    case 'SCIENCE_FACT':
      return (
        <svg {...common}>
          <path d="M9 4h6M10 4v5.5L6.5 16.5A3.2 3.2 0 0 0 9.3 21h5.4a3.2 3.2 0 0 0 2.8-4.5L14 9.5V4" />
        </svg>
      )
    case 'QUESTION':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.8-1.2 1.8" />
          <circle cx="12" cy="16.6" r="0.7" fill="currentColor" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
  }
}

export function StarGlyph({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path
        d="M12 3.6 14.1 9l5.9.5-4.5 3.8 1.4 5.7L12 16.4 7.1 19l1.4-5.7L4 9.5 9.9 9z"
        fill="currentColor"
      />
    </svg>
  )
}
