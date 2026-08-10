import Link from 'next/link'
import type { ReactNode } from 'react'

import { MemberAvatar } from './MemberAvatar'

export type MemberSection = 'groups' | 'resources'

export function MemberPortalChrome({
  active,
  member,
  canAccessLeaderResources,
  children,
}: {
  active?: MemberSection
  member: { name: string; email: string; avatarUrl: string | null }
  canAccessLeaderResources: boolean
  children: ReactNode
}) {
  const links = [
    { key: 'groups' as const, label: 'Connect Groups', href: '/members/connect-groups' },
    ...(canAccessLeaderResources
      ? [{
          key: 'resources' as const,
          label: 'Leader Resources',
          href: '/members/connect-group-leader-resources',
        }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-warm-white pb-20">
      <section className="bg-[radial-gradient(circle_at_85%_10%,rgba(226,42,48,0.22),transparent_34%),linear-gradient(135deg,#0f0004,#23080e)] pb-12 pt-32 text-white sm:pt-36">
        <div className="mx-auto flex max-w-[80rem] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[clamp(3rem,10vw,5.5rem)] leading-[0.9] tracking-[-0.055em] text-white">
              Kia ora, {member.name.split(/\s+/u)[0]}
            </h1>
          </div>
          <div className="flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
            <MemberAvatar name={member.name} src={member.avatarUrl} size="medium" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{member.name}</p>
              <p className="truncate text-sm text-white/60">{member.email}</p>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Members" className="border-b border-warm-grey bg-white">
        <div className="mx-auto flex max-w-[80rem] gap-7 overflow-x-auto px-5 sm:px-8">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={active === link.key ? 'page' : undefined}
              className={`relative shrink-0 py-5 text-sm font-bold transition-colors ${
                active === link.key
                  ? 'text-rich-red'
                  : 'text-dark-grey hover:text-rich-red'
              }`}
            >
              {link.label}
              {active === link.key && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-rich-red" />
              )}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-[80rem] px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </div>
    </div>
  )
}
