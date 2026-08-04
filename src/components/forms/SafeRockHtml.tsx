'use client'

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a']

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
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
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
  }
  return root.innerHTML
}

export function SafeRockHtml({ value }: { value?: string | null }) {
  if (!value) return null
  return <div dangerouslySetInnerHTML={{ __html: sanitizeRockHtml(value) }} />
}
