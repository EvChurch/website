export interface CommentRichTextRun {
  text: string
  bold?: true
  italic?: true
  href?: string
}

export interface CommentRichTextBlock {
  type: 'paragraph' | 'bullet'
  children: CommentRichTextRun[]
}

export interface CommentRichTextDocument {
  version: 1
  blocks: CommentRichTextBlock[]
}

function safeLink(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function parseCommentRichText(value: string): CommentRichTextDocument | null {
  if (!value.startsWith('{')) return null
  try {
    const candidate = JSON.parse(value) as { version?: unknown; blocks?: unknown }
    if (candidate.version !== 1 || !Array.isArray(candidate.blocks)) return null
    const blocks = candidate.blocks.flatMap((block): CommentRichTextBlock[] => {
      if (!block || typeof block !== 'object') return []
      const value = block as { type?: unknown; children?: unknown }
      if ((value.type !== 'paragraph' && value.type !== 'bullet') || !Array.isArray(value.children)) return []
      const children = value.children.flatMap((run): CommentRichTextRun[] => {
        if (!run || typeof run !== 'object') return []
        const item = run as { text?: unknown; bold?: unknown; italic?: unknown; href?: unknown }
        if (typeof item.text !== 'string' || !item.text) return []
        const href = safeLink(item.href)
        return [{
          text: item.text,
          ...(item.bold === true ? { bold: true as const } : {}),
          ...(item.italic === true ? { italic: true as const } : {}),
          ...(href ? { href } : {}),
        }]
      })
      return children.length > 0 ? [{ type: value.type, children }] : []
    })
    return { version: 1, blocks }
  } catch {
    return null
  }
}

export function normalizeCommentBody(value: string) {
  const trimmed = value.trim()
  const richText = parseCommentRichText(trimmed)
  if (!richText) return trimmed
  return JSON.stringify(richText)
}

export function commentBodyText(value: string) {
  const richText = parseCommentRichText(value)
  return richText
    ? richText.blocks.map((block) => block.children.map((run) => run.text).join('')).join('\n')
    : value
}
