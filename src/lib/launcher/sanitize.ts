import { JSDOM } from 'jsdom'

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li'])
const DANGEROUS_TAGS = 'script, style, svg, math, iframe, object, embed, form'
const SITE_ORIGIN = 'https://www.ev.church'

export function classifyLauncherHref(rawHref: string): string | null {
  const href = rawHref.trim()
  if (!href || href.startsWith('//') || /[\u0000-\u001f\u007f]/.test(href)) {
    return null
  }

  try {
    const resolved = new URL(href, SITE_ORIGIN)
    if (
      resolved.protocol !== 'https:' ||
      resolved.username ||
      resolved.password
    ) {
      return null
    }
    if (resolved.hostname === 'resources.ev.church') return '/sermons'
    if (resolved.hostname === 'www.ev.church' || resolved.hostname === 'ev.church') {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`
    }
    return href
  } catch {
    return null
  }
}

function isStandaloneParagraphLink(anchor: HTMLAnchorElement): boolean {
  const paragraph = anchor.parentElement
  if (paragraph?.tagName.toLowerCase() !== 'p') return false

  return [...paragraph.childNodes].every(
    (node) => node === anchor || (node.nodeType === 3 && !node.textContent?.trim()),
  )
}

export function sanitizeLauncherHtml(value: string): string {
  const document = new JSDOM(`<body>${value}</body>`).window.document

  document.body.querySelectorAll(DANGEROUS_TAGS).forEach((element) => element.remove())

  for (const element of [...document.body.querySelectorAll('*')]) {
    const name = element.tagName.toLowerCase()

    if (name === 'a') {
      const anchor = element as HTMLAnchorElement
      const href = classifyLauncherHref(anchor.getAttribute('href') ?? '')
      const isCta =
        anchor.classList.contains('link-button') ||
        anchor.getAttribute('data-launcher-cta') === 'true' ||
        isStandaloneParagraphLink(anchor)

      for (const attribute of [...anchor.attributes]) {
        anchor.removeAttribute(attribute.name)
      }
      if (href) {
        anchor.setAttribute('href', href)
        if (isCta) anchor.setAttribute('data-launcher-cta', 'true')
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer nofollow')
      }
      continue
    }

    if (ALLOWED_TAGS.has(name)) {
      for (const attribute of [...element.attributes]) {
        element.removeAttribute(attribute.name)
      }
      continue
    }

    element.replaceWith(...element.childNodes)
  }

  return document.body.innerHTML.trim()
}

export function launcherPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
