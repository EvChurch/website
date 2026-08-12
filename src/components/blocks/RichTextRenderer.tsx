/**
 * Simple Lexical rich text renderer.
 * Handles the basic node types produced by the seed script and Payload's Lexical editor.
 */

interface LexicalNode {
  type: string
  text?: string
  format?: number | string
  children?: LexicalNode[]
  tag?: string
  listType?: string
  url?: string
  newTab?: boolean
  version?: number
  direction?: string
  fields?: {
    url?: string
    linkType?: string
    newTab?: boolean
    doc?: {
      relationTo?: string
      value?: unknown
    } | null
  }
  relationTo?: string
  value?: unknown
}

interface LexicalRoot {
  root: LexicalNode
}

interface RichTextProps {
  data: unknown
  className?: string
}

function renderNode(node: LexicalNode, index: number): React.ReactNode {
  // Text node
  if (node.type === 'text') {
    let content: React.ReactNode = node.text ?? ''
    const format = typeof node.format === 'number' ? node.format : 0

    if (format & 1) content = <strong key={index}>{content}</strong>
    if (format & 2) content = <em key={index}>{content}</em>
    if (format & 4) content = <s key={index}>{content}</s>
    if (format & 8) content = <code key={index}>{content}</code>

    return content
  }

  // Line break
  if (node.type === 'linebreak') {
    return <br key={index} />
  }

  const children = node.children?.map((child, i) => renderNode(child, i)) ?? []

  // Paragraph
  if (node.type === 'paragraph') {
    return <p key={index} className="mb-4 last:mb-0">{children}</p>
  }

  // Heading
  if (node.type === 'heading') {
    const Tag = (node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') ?? 'h2'
    return <Tag key={index}>{children}</Tag>
  }

  // List
  if (node.type === 'list') {
    const Tag = node.listType === 'number' ? 'ol' : 'ul'
    return <Tag key={index}>{children}</Tag>
  }

  // List item
  if (node.type === 'listitem') {
    return <li key={index}>{children}</li>
  }

  // Link
  if (node.type === 'link' || node.type === 'autolink') {
    const doc = node.fields?.doc
    const value = doc?.value
    const slug = value && typeof value === 'object' && 'slug' in value
      ? (value as { slug?: string }).slug
      : null
    const internalHref = slug
      ? ({
          pages: slug === 'home' ? '/' : `/${slug}`,
          'blog-posts': `/blog/${slug}`,
          events: `/events/${slug}`,
          campuses: `/campus/${slug}`,
          sermons: `/sermons/${slug}`,
          'sermon-series': `/sermons/series/${slug}`,
        } as Record<string, string>)[doc?.relationTo ?? '']
      : null
    const href = internalHref ?? node.url ?? node.fields?.url ?? '#'
    const newTab = node.newTab ?? node.fields?.newTab
    return (
      <a
        key={index}
        href={href}
        className="font-semibold text-rich-red underline decoration-rich-red/30 underline-offset-2 transition-colors hover:text-deep-red hover:decoration-deep-red/50"
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  // Populated upload embedded in rich text
  if (node.type === 'upload' && node.relationTo === 'media') {
    if (!node.value || typeof node.value !== 'object') return null
    const media = node.value as {
      url?: string | null
      alt?: string | null
      width?: number | null
      height?: number | null
      mimeType?: string | null
      filename?: string | null
    }
    if (!media.url) return null

    if (!media.mimeType?.startsWith('image/')) {
      return (
        <a key={index} href={media.url} rel="noopener noreferrer">
          {media.filename ?? 'Download file'}
        </a>
      )
    }

    return (
      <figure key={index} className="my-8">
        <img
          src={media.url}
          alt={media.alt ?? ''}
          width={media.width ?? undefined}
          height={media.height ?? undefined}
          className="h-auto w-full"
        />
      </figure>
    )
  }

  // Quote
  if (node.type === 'quote') {
    return <blockquote key={index}>{children}</blockquote>
  }

  // Root or unknown — just render children
  return <>{children}</>
}

export default function RichText({ data, className }: RichTextProps) {
  if (!data) return null

  // If the data is already a string
  if (typeof data === 'string') {
    return <p className={className}>{data}</p>
  }

  // Parse Lexical JSON
  const lexicalData = data as LexicalRoot
  if (!lexicalData.root?.children) {
    return null
  }

  // Return children directly (no wrapper div) so parent space-y works
  return (
    <>
      {lexicalData.root.children.map((node, i) => renderNode(node, i))}
    </>
  )
}
