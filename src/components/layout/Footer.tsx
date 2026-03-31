import Link from 'next/link'
import { SiFacebook, SiInstagram, SiYoutube, SiSpotify, SiApplepodcasts } from 'react-icons/si'

type FooterColumn = {
  title: string
  links: { label: string; href: string; meta?: string }[]
}

const columns: FooterColumn[] = [
  {
    title: 'About',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'What We Believe', href: '/what-we-believe' },
      { label: 'The Good News', href: '/good-news' },
      { label: 'Our Vision', href: '/vision' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Health & Safety', href: '/hs' },
    ],
  },
  {
    title: 'Next Steps',
    links: [
      { label: 'Explaining Christianity', href: '/explaining-christianity' },
      { label: 'Newish Connect', href: '/newish' },
      { label: 'Connect Groups', href: '/connect-groups' },
      { label: 'Kids', href: '/kids' },
      { label: 'Youth', href: '/youth' },
    ],
  },
  {
    title: 'Sections',
    links: [
      { label: 'Church Online', href: 'https://live.ev.church' },
      { label: 'Resources', href: 'https://resources.aucklandev.co.nz' },
      { label: 'Contact', href: '/contact' },
      { label: 'Give', href: 'https://give.ev.church' },
    ],
  },
  {
    title: 'Campuses',
    links: [
      { label: 'North', href: '/campus/north', meta: 'Sun 10:15 am' },
      { label: 'Central', href: '/campus/central', meta: 'Sun 10:15 am' },
      { label: 'Unichurch', href: '/campus/unichurch', meta: 'Sun 5:15 pm' },
    ],
  },
]

const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/ev.church', icon: <SiFacebook className="h-[18px] w-[18px]" aria-hidden="true" /> },
  { label: 'Instagram', href: 'https://www.instagram.com/ev.church', icon: <SiInstagram className="h-[18px] w-[18px]" aria-hidden="true" /> },
  { label: 'YouTube', href: 'https://www.youtube.com/@ev.church', icon: <SiYoutube className="h-[18px] w-[18px]" aria-hidden="true" /> },
  { label: 'Spotify', href: 'https://open.spotify.com/show/ev-church', icon: <SiSpotify className="h-[18px] w-[18px]" aria-hidden="true" /> },
  { label: 'Apple Podcasts', href: 'https://podcasts.apple.com/podcast/ev-church', icon: <SiApplepodcasts className="h-[18px] w-[18px]" aria-hidden="true" /> },
]

function FooterLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const isExternal = href.startsWith('http')
  const classes =
    'text-[0.8125rem] text-mid-grey transition-colors duration-150 hover:text-rich-red'
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-warm-grey/50 bg-warm-white">
      <div className="mx-auto max-w-[80rem] px-5 pt-16 pb-10 lg:px-8">
        {/* Top: Logo + tagline */}
        <div className="mb-12 lg:mb-16">
          <span className="text-lg font-black tracking-tight text-brand-black">
            ev.church
          </span>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-mid-grey">
            A community of Christ-followers across Auckland, New Zealand.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-12">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-brand-black">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>
                      {link.label}
                    </FooterLink>
                    {link.meta && (
                      <span className="ml-1.5 text-xs text-warm-grey">
                        {link.meta}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider + bottom row */}
        <div className="mt-14 flex flex-col items-start gap-6 border-t border-warm-grey/50 pt-8 sm:flex-row sm:items-center sm:justify-between">
          {/* Social */}
          <div className="flex items-center gap-5">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mid-grey/70 transition-colors duration-150 hover:text-rich-red"
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>

          {/* Legal */}
          <div className="flex items-center gap-4 text-xs text-mid-grey/70">
            <Link href="/privacy" className="transition-colors hover:text-rich-red">
              Privacy Policy
            </Link>
            <span aria-hidden="true">&middot;</span>
            <span>&copy; {new Date().getFullYear()} Ev Church</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
