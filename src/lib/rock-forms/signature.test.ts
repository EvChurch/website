import { describe, expect, it } from 'vitest'
import { validateRockSignature } from './signature'

const values = {
  signedByName: 'Test Applicant',
  signedByEmail: 'test@example.test',
  signatureData: '',
}
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/dZsAAAAASUVORK5CYII='

describe('Rock signature validation', () => {
  it('requires the configured drawn signature rather than a typed name', () => {
    expect(validateRockSignature('drawn', values)).toBe('Draw your signature.')
    expect(
      validateRockSignature('drawn', { ...values, signatureData: png }),
    ).toBeNull()
    expect(
      validateRockSignature('drawn', {
        ...values,
        signatureData: 'data:image/svg+xml;base64,PHN2Zz4=',
      }),
    ).toBe('Draw your signature.')
  })

  it('requires a legal name and email for both signature modes', () => {
    expect(validateRockSignature('typed', values)).toBeNull()
    expect(
      validateRockSignature('typed', { ...values, signedByName: ' ' }),
    ).toBe('Enter your legal name.')
    expect(
      validateRockSignature('typed', { ...values, signedByEmail: '' }),
    ).toBe('Enter your email address.')
    expect(
      validateRockSignature('typed', { ...values, signatureData: png }),
    ).toBe('This step requires a typed signature.')
  })
})
