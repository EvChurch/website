'use client'

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'a',
]

const ROCK_TEXT_SPACING_CLASS =
  '[&_h1]:my-6 [&_h2]:my-5 [&_h3]:my-5 [&_h4]:my-4 [&_h5]:my-4 [&_h6]:my-4 [&_p]:my-4'

export function classifyRockHref(
  rawHref: string,
  origin: string,
): { href: string; external: boolean } | null {
  const href = rawHref.trim()
  if (!href || href.startsWith('//') || /[\u0000-\u001f\u007f]/.test(href)) return null
  try {
    const resolved = new URL(href, origin)
    if (
      resolved.protocol !== 'https:' ||
      resolved.username ||
      resolved.password
    ) return null
    return { href, external: resolved.origin !== origin }
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function sanitizeRockHtml(value: string): string {
  if (typeof DOMPurify.sanitize !== 'function' || typeof DOMParser === 'undefined') {
    return escapeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
  }
  const clean = DOMPurify.sanitize(`<div>${value}</div>`, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'data-launcher-cta'],
    FORBID_TAGS: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: false,
  })
  const document = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html')
  const root = document.body.firstElementChild
  if (!root) return ''

  for (const link of root.querySelectorAll('a')) {
    const href = link.getAttribute('href')?.trim() || ''
    const classification = classifyRockHref(href, window.location.origin)
    if (!classification) {
      link.removeAttribute('href')
      continue
    }
    if (classification.external) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (link.getAttribute('data-launcher-cta') !== 'true') {
      link.removeAttribute('data-launcher-cta')
    }
  }
  return root.innerHTML
}

export function SafeRockHtml({ value }: { value?: string | null }) {
  if (!value) return null
  return (
    <div
      className={ROCK_TEXT_SPACING_CLASS}
      dangerouslySetInnerHTML={{ __html: sanitizeRockHtml(value) }}
    />
  )
}
