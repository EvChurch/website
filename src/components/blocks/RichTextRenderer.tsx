/**
 * Simple Lexical rich text renderer.
 * Handles the basic node types produced by the seed script and Payload's Lexical editor.
 */

import { getPayloadMediaDerivative, type PayloadMediaImage } from '@/lib/payload-media'

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
  headerState?: number
  colSpan?: number
  rowSpan?: number
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
    const media = node.value as PayloadMediaImage & {
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

    const image = getPayloadMediaDerivative(media, 'large')
    if (!image?.url) return null

    return (
      <figure key={index} className="my-8">
        <img
          src={image.url}
          alt={media.alt ?? ''}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          className="h-auto w-full"
        />
      </figure>
    )
  }

  // Quote
  if (node.type === 'quote') {
    return <blockquote key={index}>{children}</blockquote>
  }

  // Table
  if (node.type === 'table') {
    const rows = node.children ?? []
    const firstRow = rows[0]
    const hasColumnHeaders = firstRow?.type === 'tablerow' &&
      firstRow.children?.every((cell) => cell.type === 'tablecell' && Boolean((cell.headerState ?? 0) & 1))
    const bodyRows = hasColumnHeaders ? rows.slice(1) : rows

    return (
      <div key={index} className="my-8 max-w-full overflow-x-auto rounded-xl border border-warm-grey">
        <table className="w-full min-w-[36rem] border-collapse text-left text-base leading-relaxed">
          {hasColumnHeaders && <thead className="bg-brand-black text-warm-white">{renderNode(firstRow, 0)}</thead>}
          <tbody>{bodyRows.map((row, rowIndex) => renderNode(row, rowIndex))}</tbody>
        </table>
      </div>
    )
  }

  // Table row
  if (node.type === 'tablerow') {
    return <tr key={index} className="border-b border-warm-grey last:border-b-0">{children}</tr>
  }

  // Table cell
  if (node.type === 'tablecell') {
    const headerState = node.headerState ?? 0
    const Tag = headerState ? 'th' : 'td'
    const scope = headerState & 1 ? 'col' : headerState & 2 ? 'row' : undefined
    return (
      <Tag
        key={index}
        colSpan={node.colSpan}
        rowSpan={node.rowSpan}
        scope={scope}
        className={headerState
          ? 'px-5 py-4 align-top font-semibold'
          : 'px-5 py-4 align-top text-dark-grey'
        }
      >
        {children}
      </Tag>
    )
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
