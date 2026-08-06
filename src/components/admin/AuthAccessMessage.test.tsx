import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthAccessMessage } from './AuthAccessMessage'

describe('Auth access message', () => {
  it('renders an accessible heading and both recovery actions', () => {
    const html = renderToStaticMarkup(
      <AuthAccessMessage
        eyebrow="Payload access"
        title="Waiting for access"
        primaryHref="/auth/pending"
        primaryLabel="Check access again"
        secondaryHref="/auth/logout"
        secondaryLabel="Sign out"
      >
        <p>Ask an administrator.</p>
      </AuthAccessMessage>,
    )

    expect(html).toContain('<h1')
    expect(html).toContain('Check access again')
    expect(html).toContain('Sign out')
  })
})
