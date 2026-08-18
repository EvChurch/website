import { describe, expect, it } from 'vitest'

import { commentBodyText, normalizeCommentBody, parseCommentRichText } from './comment-rich-text'

describe('comment rich text', () => {
  it('keeps supported WYSIWYG formatting and normalizes links', () => {
    const normalized = normalizeCommentBody(JSON.stringify({
      version: 1,
      blocks: [{
        type: 'paragraph',
        children: [
          { text: 'A bold update', bold: true },
          { text: ' website', href: 'https://ev.church/connect-groups' },
        ],
      }],
    }))

    expect(parseCommentRichText(normalized)).toMatchObject({
      blocks: [{ children: [{ bold: true }, { href: 'https://ev.church/connect-groups' }] }],
    })
    expect(commentBodyText(normalized)).toBe('A bold update website')
  })

  it('drops unsafe links while preserving their text', () => {
    const document = parseCommentRichText(JSON.stringify({
      version: 1,
      blocks: [{ type: 'paragraph', children: [{ text: 'Unsafe', href: 'javascript:alert(1)' }] }],
    }))

    expect(document?.blocks[0]?.children[0]).toEqual({ text: 'Unsafe' })
  })
})
