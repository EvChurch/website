import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ConnectGroupComments } from './ConnectGroupComments'

const action = async (_formData: FormData) => {}
const updateAction = async (_commentId: number | string, _formData: FormData) => {}
const deleteAction = async (_commentId: number | string) => {}

describe('ConnectGroupComments', () => {
  it('renders shared and coach-only comments for a coach', () => {
    const markup = renderToStaticMarkup(<ConnectGroupComments
      action={action}
      updateAction={updateAction}
      deleteAction={deleteAction}
      thread={{
        access: 'granted',
        canPostCoachesOnly: true,
        currentAuthor: { name: 'Moana', avatarUrl: null },
        comments: [
          { id: 1, authorName: 'Aroha', avatarUrl: null, body: JSON.stringify({ version: 1, blocks: [{ type: 'paragraph', children: [{ text: 'Shared update', bold: true }, { text: ' website', href: 'https://ev.church/' }] }] }), coachesOnly: false, canEdit: true, canDelete: true, edited: true, createdAt: new Date().toISOString(), deletedAt: null, deletedByName: null },
          { id: 2, authorName: 'Moana', avatarUrl: null, body: 'Coach update', coachesOnly: true, canEdit: false, canDelete: false, edited: false, createdAt: new Date().toISOString(), deletedAt: null, deletedByName: null },
          { id: 3, authorName: 'Aroha', avatarUrl: null, body: '[deleted]', coachesOnly: false, canEdit: false, canDelete: false, edited: false, createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), deletedAt: new Date().toISOString(), deletedByName: 'Aroha' },
        ],
      }}
    />)

    expect(markup).toContain('<strong>Shared update</strong>')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('Coach update')
    expect(markup).toContain('Coaches only')
    expect(markup).toContain('border-amber-200 bg-amber-50')
    expect(markup).toContain('name="coachesOnly"')
    expect(markup).toContain('just now')
    expect(markup).toContain('just now (edited)')
    expect(markup).toContain('Comment formatting')
    expect(markup).toContain('Edit')
    expect(markup).toContain('Delete')
    expect(markup).toContain('Aroha</strong> deleted a comment')
    expect(markup).toContain('2 hours ago')
    expect(markup).not.toContain('[deleted]')
    expect(markup).not.toContain('Group comments')
    expect(markup).not.toContain('A private thread')
  })

  it('does not offer coach-only visibility to a leader', () => {
    const markup = renderToStaticMarkup(<ConnectGroupComments
      action={action}
      updateAction={updateAction}
      deleteAction={deleteAction}
      thread={{ access: 'granted', canPostCoachesOnly: false, currentAuthor: { name: 'Aroha', avatarUrl: null }, comments: [] }}
    />)

    expect(markup).toContain('No comments yet')
    expect(markup).not.toContain('name="coachesOnly"')
  })

  it('uses neutral copy for any failed comment change', () => {
    const markup = renderToStaticMarkup(<ConnectGroupComments
      action={action}
      updateAction={updateAction}
      deleteAction={deleteAction}
      status="error"
      thread={{ access: 'granted', canPostCoachesOnly: false, currentAuthor: { name: 'Aroha', avatarUrl: null }, comments: [] }}
    />)

    expect(markup).toContain('The comment change could not be saved. Try again.')
    expect(markup).not.toContain('could not be added')
  })
})
