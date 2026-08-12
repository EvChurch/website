import { describe, expect, it } from 'vitest'

import { safeRockWorkflowRedirect } from './redirect'

describe('safeRockWorkflowRedirect', () => {
  it.each([
    ['/thanks', 'https://www.ev.church/thanks'],
    ['thanks?from=rock#done', 'https://www.ev.church/thanks?from=rock#done'],
    ['https://www.ev.church/next', 'https://www.ev.church/next'],
  ])('accepts same-origin destination %s', (value, expected) => {
    expect(safeRockWorkflowRedirect(value, 'https://www.ev.church')).toBe(expected)
  })

  it('accepts only explicitly trusted external HTTPS origins', () => {
    expect(
      safeRockWorkflowRedirect(
        'https://events.ev.church/register?id=1',
        'https://www.ev.church',
        'https://events.ev.church, https://give.ev.church',
      ),
    ).toBe('https://events.ev.church/register?id=1')
    expect(
      safeRockWorkflowRedirect(
        'https://attacker.example/register',
        'https://www.ev.church',
        'https://events.ev.church',
      ),
    ).toBeNull()
  })

  it.each([
    '//attacker.example/path',
    '\\\\attacker.example/path',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'file:///etc/passwd',
    'http://ev.church/downgrade',
    'http://events.ev.church/downgrade',
    'https://user:pass@ev.church/private',
    'https://[malformed',
    `https://www.ev.church/${'x'.repeat(2_100)}`,
    'https://www.ev.church/path\u0000hidden',
  ])('rejects unsafe destination %s', (value) => {
    expect(
      safeRockWorkflowRedirect(
        value,
        'https://www.ev.church',
        'https://events.ev.church',
      ),
    ).toBeNull()
  })

  it('fails closed for malformed allowlist entries while preserving same-origin redirects', () => {
    const allowlist = 'https://events.ev.church/path,http://give.ev.church'
    expect(
      safeRockWorkflowRedirect(
        'https://events.ev.church/registration',
        'https://www.ev.church',
        allowlist,
      ),
    ).toBeNull()
    expect(
      safeRockWorkflowRedirect('/thanks', 'https://www.ev.church', allowlist),
    ).toBe('https://www.ev.church/thanks')
  })

  it('permits HTTP only for an exact local same-origin development request', () => {
    expect(safeRockWorkflowRedirect('/thanks', 'http://localhost:3000')).toBe(
      'http://localhost:3000/thanks',
    )
    expect(
      safeRockWorkflowRedirect(
        'http://other.localhost:3000/thanks',
        'http://localhost:3000',
        'http://other.localhost:3000',
      ),
    ).toBeNull()
    expect(
      safeRockWorkflowRedirect('/thanks', 'http://ev.church'),
    ).toBeNull()
  })
})
