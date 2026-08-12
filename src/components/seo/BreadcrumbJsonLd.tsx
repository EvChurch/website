const SITE_URL = 'https://www.ev.church'

interface BreadcrumbItem {
  name: string
  url: string
}

/** Static breadcrumb map for pages with nav hierarchy deeper than their URL. */
const navHierarchy: Record<string, BreadcrumbItem[]> = {
  '/what-we-believe': [
    { name: 'Home', url: SITE_URL },
    { name: 'About', url: `${SITE_URL}/about` },
    { name: 'What We Believe', url: `${SITE_URL}/what-we-believe` },
  ],
  '/good-news': [
    { name: 'Home', url: SITE_URL },
    { name: 'About', url: `${SITE_URL}/about` },
    { name: 'The Good News', url: `${SITE_URL}/good-news` },
  ],
  '/vision': [
    { name: 'Home', url: SITE_URL },
    { name: 'About', url: `${SITE_URL}/about` },
    { name: 'Our Vision', url: `${SITE_URL}/vision` },
  ],
  '/explaining-christianity': [
    { name: 'Home', url: SITE_URL },
    { name: 'Explaining Christianity', url: `${SITE_URL}/explaining-christianity` },
  ],
  '/newish': [
    { name: 'Home', url: SITE_URL },
    { name: 'Newish Connect', url: `${SITE_URL}/newish` },
  ],
  '/connect-groups': [
    { name: 'Home', url: SITE_URL },
    { name: 'Connect Groups', url: `${SITE_URL}/connect-groups` },
  ],
  '/kids': [
    { name: 'Home', url: SITE_URL },
    { name: 'Ev Kids', url: `${SITE_URL}/kids` },
  ],
  '/youth': [
    { name: 'Home', url: SITE_URL },
    { name: 'Ev Youth', url: `${SITE_URL}/youth` },
  ],
}

/**
 * Build breadcrumb items from a pathname and optional page title.
 * Uses nav hierarchy when available, otherwise generates from URL path.
 */
export function buildBreadcrumbs(pathname: string, pageTitle?: string): BreadcrumbItem[] {
  // Check nav hierarchy first
  if (navHierarchy[pathname]) {
    return navHierarchy[pathname]
  }

  // Homepage has no breadcrumbs
  if (pathname === '/') return []

  // Campus pages: Home > Visit > Campus Name
  const campusMatch = pathname.match(/^\/campus\/(.+)$/)
  if (campusMatch) {
    const campusName = campusMatch[1].charAt(0).toUpperCase() + campusMatch[1].slice(1)
    return [
      { name: 'Home', url: SITE_URL },
      { name: 'Visit', url: `${SITE_URL}/visit` },
      { name: campusName, url: `${SITE_URL}${pathname}` },
    ]
  }

  // Blog posts: Home > Blog > Post Title
  const blogMatch = pathname.match(/^\/blog\/(.+)$/)
  if (blogMatch) {
    return [
      { name: 'Home', url: SITE_URL },
      { name: 'Blog', url: `${SITE_URL}/blog` },
      ...(pageTitle ? [{ name: pageTitle, url: `${SITE_URL}${pathname}` }] : []),
    ]
  }

  // Default flat pages: Home > Page Title
  if (pageTitle) {
    return [
      { name: 'Home', url: SITE_URL },
      { name: pageTitle, url: `${SITE_URL}${pathname}` },
    ]
  }

  return []
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  if (items.length === 0) return null

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
