import Link from 'next/link'

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
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/ev.church',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ev.church',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@ev.church',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/ev-church',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
  {
    label: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/podcast/ev-church',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c4.988 0 7.455 3.582 7.455 6.774 0 1.86-.945 4.17-1.665 5.186-.72 1.014-2.199 1.92-3.42 1.92-.63 0-1.17-.27-1.53-.63.18-.96.27-1.95.27-2.97 0-.18 0-.36-.015-.54.69-.135 1.215-.765 1.215-1.515 0-.855-.69-1.545-1.545-1.545a1.545 1.545 0 00-1.545 1.545c0 .75.525 1.38 1.215 1.515-.015.18-.015.36-.015.54 0 1.02.09 2.01.27 2.97-.36.36-.9.63-1.53.63-1.221 0-2.7-.906-3.42-1.92-.72-1.016-1.665-3.326-1.665-5.186 0-3.192 2.467-6.774 7.455-6.774zm-.135 3.39c-1.17 0-2.115.945-2.115 2.115 0 1.17.945 2.115 2.115 2.115 1.17 0 2.115-.945 2.115-2.115 0-1.17-.945-2.115-2.115-2.115zm0 7.02c-.63 0-1.14.51-1.14 1.14v3.39c0 1.37.51 2.49 1.14 2.49.63 0 1.14-1.12 1.14-2.49v-3.39c0-.63-.51-1.14-1.14-1.14z" />
      </svg>
    ),
  },
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
