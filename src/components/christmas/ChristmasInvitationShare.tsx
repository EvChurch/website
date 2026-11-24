'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChristmasShare } from './ChristmasShare'

const invitations = [
  { id: 'central', label: 'Central', alt: 'Christmas services at Ev Central, 80 Olsen Ave, Hillsborough: 13, 20, 25 and 27 December at 10:15am.' },
  { id: 'north', label: 'North', alt: 'Christmas services at Ev North, 9–11 Rothwell Ave, Rosedale: 13, 20, 25 and 27 December at 10:15am.' },
  { id: 'unichurch', label: 'Unichurch', alt: 'Unichurch Christmas services: 13, 20 and 27 December at 5:15pm at Maclaurin Chapel, and Christmas Day at 10:15am at Ev Central.' },
]

export function ChristmasInvitationShare() {
  const [selectedId, setSelectedId] = useState('central')
  const invitation = invitations.find((item) => item.id === selectedId)!
  const src = `/christmas/share/ev-christmas-2026-${invitation.id}.jpg`

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <div role="group" aria-label="Choose a campus invitation" className="mx-auto flex w-fit max-w-full divide-x divide-[#d9b879] overflow-hidden rounded-full border border-[#d9b879]">
        {invitations.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedId === item.id}
            onClick={() => setSelectedId(item.id)}
            className="inline-flex min-h-12 items-center justify-center px-4 py-3 text-base font-semibold text-[#f3d49b] transition-colors hover:bg-[#d9b879]/20 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#f3d49b] sm:px-6 aria-pressed:bg-[#d9b879] aria-pressed:text-[#0b203b]"
          >
            {item.label}
          </button>
        ))}
      </div>
      <figure className="mt-6">
        <div className="overflow-hidden rounded-xl border border-[#d9b879]/40">
          <Image src={src} alt={invitation.alt} width={2324} height={1682} sizes="(max-width: 768px) 100vw, 768px" className="h-auto w-full" />
        </div>
        <figcaption className="mt-6 text-center">
          <ChristmasShare key={invitation.id} image={src} label={`Share ${invitation.label} invitation`} />
        </figcaption>
      </figure>
    </div>
  )
}
