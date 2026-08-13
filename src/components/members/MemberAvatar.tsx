'use client'

import { useEffect, useState } from 'react'

const colours = [
  'bg-deep-red',
  'bg-ev-blue',
  'bg-ev-purple',
  'bg-newish-green',
  'bg-connect-brown',
  'bg-dark-brown',
] as const

function initials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('') || '?'
}

function colour(name: string) {
  let hash = 0
  for (const character of name.toLocaleLowerCase()) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }
  return colours[hash % colours.length] ?? 'bg-deep-red'
}

export function MemberAvatar({
  name,
  src,
  size = 'medium',
}: {
  name: string
  src: string | null
  size?: 'xsmall' | 'small' | 'medium' | 'large'
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  const sizes = {
    xsmall: 'h-7 w-7 text-[0.625rem]',
    small: 'h-10 w-10 text-xs',
    medium: 'h-14 w-14 text-sm',
    large: 'h-20 w-20 text-lg',
  }

  if (src && !failed) {
    return (
      // Sources are authenticated same-origin member media routes.
      
      <img
        src={src}
        alt={`${name}'s profile`}
        className={`${sizes[size]} shrink-0 rounded-full bg-warm-grey object-cover`}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      aria-label={`${name}'s profile`}
      role="img"
      className={`${sizes[size]} ${colour(name)} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
    >
      {initials(name)}
    </span>
  )
}
