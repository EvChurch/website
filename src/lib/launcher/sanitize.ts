const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li'])
const SITE_ORIGIN = 'https://ev.church'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

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
    if (resolved.hostname === 'www.ev.church') {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`
    }
    return href
  } catch {
    return null
  }
}

function safeTag(token: string): string {
  const closingTag = token.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i)
  if (closingTag) {
    const name = closingTag[1].toLowerCase()
    return name === 'a' || ALLOWED_TAGS.has(name) ? `</${name}>` : ''
  }

  const openingTag = token.match(/^<\s*([a-z0-9]+)(?:\s+[^>]*)?\s*\/?>$/i)
  if (openingTag) {
    const rawName = openingTag[1]
    const name = rawName.toLowerCase()
    if (ALLOWED_TAGS.has(name)) return name === 'br' ? '<br>' : `<${name}>`
  }

  const anchorOpen = token.match(/^<\s*a\s+([^>]*)>$/i)
  if (!anchorOpen) return ''
  const hrefMatch = anchorOpen[1].match(
    /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  )
  const href = hrefMatch ? classifyLauncherHref(hrefMatch[1] ?? hrefMatch[2] ?? '') : null
  if (!href) return '<a>'
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">`
}

export function sanitizeLauncherHtml(value: string): string {
  // Drop dangerous containers with their content before reconstructing only the
  // small tag allowlist. Everything outside an allowed tag is emitted as text.
  const withoutDangerousContent = value.replace(
    /<(script|style|svg|math|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  )
  return (withoutDangerousContent.match(/<[^>]*>|[^<]+|</g) ?? [])
    .map((token) => (token.startsWith('<') ? safeTag(token) : escapeHtml(token)))
    .join('')
    .trim()
}

export function launcherPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
